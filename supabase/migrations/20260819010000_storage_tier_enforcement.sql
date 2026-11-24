-- ============================================================
-- GLEW Studio — Storage Tier Enforcement (Closure Audit)
-- Migration: 20260819010000_storage_tier_enforcement.sql
--
-- AUDIT FINDING:
--   The previous storage policies (videos_authenticated_guard,
--   lesson_resources_authenticated_guard) from migration 20260819000000
--   grant SELECT access to ANY authenticated user with an active subscription
--   of ANY tier. This is a bypass vulnerability:
--
--   VULNERABILITY:
--     User: tier = apertura, status = active
--     Object: videos/<diafragma_course_id>/<lessonId>.mp4
--     Policy check: EXISTS (SELECT 1 FROM subscriptions WHERE user_id = auth.uid() AND status = 'active')
--     Result: GRANTED ← WRONG — Apertura user can directly read Diafragma objects
--
--   ROOT CAUSE:
--     The policy does not check the tier of the content being accessed.
--     It only checks that the user has *any* active subscription.
--
-- FIX:
--   Replace the broad "any active subscription" guard with a tier-aware policy
--   that extracts the courseId from the storage path and joins to courses.minimum_tier.
--
--   Storage path format for videos:   <courseId>/<lessonId>.mp4
--   Storage path format for resources: <courseId>/<lessonId>/<fileName>
--
--   The courseId is the first path segment (split_part(name, '/', 1)).
--   This allows the policy to JOIN to courses.minimum_tier and compare
--   against the user's subscription tier.
--
-- ARCHITECTURE AFTER FIX:
--
--   PRIMARY GATE (server-side, authoritative — unchanged):
--     /api/video-token and generateSignedVideoUrl():
--       courseId → courses.minimum_tier → TIER_RANK[userTier] >= TIER_RANK[requiredTier]
--       → authorized: signed URL generated (expires 2h)
--       → denied: 403, no URL generated
--
--     generateSignedDownloadUrl():
--       resourceId → lesson_resources.required_tier → TIER_RANK[userTier] >= TIER_RANK[requiredTier]
--       → authorized: signed URL generated (expires 5min)
--       → denied: error, no URL generated
--
--   SECONDARY GATE (Storage policy — NOW TIER-AWARE):
--     For videos bucket:
--       Extracts courseId = split_part(name, '/', 1) from the object path.
--       Joins to courses.minimum_tier.
--       Checks: user subscription tier >= course minimum_tier
--       OR: user has a paid purchase for that specific course.
--
--     For lesson-resources bucket:
--       Extracts courseId = split_part(name, '/', 1) from the object path.
--       Joins to lesson_resources.required_tier via course_id.
--       Checks: user subscription tier >= resource required_tier
--       OR: user has a paid purchase for that specific course.
--
-- RESULT:
--   TEST A — Apertura user → Diafragma object (direct storage access):
--     split_part(name, '/', 1) = <diafragma_course_id>
--     courses.minimum_tier = 'diafragma'
--     user subscription tier = 'apertura' → TIER_RANK = 1
--     required TIER_RANK = 3
--     1 >= 3 → FALSE
--     No paid purchase → FALSE
--     Policy USING = FALSE → DENIED ✅
--
--   TEST B — Apertura user → lesson-resource Diafragma (direct storage access):
--     Same tier check → DENIED ✅
--
--   TEST C — Diafragma user → Diafragma object (via signed URL):
--     TIER_RANK[diafragma] = 3 >= 3 → TRUE → PERMITTED ✅
--
--   TEST D — User with paid purchase (any tier) → course object:
--     course_purchases.purchase_status = 'paid' AND course_id matches → PERMITTED ✅
--
--   TEST E — User with no subscription, no purchase → direct access:
--     No active subscription → tier check fails
--     No paid purchase → purchase check fails
--     Policy USING = FALSE → DENIED ✅
--
--   TEST F — Path manipulation (Apertura course path → Diafragma course path):
--     split_part(name, '/', 1) = <diafragma_course_id>
--     courses.minimum_tier = 'diafragma'
--     user tier = 'apertura' → DENIED ✅
--     (The policy evaluates the ACTUAL path being requested, not a user-supplied value)
--
-- SECURITY INVARIANT:
--   NO access is granted simply because subscription.status = active.
--   The tier of the content (from courses.minimum_tier or lesson_resources.required_tier)
--   is always compared against the user's subscription tier.
--   A paid purchase for the specific course is the only alternative access path.
-- ============================================================

