-- ============================================================
-- GLEW Studio — Idempotency & Webhook Security (Phase 1 Audit)
-- Migration: 20260818210000_webhook_idempotency.sql
--
-- OBJECTIVES:
--   1. Create processed_webhook_events table for idempotency.
--      The same provider_event_id can never be processed twice.
--   2. Add index for fast duplicate detection.
--   3. Enable RLS — only service-role (webhook server) may write.
--   4. Clients (authenticated users) may NOT read or write this table.
--
-- NOTE: The payment provider (Stripe/PayPal/etc.) is NOT yet integrated.
--   This table is prepared for Phase 9. The webhook endpoint already
--   uses it to reject duplicate events.
-- ============================================================

-- ── 1. Create the table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_event_id   text        NOT NULL,   -- Unique event ID from payment provider
    event_type          text        NOT NULL,   -- e.g. "subscription.activated"
    user_id             uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    processed_at        timestamptz NOT NULL DEFAULT now(),
    metadata            jsonb       DEFAULT '{}'::jsonb,

    -- Uniqueness constraint: same provider_event_id can never be inserted twice
    CONSTRAINT processed_webhook_events_provider_event_id_key UNIQUE (provider_event_id)
);

-- ── 2. Index for fast duplicate lookups ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_provider_event_id
    ON public.processed_webhook_events (provider_event_id);

CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_user_id
    ON public.processed_webhook_events (user_id);

-- ── 3. Enable RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS Policies ───────────────────────────────────────────────────────────
-- No policies for authenticated users — this table is service-role only.
-- The webhook API route uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- Regular users and anon cannot read or write this table.

-- Admin read-only (for debugging/auditing via admin panel)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'processed_webhook_events'
          AND policyname = 'admin_read_webhook_events'
    ) THEN
        CREATE POLICY "admin_read_webhook_events"
            ON public.processed_webhook_events
            FOR SELECT
            TO authenticated
            USING (public.is_admin());
    END IF;
END $$;

-- ── 5. Comments ───────────────────────────────────────────────────────────────
COMMENT ON TABLE public.processed_webhook_events IS
    'Idempotency log for payment webhook events. '
    'Each provider_event_id may only appear once. '
    'Prevents duplicate subscription activations from replayed webhooks. '
    'Written exclusively by the server-side webhook handler using service-role key. '
    'Phase 9: populate provider_event_id from real payment provider event IDs.';

COMMENT ON COLUMN public.processed_webhook_events.provider_event_id IS
    'Unique event identifier from the payment provider (e.g. Stripe evt_xxx). '
    'Used as the idempotency key — duplicate events are rejected.';

COMMENT ON COLUMN public.processed_webhook_events.event_type IS
    'Event type string, e.g. subscription.activated, subscription.cancelled.';

COMMENT ON COLUMN public.processed_webhook_events.metadata IS
    'Optional JSON metadata for debugging (provider response, tier, etc.).';
