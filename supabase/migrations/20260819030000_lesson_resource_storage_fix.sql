-- ============================================================
-- GLEW Studio — Fase 2 Critical Storage Fix
-- Migration: 20260819030000_lesson_resource_storage_fix.sql
--
-- AUDIT FINDING (Independent Audit — Fase 2 Post-Approval):
--
--   BYPASS VULNERABILITY in lesson_resources_tier_select policy:
--
--   The previous policy used:
--     public.user_can_access_course_content(split_part(name, '/', 1)::UUID)
--
--   user_can_access_course_content() checks ONLY courses.minimum_tier.
--   But generateSignedDownloadUrl() checks lesson_resources.required_tier.
--
--   These are TWO DIFFERENT fields — a resource can have a higher required_tier
--   than its course's minimum_tier. This creates a bypass:
--
--   EXAMPLE:
--     Course:   minimum_tier = 'apertura'
--     Resource: required_tier = 'diafragma'
--     User:     subscription tier = 'apertura'
--
--     generateSignedDownloadUrl():
--       apertura rank 1 < diafragma rank 3 → DENIED ✅
--
--     Storage policy (OLD — VULNERABLE):
--       user_can_access_course_content() → courses.minimum_tier = 'apertura'
--       apertura rank 1 >= apertura rank 1 → PERMITTED ← BYPASS ❌
--
--   A user knowing the storage path could bypass generateSignedDownloadUrl()
--   and access the object directly via the Storage API.
--
-- FIX:
--   1. Create user_can_access_lesson_resource(p_storage_path TEXT) — SECURITY DEFINER
--      This function:
--        a. Extracts course UUID from the first path segment
--        b. Looks up the exact lesson_resources row matching storage_path
--        c. Validates the EXACT storage_path match (prevents path manipulation)
--        d. Gets lesson_resources.required_tier (not courses.minimum_tier)
--        e. Compares required_tier against user's active subscription tier
--        f. Also allows access if user has paid course purchase
--        g. Denies if no matching lesson_resources row exists
--        h. Denies if required_tier is unknown/invalid (rank = 0)
--        i. Admin bypass via is_admin()
--
--   2. Replace lesson_resources_tier_select policy to use the new function.
--
--   3. Videos bucket policy is NOT changed — user_can_access_course_content()
--      is correct for videos (courses.minimum_tier is the right gate for video access).
--
-- SECURITY INVARIANTS AFTER FIX:
--   ✅ Storage policy for lesson-resources now checks lesson_resources.required_tier
--   ✅ Storage policy and generateSignedDownloadUrl() use the SAME source of truth
--   ✅ No path can grant access unless a matching lesson_resources row exists
--   ✅ Path manipulation is ineffective (exact storage_path match required)
--   ✅ Unknown/invalid tiers are denied by default (rank = 0 < any valid rank)
--   ✅ Admin bypass preserved
--   ✅ Videos policy unchanged (user_can_access_course_content still correct)
-- ============================================================

-- ============================================================
-- STEP 1: Create user_can_access_lesson_resource()
-- ============================================================
-- This function is the authoritative gate for lesson-resources Storage access.
-- It mirrors the logic of generateSignedDownloadUrl() exactly, ensuring
-- both the server-side action and the Storage policy use the same source of truth.
--
-- SECURITY DEFINER: runs with elevated privileges to read lesson_resources,
-- subscriptions, and course_purchases tables within a Storage policy context.
--
-- PARAMETERS:
--   p_storage_path TEXT — the exact storage object name (storage.objects.name)
--                         e.g. "550e8400-e29b-41d4-a716-446655440000/lesson-1/guide.pdf"
--
-- RETURNS:
--   TRUE  — user is allowed to access this object
--   FALSE — user is denied (any reason: not authenticated, no matching resource,
--            insufficient tier, invalid tier, no paid purchase)
--
-- DENIAL REASONS (all return FALSE):
--   1. User not authenticated (auth.uid() IS NULL)
--   2. First path segment is not a valid UUID (cast fails → caught by exception)
--   3. No lesson_resources row with storage_path = p_storage_path
--   4. required_tier is unknown/invalid (get_tier_rank returns 0)
--   5. User has no active subscription AND no paid purchase
--   6. User subscription tier rank < required_tier rank
--   7. User purchase exists but purchase_status != 'paid'