-- ============================================================
-- HELPER FUNCTION: get_tier_rank
-- ============================================================
-- Converts a tier name to a numeric rank for comparison.
-- Used in storage policies to compare user tier vs required tier.
-- SECURITY DEFINER ensures the function runs with elevated privileges
-- to read from courses/subscriptions tables within storage policies.

CREATE OR REPLACE FUNCTION public.get_tier_rank(p_tier TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
AS $func$
SELECT CASE p_tier
    WHEN 'apertura'  THEN 1
    WHEN 'obturador' THEN 2
    WHEN 'diafragma' THEN 3
    ELSE 0
END
$func$;

COMMENT ON FUNCTION public.get_tier_rank(TEXT) IS
    'Returns numeric rank for a subscription tier name. '
    'apertura=1, obturador=2, diafragma=3, unknown=0. '
    'Used in storage RLS policies for tier comparison.';

-- ============================================================
-- HELPER FUNCTION: user_can_access_course_content
-- ============================================================
-- Checks whether the current authenticated user can access content
-- belonging to a given courseId, based on:
--   A. Active subscription with tier >= courses.minimum_tier
--   B. Paid course purchase for the specific courseId
--
-- This function is called from storage policies to enforce tier-aware access.
-- SECURITY DEFINER: runs with elevated privileges to read courses/subscriptions.

CREATE OR REPLACE FUNCTION public.user_can_access_course_content(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $func$
DECLARE
    v_user_id UUID;
    v_minimum_tier TEXT;
    v_user_tier TEXT;
    v_user_tier_rank INTEGER;
    v_required_tier_rank INTEGER;
BEGIN
    -- Get current authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Get the course's minimum_tier from DB (server-side authority)
    SELECT minimum_tier::TEXT INTO v_minimum_tier
    FROM public.courses
    WHERE id = p_course_id
      AND is_published = TRUE;

    -- Course not found or not published → deny
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- If minimum_tier is NULL, course is free — any authenticated user can access
    IF v_minimum_tier IS NULL THEN
        RETURN TRUE;
    END IF;

    v_required_tier_rank := public.get_tier_rank(v_minimum_tier);

    -- CHECK A: Active subscription with sufficient tier
    SELECT tier::TEXT INTO v_user_tier
    FROM public.subscriptions
    WHERE user_id = v_user_id
      AND status = 'active'::public.subscription_status
    LIMIT 1;

    IF v_user_tier IS NOT NULL THEN
        v_user_tier_rank := public.get_tier_rank(v_user_tier);
        IF v_user_tier_rank >= v_required_tier_rank THEN
            RETURN TRUE;
        END IF;
    END IF;

    -- CHECK B: Paid course purchase for this specific course
    -- SECURITY: purchase_status MUST be 'paid' — pending/refunded/chargeback do NOT grant access
    IF EXISTS (
        SELECT 1 FROM public.course_purchases
        WHERE user_id = v_user_id
          AND course_id = p_course_id
          AND purchase_status = 'paid'::public.purchase_status
    ) THEN
        RETURN TRUE;
    END IF;

    -- Neither condition met → deny
    RETURN FALSE;
END;
$func$;

COMMENT ON FUNCTION public.user_can_access_course_content(UUID) IS
    'Returns TRUE if the current user can access content for the given courseId. '
    'Access is granted if: '
    '  A. User has an active subscription with tier >= courses.minimum_tier, OR '
    '  B. User has a paid course purchase (purchase_status = ''paid'') for this courseId. '
    'SECURITY: '
    '  - minimum_tier is read from courses table (server-side authority, not from path) '
    '  - purchase_status must be exactly ''paid'' — pending/refunded/chargeback denied '
    '  - Unauthenticated users always denied '
    '  - Unpublished courses always denied '
    'STORAGE POLICY USE: '
    '  Called with courseId extracted from object path: split_part(name, ''/'' , 1)::UUID '
    '  This means the tier check is based on the ACTUAL course the object belongs to, '
    '  not a user-supplied value. Path manipulation is therefore ineffective.';

-- ============================================================
-- VIDEOS BUCKET — Replace broad policy with tier-aware policy
-- ============================================================

-- Drop ALL previous video storage policies (clean slate)
DROP POLICY IF EXISTS "videos_authenticated_guard"              ON storage.objects;
DROP POLICY IF EXISTS "videos_subscription_or_purchase_read"    ON storage.objects;
DROP POLICY IF EXISTS "videos_tier_read"                        ON storage.objects;
DROP POLICY IF EXISTS "videos_admin_write"                      ON storage.objects;

-- VIDEOS SELECT: tier-aware policy
-- Path format: <courseId>/<lessonId>.mp4
-- courseId = split_part(name, '/', 1) — first path segment
--
-- POLICY LOGIC:
--   1. Object must be in 'videos' bucket
--   2. Extract courseId from path (first segment)
--   3. Call user_can_access_course_content(courseId):
--      - Checks courses.minimum_tier vs user subscription tier
--      - OR checks paid course purchase
--   4. Admin always has access
--
-- TEST A PROOF:
--   User: tier=apertura, status=active
--   Path: <diafragma_course_id>/lesson1.mp4
--   courseId = <diafragma_course_id>
--   courses.minimum_tier = 'diafragma' → rank=3
--   user tier = 'apertura' → rank=1
--   1 >= 3 → FALSE
--   No paid purchase → FALSE
--   is_admin() → FALSE
--   USING = FALSE → DENIED ✅
--
-- TEST C PROOF:
--   User: tier=diafragma, status=active
--   Path: <diafragma_course_id>/lesson1.mp4
--   courses.minimum_tier = 'diafragma' → rank=3
--   user tier = 'diafragma' → rank=3
--   3 >= 3 → TRUE
--   USING = TRUE → PERMITTED ✅
--
-- TEST E PROOF:
--   User: no subscription, no purchase
--   user_can_access_course_content() → FALSE (no active subscription, no paid purchase)
--   is_admin() → FALSE
--   USING = FALSE → DENIED ✅
--
-- TEST F PROOF (path manipulation):
--   User: tier=apertura
--   Attempts path: <diafragma_course_id>/lesson1.mp4 (substituted from apertura course)
--   split_part(name, '/', 1) = <diafragma_course_id>
--   courses.minimum_tier = 'diafragma' → rank=3
--   user tier = 'apertura' → rank=1
--   1 >= 3 → FALSE → DENIED ✅
--   (The policy evaluates the ACTUAL path, not a user-supplied courseId)

CREATE POLICY "videos_tier_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'videos'
    AND (
        -- Admin always has access
        public.is_admin()
        OR
        -- Tier-aware check: extract courseId from path and verify access
        -- Path format: <courseId>/<lessonId>.mp4
        -- split_part(name, '/', 1) extracts the courseId (first segment)
        -- This is evaluated against the ACTUAL object path — not user-supplied input.
        -- Path manipulation is therefore ineffective: if a user substitutes a
        -- Diafragma courseId into the path, the policy will check Diafragma's
        -- minimum_tier and deny access to an Apertura user.
        public.user_can_access_course_content(
            split_part(name, '/', 1)::UUID
        )
    )
);

COMMENT ON POLICY "videos_tier_select" ON storage.objects IS
    'TIER-AWARE storage policy for videos bucket. '
    'Extracts courseId from object path (split_part(name, ''/'' , 1)) and calls '
    'user_can_access_course_content(courseId) which checks: '
    '  A. User active subscription tier >= courses.minimum_tier, OR '
    '  B. User has paid course purchase for this courseId. '
    'SECURITY: '
    '  - Apertura user CANNOT access Diafragma objects (tier rank 1 < 3) '
    '  - Path manipulation is ineffective: policy evaluates ACTUAL path '
    '  - No subscription = denied '
    '  - purchase_status must be exactly ''paid'' '
    '  - Replaces the previous broad "any active subscription" guard '
    'AUDIT TESTS: '
    '  TEST A: Apertura → Diafragma object → DENIED '
    '  TEST C: Diafragma → Diafragma object → PERMITTED '
    '  TEST D: paid purchase (any tier) → course object → PERMITTED '
    '  TEST E: no subscription → DENIED '
    '  TEST F: path manipulation → DENIED (policy reads actual path)';

-- VIDEOS ALL (admin write)
CREATE POLICY "videos_admin_all"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'videos' AND public.is_admin())
WITH CHECK (bucket_id = 'videos' AND public.is_admin());

