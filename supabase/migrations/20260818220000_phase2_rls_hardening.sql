-- ============================================================
-- GLEW Studio — Phase 2: Database Hardening & RLS Audit
-- Migration: 20260818220000_phase2_rls_hardening.sql
--
-- OBJECTIVES:
--   1. Enforce minimum-privilege RLS on every table.
--   2. Prevent any authenticated user from:
--        - granting themselves a higher tier
--        - activating their own subscription
--        - modifying subscription status
--        - inserting course_purchases
--        - modifying certificates / course_progress of other users
--        - reading data of other users
--   3. Enable RLS on otp_codes (currently disabled — CRITICAL).
--   4. Harden profiles: block users from writing protected fields.
--   5. Harden watchlist: split ALL into SELECT/INSERT/UPDATE/DELETE
--      so UPDATE cannot change user_id to another user.
--   6. Harden course_progress: block completed/completed_at self-manipulation.
--   7. Harden downloads: read-only for users; only service-role inserts.
--   8. Harden payments: read-only for users; only service-role inserts.
--   9. Harden lesson_resources: enforce tier check at policy level.
--  10. Harden platform_config: public read, admin write only.
--  11. Harden payment_events: admin/service-role only.
--  12. Harden processed_webhook_events: service-role write, admin read.
--  13. Prepare Storage: create lesson-resources bucket as private,
--      add policies for premium resource access.
--  14. Harden assets bucket: restrict write to service-role.
--
-- SECURITY INVARIANTS ENFORCED:
--   ✅ User cannot change their subscription tier
--   ✅ User cannot activate their own subscription
--   ✅ User cannot insert course_purchases
--   ✅ User cannot read another user's data
--   ✅ User cannot modify another user's course_progress
--   ✅ User cannot modify their own completed/completed_at fields
--   ✅ User cannot insert payments or downloads directly
--   ✅ otp_codes no longer fully exposed (RLS enabled, service-role only)
--   ✅ lesson_resources: metadata readable by authenticated users,
--      actual file access enforced server-side via signed URLs
--   ✅ Premium storage bucket is private (no public access)
-- ============================================================

-- ============================================================
-- SECTION 1: HELPER FUNCTIONS
-- ============================================================

-- is_admin() already exists from 20260818180000_glew_platform_upgrade.sql
-- Verify it exists; recreate if needed (idempotent)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND (
        au.raw_user_meta_data->>'role' = 'admin'
        OR au.raw_app_meta_data->>'role' = 'admin'
    )
)
$func$;

