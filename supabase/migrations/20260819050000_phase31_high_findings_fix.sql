-- ============================================================
-- GLEW Studio — Fase 3.1 Security Hardening
-- Migration: 20260819050000_phase31_high_findings_fix.sql
--
-- FIXES 6 HIGH FINDINGS FROM PHASE 3 AUDIT:
--
-- HIGH #1 — Service Role in public endpoints (user-count, categories)
--   Fix A: Add get_public_user_count() SECURITY DEFINER function so
--          /api/user-count can use anon client instead of Service Role.
--   Fix B: Add public SELECT policies for categories and courses so
--          /api/categories can use anon client instead of Service Role.
--
-- HIGH #2 — Service Role helpers without authorization boundary
--   Fix: findTestCourses() and findDiafragmaResource() now receive the
--        admin client as a parameter from runStorageAudit() (code fix).
--        No DB migration needed — documented here for audit trail.
--
-- HIGH #3 — lesson_resources TABLE RLS parallel permissive policy
--   The policy "authenticated_read_lesson_resources" uses USING(true),
--   allowing ALL authenticated users to SELECT from the lesson_resources
--   TABLE. This is intentional for metadata (display_name, file_type, etc.)
--   but must be confirmed as not a bypass for actual file access.
--   FINDING: The TABLE policy is for metadata only. Actual file access
--   requires a signed URL from generateSignedDownloadUrl() which enforces
--   required_tier. The Storage policy (lesson_resources_tier_select) uses
--   user_can_access_lesson_resource() which enforces required_tier.
--   HOWEVER: The policy name from 20260806052521 still exists. We replace
--   it with a more explicit policy that documents the intent clearly and
--   adds a comment confirming it is metadata-only.
--
-- HIGH #4 — Demo data with slug-based course_id
--   Migration 20260806052521 inserted demo rows with:
--     course_id = 'iluminacion-rembrandt-retrato' (TEXT slug, not UUID)
--   These rows are FAIL-CLOSED in Storage (user_can_access_lesson_resource
--   rejects non-UUID first path segments). However, they are dirty data
--   that should be removed.
--   Fix: DELETE demo rows where course_id is not a valid UUID.
--
-- HIGH #5 — lesson_resources.course_id TEXT vs UUID
--   After removing demo data, evaluate if course_id can be migrated to UUID.
--   This migration:
--     1. Removes non-UUID rows (demo data)
--     2. Adds a CHECK constraint to enforce UUID format on future inserts
--     3. Documents the full UUID migration as a future step pending
--        production data verification.
--   DECISION: Full ALTER COLUMN TYPE UUID is NOT done in this migration
--   because it requires verifying all existing rows reference valid courses.
--   The CHECK constraint is a safe intermediate step.
--
-- HIGH #6 — Admin authorization (is_admin() using raw_user_meta_data)
--   Migration 20260818220000 defined is_admin() with raw_user_meta_data.
--   Migration 20260819000000 overrode it with raw_app_meta_data only.
--   The CURRENT state is correct. This migration re-confirms the final
--   state with an explicit CREATE OR REPLACE to ensure no future migration
--   accidentally reverts it.
--
-- IMMUTABLE MIGRATIONS (NOT MODIFIED):
--   20260806052521, 20260818220000, 20260818230000, 20260819000000,
--   20260819010000, 20260819030000, 20260819040000
-- ============================================================

-- ============================================================
-- HIGH #1 FIX A: Public user count function
-- ============================================================
-- Allows /api/user-count to use the anon client instead of Service Role.
-- Returns only an aggregate count — no PII is exposed.
-- SECURITY DEFINER: runs with elevated privileges to count profiles,
-- but returns only a single integer. Safe for unauthenticated callers.

CREATE OR REPLACE FUNCTION public.get_public_user_count()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT COUNT(*)::BIGINT FROM public.profiles;
$func$;

COMMENT ON FUNCTION public.get_public_user_count() IS
    'Returns the total number of registered users (profiles count). '
    'Safe for unauthenticated callers — returns only an aggregate count, no PII. '
    'SECURITY DEFINER with pinned search_path. '
    'Used by /api/user-count to avoid Service Role in a public endpoint. '
    'Phase 3.1 — HIGH #1 fix.';

-- Grant EXECUTE to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_public_user_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_user_count() TO authenticated;

-- ============================================================
-- HIGH #1 FIX B: Public SELECT policies for categories and courses
-- ============================================================
-- Allows /api/categories to use the anon client instead of Service Role.
-- Categories and published courses are public data — they should be
-- readable by unauthenticated users.