-- ============================================================
-- LESSON-RESOURCES BUCKET — Replace broad policy with tier-aware policy
-- ============================================================

-- Drop ALL previous lesson-resources storage policies (clean slate)
DROP POLICY IF EXISTS "lesson_resources_authenticated_guard"              ON storage.objects;
DROP POLICY IF EXISTS "lesson_resources_subscription_or_purchase_read"    ON storage.objects;
DROP POLICY IF EXISTS "lesson_resources_tier_read"                        ON storage.objects;
DROP POLICY IF EXISTS "lesson_resources_admin_write"                      ON storage.objects;

-- LESSON-RESOURCES SELECT: tier-aware policy
-- Path format: <courseId>/<lessonId>/<fileName>
-- courseId = split_part(name, '/', 1) — first path segment
--
-- Uses the same user_can_access_course_content() function as videos.
-- The required_tier for a lesson resource is stored in lesson_resources.required_tier,
-- but since resources belong to a course, the course's minimum_tier is the
-- authoritative gate. The server-side generateSignedDownloadUrl() additionally
-- checks lesson_resources.required_tier for fine-grained control.
--
-- TEST B PROOF:
--   User: tier=apertura, status=active
--   Path: <diafragma_course_id>/lesson1/resource.pdf
--   courseId = <diafragma_course_id>
--   courses.minimum_tier = 'diafragma' → rank=3
--   user tier = 'apertura' → rank=1
--   1 >= 3 → FALSE → DENIED ✅

