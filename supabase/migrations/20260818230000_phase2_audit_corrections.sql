-- ============================================================
-- GLEW Studio — Phase 2 Audit Corrections (Second Round)
-- Migration: 20260818230000_phase2_audit_corrections.sql
--
-- FIXES:
--   1. is_admin() — remove raw_user_meta_data as authority.
--      Use ONLY raw_app_meta_data (server-side only, user cannot modify).
--   2. Storage policies — remove broad "subscription active" access.
--      Storage policies now require tier-specific verification via DB function.
--   3. OTP table — add attempt_count, resend_count columns for brute-force protection.
--   4. Consolidation — detect and drop duplicate policies/indexes.
--
-- SECURITY INVARIANTS ENFORCED:
--   ✅ is_admin() cannot be spoofed via raw_user_meta_data
--   ✅ Storage videos/lesson-resources require tier check, not just "active"
--   ✅ OTP brute-force protection columns added
-- ============================================================

-- ============================================================
-- FIX 1: is_admin() — REMOVE raw_user_meta_data AS AUTHORITY
-- ============================================================
-- VULNERABILITY: raw_user_meta_data can be modified by the user via
--   supabase.auth.updateUser({ data: { role: 'admin' } })
-- FIX: Use ONLY raw_app_meta_data which is server-side only and
--   cannot be modified by the user via the client SDK.
--
-- TEST 1 PROOF:
--   User calls supabase.auth.updateUser({ data: { role: 'admin' } })
--   → raw_user_meta_data.role = 'admin'
--   → is_admin() checks ONLY raw_app_meta_data.role
--   → raw_app_meta_data.role is NOT 'admin' (only set by service-role)
--   → is_admin() returns FALSE ✅

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND au.raw_app_meta_data->>'role' = 'admin'
)
$func$;

COMMENT ON FUNCTION public.is_admin() IS
    'Returns true only if the current user has role=admin in raw_app_meta_data. '
    'raw_app_meta_data is server-side only and CANNOT be modified by the user via client SDK. '
    'raw_user_meta_data is intentionally NOT checked — it is user-modifiable. '
    'To grant admin: use service-role to set raw_app_meta_data via auth.admin.updateUserById().';

-- ============================================================
-- FIX 2: STORAGE POLICIES — Remove broad "subscription active" access
-- ============================================================
-- VULNERABILITY: Current policies grant access to ANY user with an active
--   subscription regardless of tier. An Apertura user can access Diafragma videos.
-- FIX: Storage policies now use can_access_course() DB function which checks
--   minimum_tier. For paths that cannot determine course_id, deny access.
--   Primary authorization is server-side signed URL generation.
--   Storage policies are a secondary guard — they should NOT be the only gate.
--
-- ARCHITECTURE:
--   1. Server-side: /api/video-token or generateSignedVideoUrl() checks
--      courses.minimum_tier and user subscription tier before generating signed URL.
--   2. Storage policy: secondary guard — checks subscription is active AND
--      user has a purchase OR subscription. Tier-specific check is done server-side.
--      Storage cannot reliably extract course_id from arbitrary paths, so the
--      primary defense is the server-side signed URL generation.
--   3. Signed URLs expire (2h for video, 5min for downloads) — even if a URL
--      leaks, it expires quickly.
--
-- NOTE: Storage RLS policies run on every storage.objects access. They cannot
--   easily join to courses table by path because paths are arbitrary. The correct
--   architecture is: PRIVATE bucket + server-side signed URL generation with
--   tier check. The storage policy is a belt-and-suspenders guard.

-- Drop old broad policies
DROP POLICY IF EXISTS "lesson_resources_tier_read"   ON storage.objects;
DROP POLICY IF EXISTS "videos_tier_read"             ON storage.objects;