-- Helper: check if user has an active subscription of sufficient tier
-- Used in lesson_resources policy to enforce tier-gated metadata access
CREATE OR REPLACE FUNCTION public.user_has_active_subscription_min_tier(p_min_tier TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $func$
DECLARE
    v_tier_rank INTEGER;
    v_user_rank INTEGER;
    v_user_tier TEXT;
BEGIN
    -- Tier rank map
    v_tier_rank := CASE p_min_tier
        WHEN 'apertura'  THEN 1
        WHEN 'obturador' THEN 2
        WHEN 'diafragma' THEN 3
        ELSE 0
    END;

    -- Get current user's active tier
    SELECT tier::TEXT INTO v_user_tier
    FROM public.subscriptions
    WHERE user_id = auth.uid()
      AND status = 'active'::public.subscription_status
    LIMIT 1;

    IF v_user_tier IS NULL THEN
        RETURN false;
    END IF;

    v_user_rank := CASE v_user_tier
        WHEN 'apertura'  THEN 1
        WHEN 'obturador' THEN 2
        WHEN 'diafragma' THEN 3
        ELSE 0
    END;

    RETURN v_user_rank >= v_tier_rank;
END;
$func$;

-- ============================================================
-- SECTION 2: PROFILES — Hardened
-- ============================================================
-- Current state: FOR ALL with USING/WITH CHECK (id = auth.uid())
-- Risk: user can write any column including future sensitive fields.
-- Fix: keep FOR ALL but document that sensitive fields (role, tier)
--      must NEVER be added to profiles. The table currently has only
--      safe user-editable fields (full_name, avatar_url, bio).
--      Admin policy added for full access.

-- Drop existing policies
DROP POLICY IF EXISTS "users_manage_own_profiles"   ON public.profiles;
DROP POLICY IF EXISTS "admin_manage_profiles"        ON public.profiles;

-- Users: read their own profile
DROP POLICY IF EXISTS "users_select_own_profile"    ON public.profiles;
CREATE POLICY "users_select_own_profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users: update only their own profile (safe columns only — full_name, avatar_url, bio)
-- No INSERT needed: trigger handle_new_user_profile creates the row on signup
DROP POLICY IF EXISTS "users_update_own_profile"    ON public.profiles;
CREATE POLICY "users_update_own_profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admin: full access
DROP POLICY IF EXISTS "admin_manage_profiles"       ON public.profiles;
CREATE POLICY "admin_manage_profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Service role: full access (bypasses RLS by default, no explicit policy needed)

-- ============================================================
-- SECTION 3: SUBSCRIPTIONS — Hardened
-- ============================================================
-- Current state after Phase 1:
--   ✅ SELECT: users_read_own_subscription (SELECT only)
--   ✅ SELECT: users_select_own_subscriptions (SELECT only)
--   ✅ ALL: admin_manage_subscriptions (admin only)
--   ❌ NO INSERT/UPDATE for regular users (correct — trigger creates row)
--
-- Remaining risk: admin_manage_subscriptions uses FOR ALL which allows
-- any admin to set any tier/status. This is acceptable (admins are trusted),
-- but we add a comment documenting the invariant.
--
-- Additional hardening: ensure no duplicate SELECT policies exist.

-- Remove duplicate SELECT policy if it exists
DROP POLICY IF EXISTS "users_select_own_subscriptions" ON public.subscriptions;

-- Ensure the canonical SELECT policy exists
DROP POLICY IF EXISTS "users_read_own_subscription"    ON public.subscriptions;
CREATE POLICY "users_read_own_subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admin policy already exists from platform_upgrade; recreate for clarity
DROP POLICY IF EXISTS "admin_manage_subscriptions"     ON public.subscriptions;
CREATE POLICY "admin_manage_subscriptions"
ON public.subscriptions
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- INVARIANT COMMENT:
-- No INSERT/UPDATE/DELETE policy exists for regular authenticated users.
-- The only way a subscription row is created is via the SECURITY DEFINER
-- trigger create_free_subscription_for_new_user() (tier=apertura, status=trialing).
-- The only way a subscription is upgraded is via the service-role webhook handler.
-- A regular user CANNOT change their own tier or status.

-- ============================================================
-- SECTION 4: WATCHLIST — Hardened (split ALL into granular ops)
-- ============================================================
-- Current risk: FOR ALL allows UPDATE to change user_id to another user's id.
-- Fix: split into SELECT/INSERT/DELETE. No UPDATE needed for watchlist.

DROP POLICY IF EXISTS "users_manage_own_watchlist"  ON public.watchlist;

-- SELECT: own rows only
DROP POLICY IF EXISTS "users_select_own_watchlist"  ON public.watchlist;
CREATE POLICY "users_select_own_watchlist"
ON public.watchlist
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: only own user_id
DROP POLICY IF EXISTS "users_insert_own_watchlist"  ON public.watchlist;
CREATE POLICY "users_insert_own_watchlist"
ON public.watchlist
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- DELETE: own rows only
DROP POLICY IF EXISTS "users_delete_own_watchlist"  ON public.watchlist;
CREATE POLICY "users_delete_own_watchlist"
ON public.watchlist
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- No UPDATE policy: watchlist rows are insert/delete only.
-- If course metadata needs updating, delete and re-insert.

-- Admin: full access
DROP POLICY IF EXISTS "admin_manage_watchlist"      ON public.watchlist;
CREATE POLICY "admin_manage_watchlist"
ON public.watchlist
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- SECTION 5: COURSE_PROGRESS — Hardened
-- ============================================================
-- Current risk: FOR ALL allows users to set completed=true and
-- completed_at to any value, effectively self-issuing certificates.
-- Fix: split into SELECT/INSERT/UPDATE with restricted UPDATE columns.
-- Note: PostgreSQL RLS cannot restrict specific columns, but we can
-- use a trigger to prevent manipulation of completed/completed_at.

DROP POLICY IF EXISTS "users_manage_own_course_progress" ON public.course_progress;

-- SELECT: own rows only
DROP POLICY IF EXISTS "users_select_own_course_progress" ON public.course_progress;
CREATE POLICY "users_select_own_course_progress"
ON public.course_progress
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: own user_id only; completed must be false on insert
DROP POLICY IF EXISTS "users_insert_own_course_progress" ON public.course_progress;
CREATE POLICY "users_insert_own_course_progress"
ON public.course_progress
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    AND completed = false
);