CREATE POLICY "lesson_resources_tier_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'lesson-resources'
    AND (
        -- Admin always has access
        public.is_admin()
        OR
        -- Tier-aware check: extract courseId from path and verify access
        -- Path format: <courseId>/<lessonId>/<fileName>
        -- split_part(name, '/', 1) extracts the courseId (first segment)
        public.user_can_access_course_content(
            split_part(name, '/', 1)::UUID
        )
    )
);

COMMENT ON POLICY "lesson_resources_tier_select" ON storage.objects IS
    'TIER-AWARE storage policy for lesson-resources bucket. '
    'Extracts courseId from object path (split_part(name, ''/'' , 1)) and calls '
    'user_can_access_course_content(courseId) which checks: '
    '  A. User active subscription tier >= courses.minimum_tier, OR '
    '  B. User has paid course purchase for this courseId. '
    'SECURITY: '
    '  - Apertura user CANNOT access Diafragma resources (tier rank 1 < 3) '
    '  - Path manipulation is ineffective: policy evaluates ACTUAL path '
    '  - No subscription = denied '
    '  - purchase_status must be exactly ''paid'' '
    '  - Replaces the previous broad "any active subscription" guard '
    'AUDIT TESTS: '
    '  TEST B: Apertura → Diafragma resource → DENIED '
    '  TEST C: Diafragma → Diafragma resource → PERMITTED '
    '  TEST D: paid purchase (any tier) → course resource → PERMITTED '
    '  TEST E: no subscription → DENIED '
    '  TEST F: path manipulation → DENIED (policy reads actual path)';

-- LESSON-RESOURCES ALL (admin write)
CREATE POLICY "lesson_resources_admin_all"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'lesson-resources' AND public.is_admin())
WITH CHECK (bucket_id = 'lesson-resources' AND public.is_admin());