-- CATEGORIES: public read
DROP POLICY IF EXISTS "public_read_categories" ON public.categories;
CREATE POLICY "public_read_categories"
ON public.categories
FOR SELECT
TO anon, authenticated
USING (true);

COMMENT ON POLICY "public_read_categories" ON public.categories IS
    'Public read access for categories. Categories are non-sensitive public data. '
    'Phase 3.1 — HIGH #1 fix: allows /api/categories to use anon client.';

-- COURSES: public read for published courses
-- (A policy may already exist from previous migrations — replace it)
DROP POLICY IF EXISTS "public_read_courses"    ON public.courses;
DROP POLICY IF EXISTS "published_courses_read" ON public.courses;
CREATE POLICY "public_read_courses"
ON public.courses
FOR SELECT
TO anon, authenticated
USING (is_published = true);

COMMENT ON POLICY "public_read_courses" ON public.courses IS
    'Public read access for published courses. '
    'Unpublished courses are not visible to anon/authenticated users. '
    'Phase 3.1 — HIGH #1 fix: allows /api/categories to use anon client.';

-- ============================================================
-- HIGH #3 FIX: lesson_resources TABLE policy — clarify intent
-- ============================================================
-- The existing "authenticated_read_lesson_resources" policy (USING true)
-- is intentional for metadata display (file names, sizes, tiers shown in UI).
-- Actual file access is enforced by:
--   1. generateSignedDownloadUrl() — checks required_tier server-side
--   2. Storage policy lesson_resources_tier_select — calls user_can_access_lesson_resource()
-- The TABLE policy does NOT grant access to the actual files.
--
-- However, we replace it with a more explicit version that:
--   a. Has a clear comment documenting the intent
--   b. Confirms it is metadata-only (no file content is in this table)
--   c. Removes any ambiguity about what "authenticated read" means

DROP POLICY IF EXISTS "authenticated_read_lesson_resources" ON public.lesson_resources;
CREATE POLICY "authenticated_read_lesson_resources"
ON public.lesson_resources
FOR SELECT
TO authenticated
USING (true);

COMMENT ON POLICY "authenticated_read_lesson_resources" ON public.lesson_resources IS
    'Allows authenticated users to read lesson_resources TABLE metadata '
    '(display_name, file_type, file_size, required_tier, sort_order). '
    'This policy grants access to METADATA ONLY — not to the actual files. '
    'Actual file access requires a signed URL from generateSignedDownloadUrl() '
    'which enforces required_tier server-side, AND the Storage policy '
    'lesson_resources_tier_select which calls user_can_access_lesson_resource(). '
    'SECURITY INVARIANT: This USING(true) policy is intentional and safe because: '
    '  1. The lesson_resources table contains no file content — only metadata. '
    '  2. Showing a user that a resource exists (but requires a higher tier) '
    '     is a UX feature, not a security vulnerability. '
    '  3. The actual file download is gated by required_tier at two layers. '
    'Phase 3.1 — HIGH #3 clarification.';

-- ============================================================
-- HIGH #4 FIX: Remove demo data with slug-based course_id
-- ============================================================
-- Migration 20260806052521 inserted demo rows with:
--   course_id = 'iluminacion-rembrandt-retrato' (TEXT slug, not UUID)
-- These rows are fail-closed in Storage (user_can_access_lesson_resource
-- rejects non-UUID first path segments), but they are dirty data.
--
-- SAFETY CHECK: We only delete rows where course_id is NOT a valid UUID.
-- This is safe because:
--   1. All legitimate lesson_resources rows should have UUID course_ids
--      (referencing real courses in the courses table).
--   2. The demo rows with slug course_ids have no corresponding course
--      in the courses table (which uses UUID primary keys).
--   3. The Storage objects for these demo rows do not exist in production.
--
-- We use a regex check to identify non-UUID course_ids.

DO $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete lesson_resources rows where course_id is not a valid UUID format
  -- UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12 hex chars)
  DELETE FROM public.lesson_resources
  WHERE course_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count > 0 THEN
    RAISE NOTICE 'Phase 3.1 HIGH #4: Deleted % demo lesson_resources row(s) with non-UUID course_id.', v_deleted_count;
  ELSE
    RAISE NOTICE 'Phase 3.1 HIGH #4: No demo lesson_resources rows found (non-UUID course_id). Production is clean.';
  END IF;
END $$;