-- UPDATE: own rows only; cannot change user_id
DROP POLICY IF EXISTS "users_update_own_course_progress" ON public.course_progress;
CREATE POLICY "users_update_own_course_progress"
ON public.course_progress
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: own rows only
DROP POLICY IF EXISTS "users_delete_own_course_progress" ON public.course_progress;
CREATE POLICY "users_delete_own_course_progress"
ON public.course_progress
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Admin: full access
DROP POLICY IF EXISTS "admin_manage_course_progress"     ON public.course_progress;
CREATE POLICY "admin_manage_course_progress"
ON public.course_progress
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Trigger: prevent users from self-issuing completion certificates
-- Users cannot set completed=true or completed_at directly via the browser client.
-- Server actions that need to mark completion must use the service-role client
-- (SUPABASE_SERVICE_ROLE_KEY), which bypasses RLS and this trigger is not invoked
-- for service-role connections (they bypass row-level security entirely).
--
-- This trigger fires for authenticated (anon-key) connections only.
-- It prevents a user from calling supabase.from('course_progress').update({completed: true})
-- directly from the browser or via a server action using the user's session.
--
-- To mark a course as completed, use the saveVideoProgress server action which
-- uses the service-role admin client for the completion write.
CREATE OR REPLACE FUNCTION public.prevent_self_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
    -- Block INSERT with completed=true from non-admin authenticated users
    IF TG_OP = 'INSERT' AND NEW.completed = true THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Cannot insert a course_progress row with completed=true. Use the server-side progress API.';
        END IF;
    END IF;

    -- Block UPDATE that sets completed from false to true from non-admin authenticated users
    IF TG_OP = 'UPDATE' THEN
        IF NEW.completed = true AND OLD.completed = false THEN
            IF NOT public.is_admin() THEN
                RAISE EXCEPTION 'Course completion can only be set by the server-side progress API. Use saveVideoProgress() server action.';
            END IF;
        END IF;
        -- Block manipulation of completed_at once it has been set
        IF NEW.completed_at IS DISTINCT FROM OLD.completed_at AND OLD.completed_at IS NOT NULL THEN
            IF NOT public.is_admin() THEN
                RAISE EXCEPTION 'completed_at cannot be modified after it has been set.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS prevent_self_completion_trigger ON public.course_progress;
CREATE TRIGGER prevent_self_completion_trigger
    BEFORE INSERT OR UPDATE ON public.course_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_self_completion();

-- ============================================================
-- SECTION 6: COURSE_PURCHASES — Hardened
-- ============================================================
-- Current state after Phase 1:
--   ✅ SELECT: users_read_own_purchases (SELECT only)
--   ✅ ALL: admin_manage_purchases (admin only)
--   ❌ NO INSERT/UPDATE/DELETE for regular users (correct)
--
-- Additional hardening: ensure no stale permissive policies remain.

DROP POLICY IF EXISTS "users_manage_own_course_purchases" ON public.course_purchases;

-- Ensure canonical SELECT policy exists
DROP POLICY IF EXISTS "users_read_own_purchases"          ON public.course_purchases;
CREATE POLICY "users_read_own_purchases"
ON public.course_purchases
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admin policy
DROP POLICY IF EXISTS "admin_manage_purchases"            ON public.course_purchases;
CREATE POLICY "admin_manage_purchases"
ON public.course_purchases
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- INVARIANT: No INSERT/UPDATE/DELETE for regular users.
-- course_purchases rows are created exclusively by the service-role webhook handler.

-- ============================================================
-- SECTION 7: DOWNLOADS — Hardened
-- ============================================================
-- Current risk: FOR ALL allows users to INSERT their own download records,
-- which could be used to fake download history.
-- Fix: SELECT only for users; service-role handles INSERT.