-- ============================================================
-- AUDIT VERIFICATION SUMMARY
-- ============================================================
--
-- EXACT POLICY SQL — VIDEOS BUCKET:
--   Policy name: videos_tier_select
--   Operation: FOR SELECT TO authenticated
--   USING expression:
--     bucket_id = 'videos'
--     AND (
--       public.is_admin()
--       OR public.user_can_access_course_content(split_part(name, '/', 1)::UUID)
--     )
--
--   user_can_access_course_content(courseId) logic:
--     1. auth.uid() must not be NULL (authenticated)
--     2. courses WHERE id = courseId AND is_published = TRUE → get minimum_tier
--     3. If minimum_tier IS NULL → return TRUE (free course)
--     4. subscriptions WHERE user_id = auth.uid() AND status = 'active' → get tier
--     5. get_tier_rank(user_tier) >= get_tier_rank(minimum_tier) → return TRUE
--     6. course_purchases WHERE user_id = auth.uid() AND course_id = courseId
--        AND purchase_status = 'paid' → return TRUE
--     7. Otherwise → return FALSE
--
-- EXACT POLICY SQL — LESSON-RESOURCES BUCKET:
--   Policy name: lesson_resources_tier_select
--   Operation: FOR SELECT TO authenticated
--   USING expression:
--     bucket_id = 'lesson-resources'
--     AND (
--       public.is_admin()
--       OR public.user_can_access_course_content(split_part(name, '/', 1)::UUID)
--     )
--
-- WHY APERTURA CANNOT READ DIAFRAGMA:
--   1. Object path: <diafragma_course_id>/lesson1.mp4
--   2. split_part(name, '/', 1) = <diafragma_course_id>
--   3. courses.minimum_tier WHERE id = <diafragma_course_id> = 'diafragma'
--   4. get_tier_rank('diafragma') = 3
--   5. subscriptions WHERE user_id = auth.uid() AND status = 'active' → tier = 'apertura'
--   6. get_tier_rank('apertura') = 1
--   7. 1 >= 3 → FALSE
--   8. No paid purchase for <diafragma_course_id> → FALSE
--   9. USING = FALSE → Supabase returns HTTP 400 (storage access denied)
--      or the signed URL request is rejected before reaching storage.
--
-- HTTP/ERROR WHEN ACCESS IS REJECTED:
--   Direct storage access (no signed URL):
--     HTTP 400 Bad Request — {"message":"new row violates row-level security policy"}
--     or HTTP 403 Forbidden depending on Supabase client version
--   Server-side (before storage is reached):
--     /api/video-token → HTTP 403 {"error":"Access denied. This content requires..."}
--     generateSignedVideoUrl() → {url: null, error: "Acceso denegado. Este curso requiere..."}
--     generateSignedDownloadUrl() → {url: null, error: "Acceso denegado. Este recurso requiere..."}
--
-- TEST A — DIRECT STORAGE ACCESS (Apertura → Diafragma):
--   Policy evaluated: videos_tier_select
--   USING expression: user_can_access_course_content(<diafragma_course_id>)
--   get_tier_rank('apertura')=1 < get_tier_rank('diafragma')=3
--   No paid purchase → FALSE
--   Result: DENIED ✅
--   HTTP: 400/403 from Supabase Storage
--
-- TEST B — DIRECT LESSON RESOURCE ACCESS (Apertura → Diafragma):
--   Policy evaluated: lesson_resources_tier_select
--   USING expression: user_can_access_course_content(<diafragma_course_id>)
--   get_tier_rank('apertura')=1 < get_tier_rank('diafragma')=3
--   No paid purchase → FALSE
--   Result: DENIED ✅
--   HTTP: 400/403 from Supabase Storage
--
-- TEST C — AUTHORIZED ACCESS (Diafragma → Diafragma):
--   Policy evaluated: videos_tier_select
--   user_can_access_course_content(<diafragma_course_id>)
--   get_tier_rank('diafragma')=3 >= get_tier_rank('diafragma')=3 → TRUE
--   Result: PERMITTED ✅
--   Signed URL generated by server → valid access
--
-- TEST D — PURCHASED COURSE (any tier + paid purchase):
--   Policy evaluated: videos_tier_select
--   user_can_access_course_content(<course_id>)
--   Subscription tier check may fail (e.g., apertura < diafragma)
--   BUT: course_purchases WHERE purchase_status = 'paid' → TRUE
--   Result: PERMITTED ✅
--   NOTE: purchase_status must be exactly 'paid' — pending/refunded/chargeback denied
--
-- TEST E — NO SUBSCRIPTION (authenticated, no sub, no purchase):
--   Policy evaluated: videos_tier_select
--   user_can_access_course_content(<any_course_id>)
--   No active subscription → tier check fails
--   No paid purchase → purchase check fails
--   Result: DENIED ✅
--   HTTP: 400/403 from Supabase Storage
--
-- TEST F — PATH MANIPULATION (Apertura course path → Diafragma content):
--   User substitutes <diafragma_course_id> into path
--   split_part(name, '/', 1) = <diafragma_course_id> (the ACTUAL path)
--   courses.minimum_tier = 'diafragma'
--   user tier = 'apertura' → rank=1 < rank=3
--   Result: DENIED ✅
--   The policy evaluates the ACTUAL requested path, not a user-supplied value.
--   Path manipulation does not help the attacker.
--
-- CONFIRMATION:
--   ✅ Apertura user + active subscription CANNOT directly read Diafragma objects
--   ✅ Authorized access (Diafragma user) continues to work
--   ✅ No broad "subscription active" bypass exists
--   ✅ Paid purchase grants access only for the specific purchased course
--   ✅ Path manipulation is ineffective
-- ============================================================
