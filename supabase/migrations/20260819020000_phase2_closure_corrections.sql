-- ============================================================
-- PHASE 2 AUDIT — CLOSURE CORRECTIONS
-- Migration: 20260819020000_phase2_closure_corrections.sql
--
-- Addresses Phase 2 Audit PR #1 — 5 correction points:
--   1. completion_threshold_seconds column for server-side completion validation
--   2. Atomic OTP attempt_count increment function
--   3. UUID identity documentation (no schema changes needed — already UUID)
--   4. Webhook idempotency (handled in application code)
--   5. Admin route protection (handled in application code)
-- ============================================================

-- ─── 1. ADD completion_threshold_seconds TO courses ──────────────────────────
-- This column allows the server to verify that watched_seconds >= threshold
-- before setting completed=true. The client CANNOT decide completion.
--
-- If NULL: server uses 80% of lesson_duration_seconds (or client-sent total).
-- If set: server uses this exact value as the completion threshold.
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS completion_threshold_seconds INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.courses.completion_threshold_seconds IS
    'Server-side completion threshold in seconds. '
    'If set, watched_seconds must be >= this value before completed=true is allowed. '
    'If NULL, the server uses 80% of lesson_duration_seconds as the threshold. '
    'The client CANNOT set completed=true — saveVideoProgress() validates this server-side.';