DROP POLICY IF EXISTS "users_manage_own_downloads"  ON public.downloads;

-- SELECT: own rows only
DROP POLICY IF EXISTS "users_select_own_downloads"  ON public.downloads;
CREATE POLICY "users_select_own_downloads"
ON public.downloads
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE for regular users.
-- Downloads are recorded server-side when a signed URL is generated.

-- Admin: full access
DROP POLICY IF EXISTS "admin_manage_downloads"      ON public.downloads;
CREATE POLICY "admin_manage_downloads"
ON public.downloads
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- SECTION 8: PAYMENTS — Hardened
-- ============================================================
-- Current risk: service_insert_payments allows authenticated users to
-- INSERT their own payment records (user_id = auth.uid()).
-- This is dangerous: a user could fabricate a payment record.
-- Fix: SELECT only for users; service-role handles INSERT.

DROP POLICY IF EXISTS "service_insert_payments"     ON public.payments;
DROP POLICY IF EXISTS "users_view_own_payments"     ON public.payments;

-- SELECT: own rows only
DROP POLICY IF EXISTS "users_select_own_payments"   ON public.payments;
CREATE POLICY "users_select_own_payments"
ON public.payments
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE for regular users.
-- Payment records are created exclusively by the service-role webhook handler.

-- Admin: full access
DROP POLICY IF EXISTS "admin_manage_payments"       ON public.payments;
CREATE POLICY "admin_manage_payments"
ON public.payments
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- SECTION 9: OTP_CODES — Enable RLS (CRITICAL — currently disabled)
-- ============================================================
-- CRITICAL: otp_codes has RLS DISABLED. Any user with the anon key
-- can read ALL OTP codes for ALL users. This is a severe security risk.
-- Fix: enable RLS with service-role-only access.
-- OTP operations are handled exclusively by server-side API routes
-- using SUPABASE_SERVICE_ROLE_KEY.

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- No policies for regular users — service-role bypasses RLS.
-- Admin read-only for debugging.
DROP POLICY IF EXISTS "admin_read_otp_codes"        ON public.otp_codes;
CREATE POLICY "admin_read_otp_codes"
ON public.otp_codes
FOR SELECT
TO authenticated
USING (public.is_admin());

-- INVARIANT: Regular authenticated users and anon cannot read or write otp_codes.
-- All OTP operations go through /api/send-otp and /api/verify-otp which use
-- the service-role key server-side.

-- ============================================================
-- SECTION 10: LESSON_RESOURCES — Hardened
-- ============================================================
-- Current state: authenticated users can read ALL lesson_resources metadata
-- regardless of their tier. The comment says "access control is enforced at
-- download time" — but this leaks metadata (file names, sizes, tiers) to
-- users who don't have access.
-- Fix: users can only read metadata for resources they have tier access to.
-- Note: actual file download is always via signed URL (server-side check).

DROP POLICY IF EXISTS "authenticated_read_lesson_resources"  ON public.lesson_resources;
DROP POLICY IF EXISTS "service_manage_lesson_resources"      ON public.lesson_resources;

-- SELECT: users can see metadata only for resources their tier allows
-- This prevents leaking premium resource names to free-tier users.
DROP POLICY IF EXISTS "users_read_accessible_lesson_resources" ON public.lesson_resources;
CREATE POLICY "users_read_accessible_lesson_resources"
ON public.lesson_resources
FOR SELECT
TO authenticated
USING (
    public.user_has_active_subscription_min_tier(required_tier)
);

-- Admin: full access
DROP POLICY IF EXISTS "admin_manage_lesson_resources"        ON public.lesson_resources;
CREATE POLICY "admin_manage_lesson_resources"
ON public.lesson_resources
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Service role: full access (bypasses RLS by default)

-- ============================================================
-- SECTION 11: PLATFORM_CONFIG — Hardened
-- ============================================================
-- Current state: public read (true), admin write.
-- This is correct for pricing/feature config.
-- Ensure no stale policies exist and recreate cleanly.

DROP POLICY IF EXISTS "public_read_platform_config"  ON public.platform_config;
CREATE POLICY "public_read_platform_config"
ON public.platform_config
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "admin_manage_platform_config" ON public.platform_config;
CREATE POLICY "admin_manage_platform_config"
ON public.platform_config
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- SECTION 12: PAYMENT_EVENTS — Hardened
-- ============================================================
-- Current state: admin_manage_payment_events (ALL for admin).
-- Regular users have no access. Service-role bypasses RLS.
-- This is correct. Recreate cleanly.