CREATE OR REPLACE FUNCTION public.user_can_access_lesson_resource(p_storage_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $func$
DECLARE
    v_user_id         UUID;
    v_course_id       UUID;
    v_required_tier   TEXT;
    v_required_rank   INTEGER;
    v_user_tier       TEXT;
    v_user_rank       INTEGER;
BEGIN
    -- ── STEP 1: Require authenticated user ────────────────────────────────────
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- ── STEP 2: Extract course UUID from first path segment ───────────────────
    -- Path format: <course_uuid>/<lesson_id>/<file_name>
    -- split_part returns empty string if no '/' found — cast to UUID will fail.
    BEGIN
        v_course_id := split_part(p_storage_path, '/', 1)::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        -- First segment is not a valid UUID (e.g. a slug like 'iluminacion-rembrandt-retrato')
        -- → DENY. This also blocks path manipulation with non-UUID prefixes.
        RETURN FALSE;
    END;

    -- ── STEP 3: Find the EXACT lesson_resources row matching this storage_path ─
    -- The storage_path in lesson_resources must match EXACTLY the object name.
    -- This prevents a user from constructing an alternative path that maps to
    -- a different resource row.
    -- If no row exists → DENY (objects without a lesson_resources record are blocked).
    SELECT required_tier::TEXT INTO v_required_tier
    FROM public.lesson_resources
    WHERE storage_path = p_storage_path
      AND course_id::TEXT = v_course_id::TEXT
    LIMIT 1;

    IF NOT FOUND OR v_required_tier IS NULL THEN
        -- No matching lesson_resources row → DENY
        -- This covers: objects in Storage that have no corresponding DB record
        RETURN FALSE;
    END IF;

    -- ── STEP 4: Validate required_tier ────────────────────────────────────────
    -- get_tier_rank returns 0 for unknown tiers.
    -- A rank of 0 means the tier is invalid → DENY by default.
    v_required_rank := public.get_tier_rank(v_required_tier);
    IF v_required_rank = 0 THEN
        -- Unknown/invalid tier → DENY (fail-secure)
        RETURN FALSE;
    END IF;

    -- ── STEP 5: Admin bypass ──────────────────────────────────────────────────
    IF public.is_admin() THEN
        RETURN TRUE;
    END IF;

    -- ── STEP 6: Check active subscription with sufficient tier ────────────────
    SELECT tier::TEXT INTO v_user_tier
    FROM public.subscriptions
    WHERE user_id = v_user_id
      AND status = 'active'::public.subscription_status
    LIMIT 1;

    IF v_user_tier IS NOT NULL THEN
        v_user_rank := public.get_tier_rank(v_user_tier);
        IF v_user_rank >= v_required_rank THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- ── STEP 7: Check paid course purchase ────────────────────────────────────
    -- SECURITY: purchase_status MUST be exactly 'paid'.
    -- pending / refunded / failed / chargeback → DENY.
    IF EXISTS (
        SELECT 1 FROM public.course_purchases
        WHERE user_id = v_user_id
          AND course_id = v_course_id
          AND purchase_status = 'paid'::public.purchase_status
    ) THEN
        RETURN TRUE;
    END IF;

    -- ── Neither condition met → DENY ──────────────────────────────────────────
    RETURN FALSE;

EXCEPTION WHEN OTHERS THEN
    -- Fail-secure: any unexpected error → DENY
    RETURN FALSE;
END;
$func$;

COMMENT ON FUNCTION public.user_can_access_lesson_resource(TEXT) IS
    'SECURITY DEFINER function for lesson-resources Storage policy. '
    'Checks lesson_resources.required_tier (NOT courses.minimum_tier) against '
    'the current user''s active subscription tier or paid course purchase. '
    'PARAMETERS: p_storage_path = storage.objects.name (exact object path). '
    'RETURNS TRUE if: '
    '  A. User is admin (is_admin() = TRUE), OR '
    '  B. User has active subscription with tier rank >= required_tier rank, OR '
    '  C. User has course_purchases.purchase_status = ''paid'' for the course. '
    'RETURNS FALSE if: '
    '  - User not authenticated '
    '  - First path segment is not a valid UUID '
    '  - No lesson_resources row with storage_path = p_storage_path '
    '  - required_tier is unknown/invalid (rank = 0) '
    '  - User subscription tier rank < required_tier rank '
    '  - Purchase exists but purchase_status != ''paid'' '
    '  - Any unexpected error (fail-secure) '
    'SECURITY: '
    '  - Uses lesson_resources.required_tier as single source of truth '
    '  - Exact storage_path match prevents path manipulation '
    '  - Objects without a lesson_resources record are always denied '
    '  - Mirrors generateSignedDownloadUrl() logic exactly '
    'Phase 2 Critical Fix — Fase 2 Post-Approval Audit.';

-- ============================================================
-- STEP 2: Replace lesson_resources_tier_select policy
-- ============================================================
-- Drop the old policy that used user_can_access_course_content()
-- (which checked courses.minimum_tier — wrong source of truth for resources).
DROP POLICY IF EXISTS "lesson_resources_tier_select"  ON storage.objects;
DROP POLICY IF EXISTS "lesson_resources_admin_all"    ON storage.objects;

-- New policy: uses user_can_access_lesson_resource() which checks
-- lesson_resources.required_tier — the correct source of truth.
--
-- POLICY LOGIC:
--   1. Object must be in 'lesson-resources' bucket
--   2. Call user_can_access_lesson_resource(name) with the ACTUAL object path
--      - Extracts course UUID from path (validates it is a UUID)
--      - Finds the exact lesson_resources row matching storage_path
--      - Checks required_tier against user subscription tier
--      - OR checks paid course purchase
--      - Denies if no matching row exists
--      - Denies if required_tier is invalid
--
-- TEST A PROOF (Bypass scenario — now FIXED):
--   Course:   minimum_tier = 'apertura'
--   Resource: required_tier = 'diafragma'
--   User:     subscription tier = 'apertura'
--   Object:   lesson-resources/<course_uuid>/lesson-1/guide.pdf
--
--   OLD policy (VULNERABLE):
--     user_can_access_course_content(<course_uuid>)
--     → courses.minimum_tier = 'apertura'
--     → apertura rank 1 >= apertura rank 1 → TRUE ← BYPASS
--
--   NEW policy (FIXED):
--     user_can_access_lesson_resource('<course_uuid>/lesson-1/guide.pdf')
--     → lesson_resources.required_tier = 'diafragma'
--     → apertura rank 1 < diafragma rank 3 → FALSE → DENIED ✅
--
-- TEST B PROOF:
--   Course:   minimum_tier = 'apertura'
--   Resource: required_tier = 'diafragma'
--   User:     subscription tier = 'diafragma'
--   → diafragma rank 3 >= diafragma rank 3 → TRUE → ALLOWED ✅
--
-- TEST C PROOF:
--   Course:   minimum_tier = 'diafragma'
--   Resource: required_tier = 'diafragma'
--   User:     subscription tier = 'apertura'
--   → apertura rank 1 < diafragma rank 3 → FALSE → DENIED ✅
--
-- TEST D PROOF:
--   User:     subscription tier = 'apertura'
--   Purchase: course_purchases.purchase_status = 'paid' for this course
--   → paid purchase check → TRUE → ALLOWED ✅
--
-- TEST E PROOF:
--   Purchase: purchase_status = 'pending'
--   → purchase_status != 'paid' → FALSE → DENIED ✅
--
-- TEST F PROOF:
--   Purchase: purchase_status = 'refunded'
--   → purchase_status != 'paid' → FALSE → DENIED ✅
--
-- TEST G PROOF (path manipulation):
--   User constructs path: <course_uuid>/lesson-1/../../other-resource.pdf
--   → storage_path = '<course_uuid>/lesson-1/../../other-resource.pdf'
--   → No lesson_resources row with this exact storage_path → NOT FOUND → DENIED ✅
--   (Supabase Storage also normalizes paths, but the exact-match requirement
--    provides defense-in-depth against any path traversal attempt.)
--
-- TEST H PROOF (object in Storage but no lesson_resources row):
--   Object exists in Storage bucket but no lesson_resources record
--   → SELECT required_tier FROM lesson_resources WHERE storage_path = ... → NOT FOUND
--   → RETURN FALSE → DENIED ✅
--
-- TEST I PROOF (unauthenticated):
--   auth.uid() IS NULL → RETURN FALSE → DENIED ✅
--
-- TEST J PROOF (admin):
--   is_admin() = TRUE → RETURN TRUE → ALLOWED ✅

CREATE POLICY "lesson_resources_tier_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'lesson-resources'
    AND public.user_can_access_lesson_resource(name)
);

