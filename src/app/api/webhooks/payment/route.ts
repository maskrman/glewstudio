import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key to bypass RLS for webhook updates
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Map payment gateway event statuses to subscription_status enum values
function mapEventStatus(
  gatewayStatus: string
): 'active' | 'expired' | 'cancelled' | null {
  switch (gatewayStatus) {
    case 'active':
      return 'active';
    case 'past_due':
      return 'expired';
    case 'canceled': case'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      event,          // e.g. "subscription.updated"
      status,         // e.g. "active" | "past_due" | "canceled"
      user_id,        // UUID of the user in Supabase auth
      tier,           // e.g. "apertura" | "obturador" | "diafragma" (optional)
      expires_at,     // ISO string (optional)
    } = body;

    if (!user_id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, status' },
        { status: 400 }
      );
    }

    const mappedStatus = mapEventStatus(status);

    if (!mappedStatus) {
      return NextResponse.json(
        { error: `Unrecognized status: ${status}` },
        { status: 400 }
      );
    }

    // Build the update payload
    const updatePayload: Record<string, unknown> = {
      status: mappedStatus,
      updated_at: new Date().toISOString(),
    };

    if (tier) {
      updatePayload.tier = tier;
    }

    if (expires_at) {
      updatePayload.expires_at = expires_at;
    }

    // If reactivating, clear expires_at
    if (mappedStatus === 'active' && !expires_at) {
      updatePayload.expires_at = null;
    }

    // Try to update existing subscription row for this user
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (fetchError) {
      console.error('[webhook] fetch error:', fetchError.message);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (existing) {
      // Update existing subscription
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update(updatePayload)
        .eq('user_id', user_id);

      if (updateError) {
        console.error('[webhook] update error:', updateError.message);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      // Insert new subscription row
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
        console.error('[webhook] insert error:', insertError.message);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    console.log(
      `[webhook] event="${event ?? status}" user_id=${user_id} → status=${mappedStatus}`
    );

    return NextResponse.json({ received: true, status: mappedStatus });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[webhook] unexpected error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