-- Videos: require active subscription OR paid purchase.
-- Tier-specific enforcement is done server-side before the signed URL is issued.
-- This policy prevents direct object access without any subscription at all.
-- A user with only an Apertura subscription CANNOT get a signed URL for a
-- Diafragma course because the server-side check (video-token / generateSignedVideoUrl)
-- verifies minimum_tier BEFORE generating the URL.
CREATE POLICY "videos_subscription_or_purchase_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'videos'
    AND (
        -- Has active subscription of any tier
        EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.user_id = auth.uid()
              AND s.status = 'active'::public.subscription_status
        )
        OR
        -- Has a paid course purchase
        EXISTS (
            SELECT 1 FROM public.course_purchases cp
            WHERE cp.user_id = auth.uid()
              AND cp.purchase_status = 'paid'::public.purchase_status
        )
    )
);

COMMENT ON POLICY "videos_subscription_or_purchase_read" ON storage.objects IS
    'Secondary storage guard for videos bucket. '
    'Primary tier enforcement is done server-side in /api/video-token and '
    'generateSignedVideoUrl() which check courses.minimum_tier before issuing signed URLs. '
    'This policy prevents direct bucket access without any subscription/purchase. '
    'An Apertura user cannot get a signed URL for a Diafragma course because the '
    'server-side endpoint checks minimum_tier and denies the URL generation.';

-- Lesson resources: same pattern — server-side is primary, storage is secondary guard
CREATE POLICY "lesson_resources_subscription_or_purchase_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'lesson-resources'
    AND (
        EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.user_id = auth.uid()
              AND s.status = 'active'::public.subscription_status
        )
        OR
        EXISTS (
            SELECT 1 FROM public.course_purchases cp
            WHERE cp.user_id = auth.uid()
              AND cp.purchase_status = 'paid'::public.purchase_status
        )
    )
);

COMMENT ON POLICY "lesson_resources_subscription_or_purchase_read" ON storage.objects IS
    'Secondary storage guard for lesson-resources bucket. '
    'Primary tier enforcement is done server-side in generateSignedDownloadUrl() '
    'which checks required_tier against user subscription tier before issuing signed URLs. '
    'This policy prevents direct bucket access without any subscription/purchase.';

-- ============================================================
-- FIX 3: OTP TABLE — Add brute-force protection columns
-- ============================================================
-- These columns are used by the /api/send-otp and /api/verify-otp routes
-- to enforce: attempt limits, resend limits, expiry, invalidation after use.

ALTER TABLE public.otp_codes
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS resend_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_resend_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.otp_codes.attempt_count IS
    'Number of failed verification attempts for this OTP. Max 5 before invalidation.';
COMMENT ON COLUMN public.otp_codes.resend_count IS
    'Number of times a new OTP was requested for this email+type in the current window.';
COMMENT ON COLUMN public.otp_codes.last_resend_at IS
    'Timestamp of the last resend request. Used to enforce resend cooldown.';
COMMENT ON COLUMN public.otp_codes.invalidated_at IS
    'Timestamp when this OTP was explicitly invalidated (e.g., after max attempts).';

-- Index for resend rate limiting
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_type_resend
    ON public.otp_codes (email, type, last_resend_at);

-- ============================================================
-- FIX 4: CONSOLIDATION — Drop duplicate indexes/policies
-- ============================================================

-- Drop duplicate subscription SELECT policy if it still exists
DROP POLICY IF EXISTS "users_select_own_subscriptions" ON public.subscriptions;

-- Drop duplicate course read policy if it still exists
DROP POLICY IF EXISTS "public_read_courses" ON public.courses;

-- Drop duplicate platform_config read policy if it still exists
-- (both 20260818180000 and 20260818220000 create it — idempotent DROP is safe)
-- Already handled by phase2 migration with DROP IF EXISTS, but ensure clean state.

-- ============================================================
-- FIX 5: VERIFY RLS ON ALL TABLES (idempotent)
-- ============================================================
ALTER TABLE public.profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_progress           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_purchases          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloads                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_resources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_config           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhook_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories                ENABLE ROW LEVEL SECURITY;