COMMENT ON POLICY "lesson_resources_tier_select" ON storage.objects IS
    'TIER-AWARE storage policy for lesson-resources bucket. '
    'Uses user_can_access_lesson_resource(name) which checks '
    'lesson_resources.required_tier (NOT courses.minimum_tier). '
    'This ensures the Storage policy and generateSignedDownloadUrl() '
    'use the SAME source of truth for access control. '
    'SECURITY: '
    '  - required_tier comes from lesson_resources table (not courses) '
    '  - Exact storage_path match prevents path manipulation '
    '  - Objects without a lesson_resources record are always denied '
    '  - purchase_status must be exactly ''paid'' '
    '  - Admin bypass via is_admin() '
    'REPLACES: lesson_resources_tier_select (which used user_can_access_course_content '
    '          and checked courses.minimum_tier — wrong source of truth). '
    'Phase 2 Critical Fix — Fase 2 Post-Approval Audit.';

-- Restore admin write policy for lesson-resources
CREATE POLICY "lesson_resources_admin_all"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'lesson-resources' AND public.is_admin())
WITH CHECK (bucket_id = 'lesson-resources' AND public.is_admin());

-- ============================================================
-- STEP 3: Videos policy — NO CHANGE
-- ============================================================
-- The videos_tier_select policy correctly uses user_can_access_course_content()
-- which checks courses.minimum_tier. For videos, the course's minimum_tier IS
-- the correct gate — there is no per-video required_tier field.
-- This migration does NOT modify the videos policy.