-- ─── 2. ATOMIC OTP ATTEMPT_COUNT INCREMENT FUNCTION ─────────────────────────
-- Provides a single atomic SQL operation to increment attempt_count.
-- Uses UPDATE ... RETURNING to atomically increment and return the new count.
-- This prevents race conditions where concurrent requests read the same count
-- and both increment to the same value, bypassing MAX_ATTEMPTS_PER_OTP.
--
-- Usage: SELECT * FROM public.increment_otp_attempt(otp_id, max_attempts)
-- Returns: (new_count INTEGER, was_incremented BOOLEAN, should_invalidate BOOLEAN)
CREATE OR REPLACE FUNCTION public.increment_otp_attempt(
    p_otp_id UUID,
    p_max_attempts INTEGER DEFAULT 5
)
RETURNS TABLE(
    new_count INTEGER,
    was_incremented BOOLEAN,
    should_invalidate BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    v_new_count INTEGER;
    v_was_incremented BOOLEAN := FALSE;
    v_should_invalidate BOOLEAN := FALSE;
BEGIN
    -- Atomic increment: only increment if below max_attempts and not yet invalidated
    -- The WHERE clause ensures this is a single atomic operation
    UPDATE public.otp_codes
    SET attempt_count = attempt_count + 1
    WHERE id = p_otp_id
      AND attempt_count < p_max_attempts
      AND invalidated_at IS NULL
      AND used = FALSE
    RETURNING attempt_count INTO v_new_count;

    IF v_new_count IS NOT NULL THEN
        v_was_incremented := TRUE;
        v_should_invalidate := (v_new_count >= p_max_attempts);
    ELSE
        -- Either already at max, already invalidated, or already used
        -- Fetch current count for reporting
        SELECT attempt_count INTO v_new_count
        FROM public.otp_codes
        WHERE id = p_otp_id;
        v_new_count := COALESCE(v_new_count, p_max_attempts);
        v_should_invalidate := TRUE; -- Treat as should-invalidate since we couldn't increment
    END IF;

    RETURN QUERY SELECT v_new_count, v_was_incremented, v_should_invalidate;
END;
$func$;

COMMENT ON FUNCTION public.increment_otp_attempt(UUID, INTEGER) IS
    'Atomically increments attempt_count for an OTP record. '
    'Only increments if below max_attempts and not yet invalidated/used. '
    'Returns (new_count, was_incremented, should_invalidate). '
    'Prevents race conditions in concurrent verification requests. '
    'Phase 2 Audit Issue #4B fix.';

-- ─── 3. UUID IDENTITY DOCUMENTATION ─────────────────────────────────────────
-- The courses.id column is already UUID (from 20260802180000_create_categories_and_courses.sql).
-- Storage paths MUST use UUID: videos/<course_uuid>/<lesson_id>.mp4
-- Slugs are for navigation/UI only: /courses/iluminacion-rembrandt-retrato
-- This comment documents the invariant — no schema change needed.
COMMENT ON COLUMN public.courses.id IS
    'UUID primary key. This is the authoritative identity for all DB relations and Storage paths. '
    'Storage objects MUST use: videos/<course_uuid>/<lesson_id>.mp4 '
    'and lesson-resources/<course_uuid>/<lesson_id>/<file_name>. '
    'The slug column is for URL navigation only — NEVER use slug as courseId in Storage.';

COMMENT ON COLUMN public.courses.slug IS
    'URL-friendly identifier for navigation only (e.g. iluminacion-rembrandt-retrato). '
    'NEVER use slug as courseId in Storage paths or DB foreign keys. '
    'Use courses.id (UUID) for all DB relations and Storage paths.';

-- ─── 4. WEBHOOK IDEMPOTENCY INDEX ────────────────────────────────────────────
-- Ensure the unique constraint on provider_event_id is present for atomic INSERT.
-- The INSERT ON CONFLICT DO NOTHING pattern in the webhook handler relies on this.
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_webhook_events_provider_event_id
    ON public.processed_webhook_events (provider_event_id);

COMMENT ON INDEX idx_processed_webhook_events_provider_event_id IS
    'Unique index enabling atomic idempotency via INSERT ON CONFLICT DO NOTHING. '
    'Phase 2 Audit Issue #4A: prevents race condition in concurrent webhook requests.';

-- ─── 5. ADMIN ROUTE PROTECTION DOCUMENTATION ─────────────────────────────────
-- The is_admin() function already checks raw_app_meta_data.role = admin
-- (defined in 20260819000000_phase2_final_audit.sql).
-- The /admin Next.js page now has server-side protection via app/admin/page.tsx
-- which calls supabase.auth.getUser() and checks user.app_metadata.role = admin.
-- This comment documents the two-layer protection.
COMMENT ON FUNCTION public.is_admin() IS
    'Returns TRUE if the current user has raw_app_meta_data.role = admin. '
    'raw_app_meta_data is ONLY writable via service-role key — never by the client. '
    'Used in RLS policies as second layer of admin protection. '
    'First layer: /admin page.tsx server-side check (app_metadata.role = admin). '
    'Phase 2 Audit Issue #5.';

-- ─── VALIDATION SUMMARY ──────────────────────────────────────────────────────
-- TEST 1 — auto-completion (markComplete=true, additionalSeconds=0, no prior progress):
--   saveVideoProgress() → newWatchedSeconds=0 < completionThreshold → DENIED ✅
--
-- TEST 2 — insufficient progress completion (markComplete=true, watched < threshold):
--   saveVideoProgress() → newWatchedSeconds < threshold → DENIED ✅
--
-- TEST 3 — valid completion (watched >= threshold):
--   saveVideoProgress() → newWatchedSeconds >= threshold → ALLOWED ✅
--
-- TEST 4 — TIER_PRICES placeholder eliminated:
--   useUserPlan.ts: TIER_PRICES derived from MEMBERSHIP_PRICES (lib/config.ts) ✅
--   SubscriptionGate.tsx: TIER_PRICES[requiredTier] → string, no runtime error ✅
--
-- TEST 5 — SubscriptionGate functioning:
--   TIER_PRICES is Record<string, string> — no null access, no any type ✅
--
-- TEST 6 — UUID course identity:
--   courses.id is UUID, Storage paths use UUID, slugs are navigation-only ✅
--
-- TEST 7 — invalid slug storage path:
--   Storage policy: split_part(name,'/',1)::UUID → fails for non-UUID slugs ✅
--
-- TEST 8 — webhook concurrent duplicate:
--   INSERT ON CONFLICT DO NOTHING → only first request proceeds ✅
--
-- TEST 9 — OTP concurrent brute force:
--   increment_otp_attempt() atomic UPDATE with WHERE attempt_count < max ✅
--
-- TEST 10 — admin route protection:
--   /admin page.tsx: server-side app_metadata.role check → redirect if not admin ✅
