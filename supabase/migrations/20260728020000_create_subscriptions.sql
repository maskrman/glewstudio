-- Subscriptions module migration
-- Tracks user subscription tiers for access control

DROP TYPE IF EXISTS public.subscription_tier CASCADE;
CREATE TYPE public.subscription_tier AS ENUM ('apertura', 'obturador', 'diafragma');

DROP TYPE IF EXISTS public.subscription_status CASCADE;
CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'expired', 'trial');

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier public.subscription_tier NOT NULL DEFAULT 'apertura'::public.subscription_tier,
    status public.subscription_status NOT NULL DEFAULT 'active'::public.subscription_status,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Only one active subscription per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_active
    ON public.subscriptions (user_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON public.subscriptions (tier);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscription
DROP POLICY IF EXISTS "users_read_own_subscription" ON public.subscriptions;
CREATE POLICY "users_read_own_subscription"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Helper function: get current user's active subscription tier
CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tier::TEXT
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
  LIMIT 1;
$$;

-- Seed demo subscriptions for the 3 test users created in auth
-- These match the credentials from the initial setup:
-- apertura@glewstudio.mx  → Plan Apertura
-- obturador@glewstudio.mx → Plan Obturador
-- diafragma@glewstudio.mx → Plan Diafragma
DO $$
DECLARE
    apertura_uid UUID;
    obturador_uid UUID;
    diafragma_uid UUID;
BEGIN
    SELECT id INTO apertura_uid FROM auth.users WHERE email = 'apertura@glewstudio.mx' LIMIT 1;
    SELECT id INTO obturador_uid FROM auth.users WHERE email = 'obturador@glewstudio.mx' LIMIT 1;
    SELECT id INTO diafragma_uid FROM auth.users WHERE email = 'diafragma@glewstudio.mx' LIMIT 1;

    IF apertura_uid IS NOT NULL THEN
        INSERT INTO public.subscriptions (user_id, tier, status)
        VALUES (apertura_uid, 'apertura'::public.subscription_tier, 'active'::public.subscription_status)
        ON CONFLICT DO NOTHING;
    END IF;

    IF obturador_uid IS NOT NULL THEN
        INSERT INTO public.subscriptions (user_id, tier, status)
        VALUES (obturador_uid, 'obturador'::public.subscription_tier, 'active'::public.subscription_status)
        ON CONFLICT DO NOTHING;
    END IF;

    IF diafragma_uid IS NOT NULL THEN
        INSERT INTO public.subscriptions (user_id, tier, status)
        VALUES (diafragma_uid, 'diafragma'::public.subscription_tier, 'active'::public.subscription_status)
        ON CONFLICT DO NOTHING;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Subscription seed failed: %', SQLERRM;
END $$;