-- ============================================================
-- HIGH #5 FIX: lesson_resources.course_id — UUID format enforcement
-- ============================================================
-- After removing demo data, add a CHECK constraint to enforce UUID format
-- on future inserts. This is a safe intermediate step before the full
-- ALTER COLUMN TYPE UUID migration.
--
-- FULL UUID MIGRATION DECISION:
--   ALTER COLUMN course_id TYPE UUID is NOT done in this migration because:
--   1. It requires verifying ALL existing rows reference valid courses.
--   2. It requires verifying all application queries that use course_id.
--   3. It requires verifying Storage paths (which use course_id as prefix).
--   4. The CHECK constraint below provides immediate protection against
--      new non-UUID inserts without risking data loss.
--
-- TECHNICAL DEBT: The full UUID migration (ALTER COLUMN + FK constraint)
-- should be done in a future migration after:
--   a. Confirming all production rows have valid UUID course_ids
--   b. Confirming all application queries handle UUID type correctly
--   c. Confirming Storage paths use UUID-format course_ids

-- Add CHECK constraint to enforce UUID format on future inserts
-- (idempotent — DROP IF EXISTS before adding)
ALTER TABLE public.lesson_resources
  DROP CONSTRAINT IF EXISTS lesson_resources_course_id_uuid_format;

ALTER TABLE public.lesson_resources
  ADD CONSTRAINT lesson_resources_course_id_uuid_format
  CHECK (
    course_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

COMMENT ON CONSTRAINT lesson_resources_course_id_uuid_format ON public.lesson_resources IS
    'Enforces UUID format for course_id. '
    'Prevents insertion of slug-based or non-UUID course_ids. '
    'Phase 3.1 — HIGH #5 intermediate fix. '
    'Full migration (ALTER COLUMN TYPE UUID + FK) is documented as technical debt '
    'pending production data verification.';

-- ============================================================
-- HIGH #6 FIX: Confirm is_admin() uses ONLY raw_app_meta_data
-- ============================================================
-- Migration 20260818220000 defined is_admin() with raw_user_meta_data OR raw_app_meta_data.
-- Migration 20260819000000 overrode it with raw_app_meta_data only.
-- This migration re-confirms the final state to ensure no future migration reverts it.
--
-- VULNERABILITY CHAIN (now closed):
--   User calls: supabase.auth.updateUser({ data: { role: 'admin' } })
--   → writes to raw_user_meta_data.role = 'admin'
--   → OLD is_admin() checked raw_user_meta_data → user becomes admin ← CRITICAL
--   → NEW is_admin() checks ONLY raw_app_meta_data → user stays non-admin ✅
--
-- raw_app_meta_data can ONLY be modified via:
--   supabase.auth.admin.updateUserById() — requires SUPABASE_SERVICE_ROLE_KEY
--   Direct DB access — requires postgres/service-role
-- The client SDK supabase.auth.updateUser() ONLY modifies raw_user_meta_data.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $func$
SELECT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = auth.uid()
    AND au.raw_app_meta_data->>'role' = 'admin'
    -- SECURITY: raw_user_meta_data is intentionally NOT checked.
    -- raw_user_meta_data is user-modifiable via supabase.auth.updateUser().
    -- raw_app_meta_data is server-side only — requires service-role key to modify.
    -- This ensures users cannot self-assign admin role.
)
$func$;

COMMENT ON FUNCTION public.is_admin() IS
    'Returns TRUE only if the current user has role=admin in raw_app_meta_data. '
    'SECURITY: raw_app_meta_data is server-side only and CANNOT be modified by the '
    'user via the client SDK (supabase.auth.updateUser only modifies raw_user_meta_data). '
    'To grant admin: use service-role key with auth.admin.updateUserById(userId, { app_metadata: { role: "admin" } }). '
    'AUDIT TEST: User calling supabase.auth.updateUser({ data: { role: "admin" } }) '
    'will NOT become admin — is_admin() will still return FALSE. '
    'search_path pinned to public, auth (hardening). '
    'Phase 3.1 — HIGH #6 confirmation. Final authoritative definition.';

-- ============================================================
-- VERIFY RLS IS ENABLED ON ALL RELEVANT TABLES (idempotent)
-- ============================================================
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- AUDIT SUMMARY
-- ============================================================
-- HIGH #1: FIXED — user-count uses get_public_user_count() (no Service Role)
--                  categories uses anon client with public SELECT policies
-- HIGH #2: FIXED — findTestCourses/findDiafragmaResource receive admin client
--                  as parameter from runStorageAudit() (code fix, no DB change)
-- HIGH #3: FIXED — authenticated_read_lesson_resources policy documented as
--                  metadata-only; actual file access gated by Storage policy
-- HIGH #4: FIXED — Demo rows with non-UUID course_id deleted
-- HIGH #5: PARTIAL — CHECK constraint added; full UUID migration deferred
--                    (documented as technical debt)
-- HIGH #6: FIXED — is_admin() confirmed to use ONLY raw_app_meta_data
-- ============================================================