-- ============================================================
-- CONCEPTUAL TEST SUMMARY
-- ============================================================
--
-- TEST A: Course apertura + resource diafragma + user apertura
--   user_can_access_lesson_resource():
--     required_tier = 'diafragma' (rank 3)
--     user tier = 'apertura' (rank 1)
--     1 < 3 → FALSE
--     No paid purchase → FALSE
--   Storage: DENIED ✅
--
-- TEST B: Course apertura + resource diafragma + user diafragma
--   user_can_access_lesson_resource():
--     required_tier = 'diafragma' (rank 3)
--     user tier = 'diafragma' (rank 3)
--     3 >= 3 → TRUE
--   Storage: ALLOWED ✅
--
-- TEST C: Course diafragma + resource diafragma + user apertura
--   user_can_access_lesson_resource():
--     required_tier = 'diafragma' (rank 3)
--     user tier = 'apertura' (rank 1)
--     1 < 3 → FALSE
--     No paid purchase → FALSE
--   Storage: DENIED ✅
--
-- TEST D: User apertura + paid purchase of the course
--   user_can_access_lesson_resource():
--     required_tier = 'diafragma' (rank 3)
--     user tier = 'apertura' (rank 1) → 1 < 3 → FALSE
--     course_purchases.purchase_status = 'paid' → TRUE
--   Storage: ALLOWED ✅
--
-- TEST E: pending purchase
--   user_can_access_lesson_resource():
--     purchase_status = 'pending' ≠ 'paid' → FALSE
--     No active subscription with sufficient tier → FALSE
--   Storage: DENIED ✅
--
-- TEST F: refunded purchase
--   user_can_access_lesson_resource():
--     purchase_status = 'refunded' ≠ 'paid' → FALSE
--     No active subscription with sufficient tier → FALSE
--   Storage: DENIED ✅
--
-- TEST G: Manipulated path
--   user_can_access_lesson_resource('<uuid>/../../other.pdf'):
--     No lesson_resources row with storage_path = '<uuid>/../../other.pdf' → NOT FOUND
--   Storage: DENIED ✅
--
-- TEST H: Object in Storage but no lesson_resources row
--   user_can_access_lesson_resource('<uuid>/lesson-1/orphan.pdf'):
--     No lesson_resources row with this storage_path → NOT FOUND
--   Storage: DENIED ✅
--
-- TEST I: Unauthenticated user
--   user_can_access_lesson_resource():
--     auth.uid() IS NULL → RETURN FALSE
--   Storage: DENIED ✅
--
-- TEST J: Admin
--   user_can_access_lesson_resource():
--     is_admin() = TRUE → RETURN TRUE
--   Storage: ALLOWED ✅