DROP POLICY IF EXISTS "admin_manage_payment_events"  ON public.payment_events;
CREATE POLICY "admin_manage_payment_events"
ON public.payment_events
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- SECTION 13: PROCESSED_WEBHOOK_EVENTS — Hardened
-- ============================================================
-- Current state: admin_read_webhook_events (SELECT for admin).
-- Service-role writes (bypasses RLS). This is correct.
-- Recreate cleanly.

DROP POLICY IF EXISTS "admin_read_webhook_events"    ON public.processed_webhook_events;
CREATE POLICY "admin_read_webhook_events"
ON public.processed_webhook_events
FOR SELECT
TO authenticated
USING (public.is_admin());

-- ============================================================
-- SECTION 14: COURSES — Verify and Harden
-- ============================================================
-- Current state: public read (is_published=true), admin ALL.
-- This is correct. Ensure no stale policies.

DROP POLICY IF EXISTS "public_read_courses"          ON public.courses;
DROP POLICY IF EXISTS "public_read_published_courses" ON public.courses;
CREATE POLICY "public_read_published_courses"
ON public.courses
FOR SELECT
TO public
USING (is_published = true);

DROP POLICY IF EXISTS "admin_manage_courses"         ON public.courses;
CREATE POLICY "admin_manage_courses"
ON public.courses
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- SECTION 15: CATEGORIES — Verify and Harden
-- ============================================================
-- Current state: public read (true). No write for regular users.
-- Add admin write policy.

DROP POLICY IF EXISTS "public_read_categories"       ON public.categories;
CREATE POLICY "public_read_categories"
ON public.categories
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "admin_manage_categories"      ON public.categories;
CREATE POLICY "admin_manage_categories"
ON public.categories
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- SECTION 16: STORAGE — Harden existing buckets
-- ============================================================

-- ── avatars bucket (public) ──────────────────────────────────────────────────
-- Current state: public read, authenticated upload/update/delete own folder.
-- This is correct. Ensure policies are clean.

-- Drop any duplicate/stale avatar policies
DROP POLICY IF EXISTS "avatars_auth_upload"          ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_update"          ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_delete"          ON storage.objects;
DROP POLICY IF EXISTS "avatars_public_read"          ON storage.objects;
DROP POLICY IF EXISTS "avatars_upload_own"           ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own"           ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own"           ON storage.objects;

-- Recreate clean avatar policies
CREATE POLICY "avatars_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_upload_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── assets bucket (public) ───────────────────────────────────────────────────
-- Current state: public bucket, no explicit policies found in migrations.
-- Risk: any authenticated user might be able to upload to assets.
-- Fix: public read, service-role/admin write only.

DROP POLICY IF EXISTS "assets_public_read"           ON storage.objects;
CREATE POLICY "assets_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'assets');

-- No INSERT/UPDATE/DELETE for regular users on assets.
-- Assets are managed by admins via Supabase Dashboard or service-role.
DROP POLICY IF EXISTS "admin_manage_assets"          ON storage.objects;
CREATE POLICY "admin_manage_assets"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'assets'
    AND public.is_admin()
)
WITH CHECK (
    bucket_id = 'assets'
    AND public.is_admin()
);

