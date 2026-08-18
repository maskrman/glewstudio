import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── Admin client (server-only, never exposed to browser) ────────────────────
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 9 PLACEHOLDER: Provider Signature Verification
//
// This function MUST be replaced with real HMAC/signature verification when
// the payment provider (Stripe, PayPal, MercadoPago, etc.) is integrated.
//
// Until then, this webhook is DISABLED for all external requests.
// It will only process requests that include the correct WEBHOOK_SECRET header,
// which is an internal secret never exposed to the browser.
//
// DO NOT implement Stripe/PayPal-specific signature logic here yet.
// DO NOT accept requests without passing this verification layer.
// ─────────────────────────────────────────────────────────────────────────────
function verifyWebhookRequest(req: NextRequest): {
  verified: boolean;
  providerEventId: string | null;
  rawBody?: string;
} {
  // Internal pre-integration guard: require a shared secret header.
  // In Phase 9, replace this with provider-specific HMAC verification
  // (e.g. Stripe: stripe.webhooks.constructEvent(rawBody, sig, secret)).
  const internalSecret = process.env.WEBHOOK_INTERNAL_SECRET;
  const providedSecret = req.headers.get('x-webhook-secret');

  if (!internalSecret || !providedSecret || providedSecret !== internalSecret) {
    return { verified: false, providerEventId: null };
  }

  // In Phase 9: extract the provider's unique event ID from the payload/headers.
  // For now, the caller must supply a provider_event_id in the body.
  // This is validated below after body parsing.
  return { verified: true, providerEventId: null };
}

// ─── Allowed event types → subscription status mapping ───────────────────────
// Only these events are accepted. The tier is determined server-side from the
// event type, NOT from client-supplied values.
const ALLOWED_EVENTS: Record<string, { status: 'active' | 'expired' | 'cancelled' }> = {
  'subscription.activated':   { status: 'active' },
  'subscription.renewed':     { status: 'active' },
  'subscription.past_due':    { status: 'expired' },
  'subscription.cancelled':   { status: 'cancelled' },
  'subscription.expired':     { status: 'expired' },
};

