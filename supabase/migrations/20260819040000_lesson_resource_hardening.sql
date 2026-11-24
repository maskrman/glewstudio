-- ============================================================
-- GLEW Studio — Fase 2.1 Hardening Post-Auditoría
-- Migration: 20260819040000_lesson_resource_hardening.sql
--
-- CHANGES IN THIS MIGRATION:
--
--   1. Add SET search_path = public, auth, extensions to
--      user_can_access_lesson_resource(TEXT).
--      Reason: SECURITY DEFINER functions must pin their search_path
--      to prevent schema injection via objects with the same name
--      as internal functions (get_tier_rank, is_admin, auth.uid).
--      CIS PostgreSQL Benchmark — hardening standard.
--
--   2. Add GRANT EXECUTE ON FUNCTION user_can_access_lesson_resource(TEXT)
--      TO authenticated.
--      Reason: The Storage policy calls this function as the 'authenticated'
--      role. Without the GRANT, the policy fails silently (fail-closed,
--      not a bypass), but legitimate users with sufficient tier are also
--      denied. The GRANT ensures correct behavior for authorized users.
--
-- INVARIANTS PRESERVED:
--   - SECURITY DEFINER is maintained
--   - LANGUAGE plpgsql STABLE is maintained
--   - Authorization logic is NOT modified
--   - videos_tier_select is NOT modified
--   - user_can_access_course_content() is NOT modified
--   - is_admin() is NOT modified
--   - raw_app_meta_data usage is NOT modified
--   - Historical migrations are NOT modified
--   - lesson_resources.course_id TEXT is NOT modified
--     (documented as technical debt for a future referential integrity migration)
-- ============================================================

-- ============================================================
-- STEP 1: Replace function with SET search_path pinned
-- ============================================================
-- Full CREATE OR REPLACE required to add the search_path option.
-- Logic is identical to 20260819030000 — only the search_path is added.

CREATE OR REPLACE FUNCTION public.user_can_access_lesson_resource(p_storage_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, extensions
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
    -- pending / refunded / failed / chargeback / partially_refunded → DENY.
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
    'search_path is pinned to public, auth, extensions (hardening — Fase 2.1). '
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
    'Phase 2.1 Hardening — search_path pinned, GRANT EXECUTE added.';

-- ============================================================
-- STEP 2: Grant EXECUTE to authenticated role
-- ============================================================
-- The Storage policy calls this function as the 'authenticated' role.
-- Without this GRANT, the policy fails silently (fail-closed — all users
-- are denied, including those with sufficient tier). The GRANT ensures
-- correct behavior for authorized users while maintaining security.
--
-- NOTE: Absence of this GRANT is NOT a bypass — it is fail-closed.
-- The GRANT is required for the policy to function correctly.

GRANT EXECUTE
ON FUNCTION public.user_can_access_lesson_resource(TEXT)
TO authenticated;