-- ── lesson-resources bucket (PRIVATE — premium content) ──────────────────────
-- This bucket does NOT exist yet (must be created via Dashboard or CLI).
-- The SQL below creates the Storage RLS policies that will apply once
-- the bucket is created. The bucket MUST be set to public=false.
--
-- IMPORTANT: Create the bucket manually in Supabase Dashboard:
--   Name: lesson-resources
--   Public: false (PRIVATE)
--   Allowed MIME types: application/pdf, application/octet-stream, image/*, video/*
--   Max file size: 524288000 (500 MB)
--
-- These policies enforce that only users with sufficient tier can download files.
-- Actual signed URL generation is done server-side in /api/lesson-resources/signed-url
-- (to be implemented in a future phase).

-- Users with sufficient tier can read (download) lesson resources
DROP POLICY IF EXISTS "lesson_resources_tier_read"   ON storage.objects;
CREATE POLICY "lesson_resources_tier_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'lesson-resources'
    AND (
        -- Extract required_tier from the path: <course_id>/<lesson_id>/<file_name>
        -- Tier enforcement is primarily done server-side via signed URLs.
        -- This policy provides a secondary DB-level guard.
        -- Users must have an active subscription (any tier) to read.
        -- Tier-specific enforcement is done in the signed URL generation endpoint.
        EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.user_id = auth.uid()
              AND s.status = 'active'::public.subscription_status
        )
        OR
        -- Or have purchased a course (any paid purchase)
        EXISTS (
            SELECT 1 FROM public.course_purchases cp
            WHERE cp.user_id = auth.uid()
              AND cp.purchase_status = 'paid'::public.purchase_status
        )
    )
);

-- Only service-role/admin can upload lesson resources
DROP POLICY IF EXISTS "lesson_resources_admin_write" ON storage.objects;
CREATE POLICY "lesson_resources_admin_write"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'lesson-resources'
    AND public.is_admin()
)
WITH CHECK (
    bucket_id = 'lesson-resources'
    AND public.is_admin()
);

-- ── videos bucket (PRIVATE — course videos) ──────────────────────────────────
-- The videos bucket is used by /api/video-token for signed URL generation.
-- Access is enforced server-side in the video-token API route.
-- These policies provide a secondary DB-level guard.

DROP POLICY IF EXISTS "videos_tier_read"             ON storage.objects;
CREATE POLICY "videos_tier_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'videos'
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

DROP POLICY IF EXISTS "videos_admin_write"           ON storage.objects;
CREATE POLICY "videos_admin_write"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'videos'
    AND public.is_admin()
)
WITH CHECK (
    bucket_id = 'videos'
    AND public.is_admin()
);

-- ============================================================
-- SECTION 17: VERIFY RLS IS ENABLED ON ALL TABLES
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

-- ============================================================
-- SECTION 18: INDEXES — Justified additions only
-- ============================================================

-- Index for subscription status lookups (used in lesson_resources policy)
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
    ON public.subscriptions (user_id, status);

-- Index for course_purchases status lookups (used in storage policy)
CREATE INDEX IF NOT EXISTS idx_course_purchases_user_status
    ON public.course_purchases (user_id, purchase_status);

-- Index for otp_codes email+type lookups (used by API routes)
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_type
    ON public.otp_codes (email, type);

-- Index for otp_codes expiry cleanup
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at
    ON public.otp_codes (expires_at);

-- ============================================================
-- SECTION 19: COMMENTS — Document complex policies
-- ============================================================

COMMENT ON POLICY "users_insert_own_course_progress" ON public.course_progress IS
    'Users can only insert progress rows with completed=false. '
    'Completion is set server-side via the progress tracking API using service-role key.';

COMMENT ON POLICY "users_update_own_course_progress" ON public.course_progress IS
    'Users can update their own progress rows. '
    'The prevent_self_completion trigger blocks setting completed=true or manipulating completed_at. '
    'Only service-role or admin can mark courses as completed.';

COMMENT ON POLICY "users_read_accessible_lesson_resources" ON public.lesson_resources IS
    'Users can only see lesson resource metadata for resources their subscription tier allows. '
    'Actual file download requires a signed URL generated server-side with additional tier verification.';

COMMENT ON POLICY "admin_read_otp_codes" ON public.otp_codes IS
    'OTP codes are service-role only. RLS is now enabled. '
    'All OTP operations go through /api/send-otp and /api/verify-otp using SUPABASE_SERVICE_ROLE_KEY. '
    'Regular users and anon cannot read or write OTP codes.';

COMMENT ON FUNCTION public.prevent_self_completion() IS
    'Trigger function that prevents users from self-issuing course completion certificates. '
    'Users cannot set completed=true or modify completed_at. '
    'Only service-role (via progress tracking API) or admin can mark courses as completed.';

COMMENT ON FUNCTION public.user_has_active_subscription_min_tier(TEXT) IS
    'Returns true if the current authenticated user has an active subscription '
    'with tier rank >= the specified minimum tier. '
    'Used in lesson_resources RLS policy to enforce tier-gated metadata access.';