// ─── Allowed tiers (server-side whitelist) ────────────────────────────────────
const ALLOWED_TIERS = new Set(['apertura', 'obturador', 'diafragma']);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/payment
//
// Security model:
//   1. Signature/secret verification (verifyWebhookRequest) — REQUIRED.
//      Any request that fails verification is rejected with 401.
//   2. Idempotency: provider_event_id is stored in processed_webhook_events.
//      Duplicate events are rejected with 200 (already processed).
//   3. Tier is validated against a server-side whitelist.
//      Client-supplied tier values are NEVER written directly.
//   4. user_id is validated against auth.users before any DB write.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ── Step 1: Verify request authenticity ──────────────────────────────────
  const verification = verifyWebhookRequest(req);

  if (!verification.verified) {
    console.warn('[webhook] Rejected: failed signature/secret verification');
    return NextResponse.json(
      { error: 'Unauthorized: webhook verification failed' },
      { status: 401 }
    );
  }

  // ── Step 2: Parse body ────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    event,             // e.g. "subscription.activated"
    provider_event_id, // Unique event ID from the payment provider (required for idempotency)
    user_id,           // UUID of the user in Supabase auth
    tier,              // e.g. "apertura" | "obturador" | "diafragma"
    expires_at,        // ISO string (optional)
  } = body as {
    event?: string;
    provider_event_id?: string;
    user_id?: string;
    tier?: string;
    expires_at?: string;
  };

  // ── Step 3: Validate required fields ─────────────────────────────────────
  if (!provider_event_id) {
    return NextResponse.json(
      { error: 'Missing required field: provider_event_id (idempotency key)' },
      { status: 400 }
    );
  }

  if (!user_id) {
    return NextResponse.json(
      { error: 'Missing required field: user_id' },
      { status: 400 }
    );
  }

  if (!event) {
    return NextResponse.json(
      { error: 'Missing required field: event' },
      { status: 400 }
    );
  }

  // ── Step 4: Validate event type (server-side whitelist) ───────────────────
  const eventConfig = ALLOWED_EVENTS[event];
  if (!eventConfig) {
    console.warn(`[webhook] Rejected: unknown event type "${event}"`);
    return NextResponse.json(
      { error: `Unrecognized event type: ${event}` },
      { status: 400 }
    );
  }

  // ── Step 5: Validate tier (server-side whitelist) ─────────────────────────
  // The tier must be explicitly provided AND must be in the allowed set.
  // We do NOT fall back to a default tier for active subscriptions —
  // the payment provider must specify which plan was purchased.
  if (eventConfig.status === 'active') {
    if (!tier || !ALLOWED_TIERS.has(tier)) {
      return NextResponse.json(
        { error: `Invalid or missing tier for activation event. Allowed: ${[...ALLOWED_TIERS].join(', ')}` },
        { status: 400 }
      );
    }
  }

  // ── Step 6: Idempotency check — reject duplicate events ───────────────────
  const { data: existingEvent, error: idempotencyError } = await supabaseAdmin
    .from('processed_webhook_events')
    .select('id, processed_at')
    .eq('provider_event_id', provider_event_id)
    .maybeSingle();

  if (idempotencyError) {
    console.error('[webhook] idempotency check error:', idempotencyError.message);
    return NextResponse.json({ error: 'Internal error during idempotency check' }, { status: 500 });
  }

  if (existingEvent) {
    console.log(`[webhook] Duplicate event rejected: provider_event_id=${provider_event_id} (already processed at ${existingEvent.processed_at})`);
    return NextResponse.json(
      { received: true, duplicate: true, message: 'Event already processed' },
      { status: 200 }
    );
  }

  // ── Step 7: Validate user exists in auth.users ────────────────────────────
  const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);

  if (userError || !authUser?.user) {
    console.warn(`[webhook] Rejected: user_id=${user_id} not found in auth.users`);
    return NextResponse.json(
      { error: `User not found: ${user_id}` },
      { status: 400 }
    );
  }

  // ── Step 8: Build update payload (server-controlled values only) ──────────
  const mappedStatus = eventConfig.status;

  const updatePayload: Record<string, unknown> = {
    status: mappedStatus,
    updated_at: new Date().toISOString(),
  };

  // Only set tier for activation events (server-validated above)
  if (eventConfig.status === 'active' && tier) {
    updatePayload.tier = tier;
  }

  // For cancellation/expiry, downgrade tier to apertura
  if (eventConfig.status === 'cancelled' || eventConfig.status === 'expired') {
    updatePayload.tier = 'apertura';
  }

  if (expires_at) {
    updatePayload.expires_at = expires_at;
  }

  if (mappedStatus === 'active' && !expires_at) {
    updatePayload.expires_at = null;
  }

  // ── Step 9: Upsert subscription ───────────────────────────────────────────
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('user_id', user_id)
    .maybeSingle();

  if (fetchError) {
    console.error('[webhook] fetch subscription error:', fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (existing) {
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update(updatePayload)
      .eq('user_id', user_id);

    if (updateError) {
      console.error('[webhook] update subscription error:', updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id,
        tier: tier ?? 'apertura',
        status: mappedStatus,
        started_at: new Date().toISOString(),
        expires_at: expires_at ?? null,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[webhook] insert subscription error:', insertError.message);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  // ── Step 10: Record event as processed (idempotency) ──────────────────────
  const { error: recordError } = await supabaseAdmin
    .from('processed_webhook_events')
    .insert({
      provider_event_id,
      event_type: event,
      user_id,
      processed_at: new Date().toISOString(),
    });

  if (recordError) {
    // Non-fatal: subscription was already updated. Log and continue.
    console.error('[webhook] failed to record processed event:', recordError.message);
  }

  console.log(
    `[webhook] processed: event="${event}" provider_event_id=${provider_event_id} user_id=${user_id} → status=${mappedStatus}`
  );

  return NextResponse.json({ received: true, status: mappedStatus });
}
