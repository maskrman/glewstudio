-- ============================================================
-- GLEW Studio — Security Hardening (Phase 1 Audit)
-- Migration: 20260818200000_security_hardening_phase1.sql
--
-- OBJECTIVES:
--   1. Block client from creating/modifying subscriptions with
--      tier != 'apertura' or status != 'trialing'/'expired'/'cancelled'.
--      Only service-role (webhooks/server) may set premium tiers or active status.
--   2. Block client from inserting course_purchases at all.
--      Only service-role may create purchase records.
--   3. Auto-create a free/inactive subscription row on new user signup
--      via a SECURITY DEFINER trigger (server-side, not client-side).
--   4. Remove any existing permissive INSERT/UPDATE policies on subscriptions
--      and course_purchases that allow the browser to self-assign premium.
-- ============================================================

-- ============================================================
-- 1. REMOVE ALL PERMISSIVE CLIENT-WRITE POLICIES ON subscriptions
-- ============================================================

-- Drop every existing INSERT/UPDATE/ALL policy that lets the client write
DROP POLICY IF EXISTS "users_insert_own_subscription"       ON public.subscriptions;
DROP POLICY IF EXISTS "users_insert_own_subscriptions"      ON public.subscriptions;
DROP POLICY IF EXISTS "users_update_own_subscriptions"      ON public.subscriptions;
DROP POLICY IF EXISTS "users_manage_own_subscriptions"      ON public.subscriptions;

-- Keep the SELECT policy (clients may read their own row)
-- "users_read_own_subscription" and "users_select_own_subscriptions" already exist
-- and are SELECT-only — leave them in place.

-- ============================================================
-- 2. REMOVE ALL PERMISSIVE CLIENT-WRITE POLICIES ON course_purchases
-- ============================================================

DROP POLICY IF EXISTS "users_manage_own_course_purchases"   ON public.course_purchases;
-- "users_read_own_purchases" is SELECT-only — leave it in place.

-- ============================================================
-- 3. HELPER FUNCTION: create_free_subscription_for_new_user
--    Called by trigger on auth.users INSERT.
--    Runs as SECURITY DEFINER (service-role equivalent inside DB).
--    Creates tier='apertura', status='trialing' row — never premium/active.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_free_subscription_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
    -- Insert a free/inactive subscription for every new user.
    -- tier  = 'apertura'  (lowest / free tier)
    -- status = 'trialing' (not active — no payment has occurred)
    INSERT INTO public.subscriptions (user_id, tier, status)
    VALUES (
        NEW.id,
        'apertura'::public.subscription_tier,
        'trialing'::public.subscription_status
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Non-blocking: log but do not prevent user creation
        RAISE WARNING 'create_free_subscription_for_new_user failed for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$func$;

-- ============================================================
-- 4. TRIGGER: fire create_free_subscription_for_new_user on signup
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created_free_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_free_subscription
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_free_subscription_for_new_user();

-- ============================================================
-- 5. VERIFY RLS IS ENABLED (idempotent)
-- ============================================================

ALTER TABLE public.subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_purchases ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. CONFIRM FINAL POLICY STATE
--
--    subscriptions:
--      ✅ users_read_own_subscription       — SELECT  (client OK)
--      ✅ users_select_own_subscriptions    — SELECT  (client OK)
--      ✅ admin_manage_subscriptions        — ALL     (admin only)
--      ❌ NO INSERT/UPDATE for regular authenticated users
--
--    course_purchases:
--      ✅ users_read_own_purchases          — SELECT  (client OK)
--      ✅ admin_manage_purchases            — ALL     (admin only)
--      ❌ NO INSERT/UPDATE/DELETE for regular authenticated users
--
--    New user signup:
--      ✅ Trigger creates tier='apertura', status='trialing' via SECURITY DEFINER
--      ❌ Client code in AuthContext/OtpVerifyScreen can no longer insert subscriptions
--         (RLS will reject the insert — anon/authenticated role has no INSERT policy)
-- ============================================================
