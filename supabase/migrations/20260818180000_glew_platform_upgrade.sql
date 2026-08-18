-- GLEW Studio Platform Upgrade Migration
-- Adds: courses table, purchases, enhanced subscriptions, admin config, payment events
-- Timestamp: 20260818180000 (higher than existing 20260728170000)

-- ============================================================
-- 1. TYPES
-- ============================================================

-- Drop dependent columns before dropping types to avoid CASCADE issues
DO $$
BEGIN
    -- Drop access_type column if it exists (will be re-added after type recreation)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'courses' AND column_name = 'access_type'
    ) THEN
        ALTER TABLE public.courses DROP COLUMN access_type;
    END IF;

    -- Drop minimum_tier column if it exists (will be re-added after type recreation)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'courses' AND column_name = 'minimum_tier'
    ) THEN
        ALTER TABLE public.courses DROP COLUMN minimum_tier;
    END IF;

    -- Drop level column if it exists (will be re-added after type recreation)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'courses' AND column_name = 'level'
    ) THEN
        ALTER TABLE public.courses DROP COLUMN level;
    END IF;

    -- Drop purchase_status column if it exists on course_purchases
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'course_purchases' AND column_name = 'purchase_status'
    ) THEN
        ALTER TABLE public.course_purchases DROP COLUMN purchase_status;
    END IF;

    -- Drop event_type column if it exists on payment_events
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payment_events' AND column_name = 'event_type'
    ) THEN
        ALTER TABLE public.payment_events DROP COLUMN event_type;
    END IF;

    -- Drop status column from subscriptions before dropping subscription_status type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'status'
    ) THEN
        ALTER TABLE public.subscriptions DROP COLUMN status;
    END IF;

    -- Drop tier column from subscriptions before dropping subscription_tier type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'tier'
    ) THEN
        ALTER TABLE public.subscriptions DROP COLUMN tier;
    END IF;
END $$;

-- Now safely drop and recreate types
DROP TYPE IF EXISTS public.course_access_type CASCADE;
CREATE TYPE public.course_access_type AS ENUM ('free', 'membership', 'premium_purchase');

DROP TYPE IF EXISTS public.course_level CASCADE;
CREATE TYPE public.course_level AS ENUM ('beginner', 'intermediate', 'advanced', 'all_levels');

DROP TYPE IF EXISTS public.purchase_status CASCADE;
CREATE TYPE public.purchase_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'chargeback');

DROP TYPE IF EXISTS public.payment_event_type CASCADE;
CREATE TYPE public.payment_event_type AS ENUM ('checkout_created', 'payment_succeeded', 'payment_failed', 'subscription_created', 'subscription_updated', 'subscription_cancelled', 'refund_issued', 'chargeback_received');

-- Extend subscription_status with new states (drop and recreate)
DROP TYPE IF EXISTS public.subscription_status CASCADE;
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancel_at_period_end', 'cancelled', 'expired');

-- Extend subscription_tier (keep existing values)
DROP TYPE IF EXISTS public.subscription_tier CASCADE;
CREATE TYPE public.subscription_tier AS ENUM ('apertura', 'obturador', 'diafragma');

-- ============================================================
-- 2. PLATFORM CONFIG TABLE (centralized pricing/discounts)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_config_key ON public.platform_config (config_key);

-- ============================================================
-- 3. COURSES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    instructor_name TEXT NOT NULL DEFAULT '',
    instructor_bio TEXT,
    instructor_avatar TEXT,
    thumbnail TEXT NOT NULL DEFAULT '',
    thumbnail_alt TEXT NOT NULL DEFAULT '',
    trailer_url TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    lesson_count INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT '',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    price NUMERIC(10,2),
    is_published BOOLEAN NOT NULL DEFAULT false,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    rating NUMERIC(3,1),
    review_count INTEGER NOT NULL DEFAULT 0,
    student_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add typed columns after types are created (safe for both fresh and existing tables)
ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS level public.course_level NOT NULL DEFAULT 'all_levels'::public.course_level;

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS access_type public.course_access_type NOT NULL DEFAULT 'free'::public.course_access_type;

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS minimum_tier public.subscription_tier;

-- Ensure all non-typed columns exist (safe for tables created in prior partial runs)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS instructor_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS instructor_bio TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS instructor_avatar TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS thumbnail TEXT NOT NULL DEFAULT '';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS thumbnail_alt TEXT NOT NULL DEFAULT '';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS trailer_url TEXT;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS lesson_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS rating NUMERIC(3,1);
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS student_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_courses_slug ON public.courses (slug);
CREATE INDEX IF NOT EXISTS idx_courses_access_type ON public.courses (access_type);
CREATE INDEX IF NOT EXISTS idx_courses_minimum_tier ON public.courses (minimum_tier);
CREATE INDEX IF NOT EXISTS idx_courses_is_published ON public.courses (is_published);
CREATE INDEX IF NOT EXISTS idx_courses_category ON public.courses (category);
CREATE INDEX IF NOT EXISTS idx_courses_is_featured ON public.courses (is_featured);

-- ============================================================
-- 4. ENHANCED SUBSCRIPTIONS TABLE (alter existing)
-- ============================================================

-- Add new columns to existing subscriptions table
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'demo',
    ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Re-add status and tier columns with new enum types (columns were dropped above via CASCADE)
ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS status public.subscription_status NOT NULL DEFAULT 'active'::public.subscription_status;

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS tier public.subscription_tier NOT NULL DEFAULT 'apertura'::public.subscription_tier;

-- Recreate unique index on status (was dropped when status column was dropped via CASCADE)
DROP INDEX IF EXISTS public.idx_subscriptions_user_active;
CREATE UNIQUE INDEX idx_subscriptions_user_active
    ON public.subscriptions (user_id)
    WHERE status = 'active';

-- ============================================================
-- 5. COURSE PURCHASES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.course_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    provider TEXT NOT NULL DEFAULT 'demo',
    provider_payment_id TEXT,
    discount_applied NUMERIC(5,2) DEFAULT 0,
    original_price NUMERIC(10,2),
    purchased_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    refunded_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Ensure all non-typed columns exist (safe for tables created in prior partial runs)
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE RESTRICT;
-- Ensure course_id is UUID type (may have been created as TEXT in a prior partial run)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'course_purchases'
          AND column_name = 'course_id'
          AND data_type = 'text'
    ) THEN
        ALTER TABLE public.course_purchases ALTER COLUMN course_id TYPE UUID USING course_id::UUID;
    END IF;
END $$;
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2);
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS discount_applied NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2);
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.course_purchases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Add typed column after type is created
ALTER TABLE public.course_purchases
    ADD COLUMN IF NOT EXISTS purchase_status public.purchase_status NOT NULL DEFAULT 'pending'::public.purchase_status;

CREATE INDEX IF NOT EXISTS idx_course_purchases_user_id ON public.course_purchases (user_id);
CREATE INDEX IF NOT EXISTS idx_course_purchases_course_id ON public.course_purchases (course_id);
CREATE INDEX IF NOT EXISTS idx_course_purchases_status ON public.course_purchases (purchase_status);
CREATE INDEX IF NOT EXISTS idx_course_purchases_provider_payment_id ON public.course_purchases (provider_payment_id);

-- Unique: one active purchase per user per course (prevent duplicate paid purchases)
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_purchases_user_course_paid
    ON public.course_purchases (user_id, course_id)
    WHERE purchase_status = 'paid';

-- ============================================================
-- 6. PAYMENT EVENTS TABLE (idempotent webhook processing)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'demo',
    provider_event_id TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add typed column after type is created
ALTER TABLE public.payment_events
    ADD COLUMN IF NOT EXISTS event_type public.payment_event_type NOT NULL DEFAULT 'checkout_created'::public.payment_event_type;

-- Unique constraint on provider_event_id to prevent double processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_provider_event
    ON public.payment_events (provider, provider_event_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_processed ON public.payment_events (processed);
CREATE INDEX IF NOT EXISTS idx_payment_events_event_type ON public.payment_events (event_type);

-- ============================================================
-- 7. FUNCTIONS
-- ============================================================

-- Admin check function (uses auth metadata, no circular dependency)
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

-- Get user subscription tier (updated to use new status enum)
CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
SELECT tier::TEXT
FROM public.subscriptions
WHERE user_id = p_user_id
  AND status = 'active'::public.subscription_status
LIMIT 1;
$func$;

-- Check if user has purchased a course
CREATE OR REPLACE FUNCTION public.user_has_purchased_course(p_user_id UUID, p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
SELECT EXISTS (
    SELECT 1 FROM public.course_purchases
    WHERE user_id = p_user_id
      AND course_id::UUID = p_course_id
      AND purchase_status = 'paid'::public.purchase_status
)
$func$;

-- Centralized course access check
CREATE OR REPLACE FUNCTION public.can_access_course(p_user_id UUID, p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $func$
DECLARE
    v_course RECORD;
    v_user_tier TEXT;
    v_tier_rank INTEGER;
    v_required_rank INTEGER;
BEGIN
    -- Get course details
    SELECT access_type, minimum_tier, is_published
    INTO v_course
    FROM public.courses
    WHERE id = p_course_id
    LIMIT 1;

    -- Course not found or not published
    IF NOT FOUND OR NOT v_course.is_published THEN
        RETURN false;
    END IF;

    -- Free courses: always accessible
    IF v_course.access_type = 'free'::public.course_access_type THEN
        RETURN true;
    END IF;

    -- Must be authenticated for non-free content
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- Premium purchase: check if user bought it
    IF v_course.access_type = 'premium_purchase'::public.course_access_type THEN
        RETURN public.user_has_purchased_course(p_user_id, p_course_id);
    END IF;

    -- Membership content: check tier
    IF v_course.access_type = 'membership'::public.course_access_type THEN
        -- No minimum tier = any active membership works
        IF v_course.minimum_tier IS NULL THEN
            RETURN EXISTS (
                SELECT 1 FROM public.subscriptions
                WHERE user_id = p_user_id AND status = 'active'::public.subscription_status
            );
        END IF;

        -- Get user tier
        SELECT tier::TEXT INTO v_user_tier
        FROM public.subscriptions
        WHERE user_id = p_user_id AND status = 'active'::public.subscription_status
        LIMIT 1;

        IF v_user_tier IS NULL THEN
            RETURN false;
        END IF;

        -- Compare tier ranks
        v_tier_rank := CASE v_user_tier
            WHEN 'apertura' THEN 1
            WHEN 'obturador' THEN 2
            WHEN 'diafragma' THEN 3
            ELSE 0
        END;

        v_required_rank := CASE v_course.minimum_tier::TEXT
            WHEN 'apertura' THEN 1
            WHEN 'obturador' THEN 2
            WHEN 'diafragma' THEN 3
            ELSE 0
        END;

        RETURN v_tier_rank >= v_required_rank;
    END IF;

    RETURN false;
END;
$func$;

-- Get discounted price for a course based on user tier
CREATE OR REPLACE FUNCTION public.get_course_price_for_user(p_user_id UUID, p_course_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $func$
DECLARE
    v_course RECORD;
    v_user_tier TEXT;
    v_discount_pct NUMERIC;
    v_config JSONB;
    v_final_price NUMERIC;
BEGIN
    SELECT price, access_type, title INTO v_course
    FROM public.courses WHERE id = p_course_id LIMIT 1;

    IF NOT FOUND OR v_course.price IS NULL THEN
        RETURN jsonb_build_object('original_price', 0, 'final_price', 0, 'discount_pct', 0, 'user_tier', null);
    END IF;

    -- Get user tier
    IF p_user_id IS NOT NULL THEN
        SELECT tier::TEXT INTO v_user_tier
        FROM public.subscriptions
        WHERE user_id = p_user_id AND status = 'active'::public.subscription_status
        LIMIT 1;
    END IF;

    -- Get discount config
    SELECT config_value INTO v_config
    FROM public.platform_config
    WHERE config_key = 'membership_discounts'
    LIMIT 1;

    v_discount_pct := 0;
    IF v_config IS NOT NULL AND v_user_tier IS NOT NULL THEN
        v_discount_pct := COALESCE((v_config->>v_user_tier)::NUMERIC, 0);
    END IF;

    v_final_price := ROUND(v_course.price * (1 - v_discount_pct / 100), 2);

    RETURN jsonb_build_object(
        'original_price', v_course.price,
        'final_price', v_final_price,
        'discount_pct', v_discount_pct,
        'user_tier', v_user_tier
    );
END;
$func$;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$func$;

-- ============================================================
-- 8. ENABLE RLS
-- ============================================================

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. RLS POLICIES
-- ============================================================

-- platform_config: public read, admin write
DROP POLICY IF EXISTS "public_read_platform_config" ON public.platform_config;
CREATE POLICY "public_read_platform_config"
ON public.platform_config FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "admin_manage_platform_config" ON public.platform_config;
CREATE POLICY "admin_manage_platform_config"
ON public.platform_config FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- courses: published courses public read, admin full access
DROP POLICY IF EXISTS "public_read_published_courses" ON public.courses;
CREATE POLICY "public_read_published_courses"
ON public.courses FOR SELECT TO public
USING (is_published = true);

DROP POLICY IF EXISTS "admin_manage_courses" ON public.courses;
CREATE POLICY "admin_manage_courses"
ON public.courses FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- course_purchases: users read own, admin reads all
DROP POLICY IF EXISTS "users_read_own_purchases" ON public.course_purchases;
CREATE POLICY "users_read_own_purchases"
ON public.course_purchases FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_purchases" ON public.course_purchases;
CREATE POLICY "admin_manage_purchases"
ON public.course_purchases FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- payment_events: admin only
DROP POLICY IF EXISTS "admin_manage_payment_events" ON public.payment_events;
CREATE POLICY "admin_manage_payment_events"
ON public.payment_events FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- subscriptions: update existing policy to allow admin
DROP POLICY IF EXISTS "admin_manage_subscriptions" ON public.subscriptions;
CREATE POLICY "admin_manage_subscriptions"
ON public.subscriptions FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- 10. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS set_courses_updated_at ON public.courses;
CREATE TRIGGER set_courses_updated_at
    BEFORE UPDATE ON public.courses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER set_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_course_purchases_updated_at ON public.course_purchases;
CREATE TRIGGER set_course_purchases_updated_at
    BEFORE UPDATE ON public.course_purchases
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 11. SEED PLATFORM CONFIG (centralized pricing)
-- ============================================================

INSERT INTO public.platform_config (config_key, config_value, description)
VALUES
    ('membership_prices', jsonb_build_object(
        'apertura', jsonb_build_object('monthly', 9.99, 'annual', 7.99, 'annual_total', 95.88),
        'obturador', jsonb_build_object('monthly', 19.99, 'annual', 15.99, 'annual_total', 191.88),
        'diafragma', jsonb_build_object('monthly', 29.99, 'annual', 23.99, 'annual_total', 287.88)
    ), 'Monthly and annual prices for each membership tier'),
    ('membership_discounts', jsonb_build_object(
        'apertura', 10,
        'obturador', 20,
        'diafragma', 30
    ), 'Percentage discount on premium course purchases per membership tier'),
    ('membership_features', jsonb_build_object(
        'apertura', jsonb_build_array(
            'Contenido seleccionado y cursos introductorios',
            'Clases de muestra exclusivas',
            'Contenido exclusivo para miembros',
            '10% de descuento en cursos premium',
            'Acceso desde cualquier dispositivo',
            'Comunidad de estudiantes'
        ),
        'obturador', jsonb_build_array(
            'Todo lo de Apertura',
            'Mayor catálogo incluido',
            'Contenido premium seleccionado',
            '20% de descuento en cursos premium',
            'Material complementario descargable',
            'Certificados cuando corresponda'
        ),
        'diafragma', jsonb_build_array(
            'Todo lo de Obturador',
            'Mayor catálogo disponible',
            'Más contenido premium incluido',
            '30% de descuento en cursos premium',
            'Masterclasses exclusivas',
            'Workshops y sesiones en vivo',
            'Sesiones Q&A con instructores',
            'Revisión de portafolio mensual'
        )
    ), 'Feature list for each membership tier'),
    ('payment_provider', jsonb_build_object(
        'provider', 'demo',
        'mode', 'TEST',
        'note', 'Payment provider not yet configured. All transactions are DEMO/TEST only.'
    ), 'Active payment provider configuration')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================
-- 12. SEED DEMO COURSES
-- ============================================================

DO $$
DECLARE
    c1 UUID := gen_random_uuid();
    c2 UUID := gen_random_uuid();
    c3 UUID := gen_random_uuid();
    c4 UUID := gen_random_uuid();
    c5 UUID := gen_random_uuid();
    c6 UUID := gen_random_uuid();
    c7 UUID := gen_random_uuid();
    c8 UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.courses (
        id, slug, title, subtitle, description, instructor_name, thumbnail, thumbnail_alt,
        duration_minutes, lesson_count, level, category, access_type, minimum_tier,
        price, is_published, is_featured, rating, review_count, student_count
    ) VALUES
    (c1, 'iluminacion-rembrandt-retrato',
        'Iluminación Rembrandt para Retrato Profesional',
        'Domina la técnica de iluminación más solicitada en fotografía de retrato',
        'Aprende a crear el triángulo de luz característico, controlar sombras y adaptar el esquema a diferentes tipos de rostro.',
        'Carlos Mendoza',
        'https://img.rocket.new/generatedImages/rocket_gen_img_1d731ee8d-1779952599495.png',
        'Studio lighting setup with Rembrandt pattern creating dramatic shadows on portrait subject',
        512, 12, 'intermediate'::public.course_level, 'Iluminación de Estudio',
        'membership'::public.course_access_type, 'obturador'::public.subscription_tier,
        NULL, true, true, 4.9, 1248, 3840),
    (c2, 'flujo-trabajo-raw-lightroom',
        'Flujo de Trabajo RAW en Lightroom',
        'Organiza y edita tus archivos RAW como un profesional',
        'Aprende el flujo de trabajo completo desde la importación hasta la exportación final.',
        'Alejandro Vega',
        'https://img.rocket.new/generatedImages/rocket_gen_img_112c3cf40-1787075634923.png',
        'Lightroom RAW workflow showing catalog organization and basic develop panel',
        65, 20, 'beginner'::public.course_level, 'Edición y Retoque',
        'membership'::public.course_access_type, 'apertura'::public.subscription_tier,
        NULL, true, false, 4.9, 892, 5200),
    (c3, 'iluminacion-cinematografica-concepto-resultado',
        'Iluminación Cinematográfica: Del Concepto al Resultado',
        'Masterclass completa de iluminación para fotografía comercial y editorial',
        'Diseña esquemas de iluminación complejos para retratos, moda y fotografía comercial con Carlos Mendoza.',
        'Carlos Mendoza',
        'https://img.rocket.new/generatedImages/rocket_gen_img_19e5903ef-1783560999543.png',
        'Dramatic studio photography session with professional lighting rigs and a model in elegant pose',
        510, 24, 'advanced'::public.course_level, 'Masterclasses',
        'membership'::public.course_access_type, 'diafragma'::public.subscription_tier,
        NULL, true, true, 4.9, 2100, 1850),
    (c4, 'retoque-piel-photoshop',
        'Retoque de Piel en Photoshop CC',
        'Técnicas profesionales de retoque para fotografía de moda y retrato',
        'Aprende frequency separation, dodge and burn y las técnicas más usadas en la industria.',
        'Sofía Reyes',
        'https://img.rocket.new/generatedImages/rocket_gen_img_1aa26c31d-1785844143724.png',
        'Professional photo retouching workflow showing skin smoothing techniques in Photoshop',
        180, 8, 'intermediate'::public.course_level, 'Edición y Retoque',
        'membership'::public.course_access_type, 'apertura'::public.subscription_tier,
        NULL, true, false, 4.8, 654, 4100),
    (c5, 'fotografia-producto-mesa-luz',
        'Fotografía de Producto en Mesa de Luz',
        'Crea imágenes de producto profesionales con equipamiento accesible',
        'Aprende a fotografiar productos para e-commerce y catálogos con resultados profesionales.',
        'Sofía Reyes',
        'https://img.rocket.new/generatedImages/rocket_gen_img_18c3fcab2-1772196420648.png',
        'Elegant product photography on light table with minimalist composition',
        180, 10, 'beginner'::public.course_level, 'Fotografía de Producto',
        'membership'::public.course_access_type, 'apertura'::public.subscription_tier,
        NULL, true, false, 4.7, 421, 3200),
    (c6, 'masterclass-iluminacion-moda-editorial',
        'Masterclass: Iluminación para Moda Editorial',
        'El sistema completo de iluminación para fotografía de moda de alto nivel',
        'Aprende los esquemas de iluminación usados en las principales revistas de moda. Incluye sesiones BTS reales.',
        'Carlos Mendoza',
        'https://img.rocket.new/generatedImages/rocket_gen_img_1c7111102-1785194268846.png',
        'Fashion editorial lighting setup with multiple strobe heads and colored gels',
        497, 28, 'advanced'::public.course_level, 'Masterclasses',
        'premium_purchase'::public.course_access_type, NULL,
        497.00, true, true, 5.0, 312, 890),
    (c7, 'color-grading-cinematografico',
        'Color Grading Cinematográfico',
        'Crea looks cinematográficos profesionales en Lightroom y Capture One',
        'Aprende a crear LUTs personalizados y aplicar color grading cinematográfico a tus fotografías.',
        'Alejandro Vega',
        'https://img.rocket.new/generatedImages/rocket_gen_img_1e45302fc-1783851831373.png',
        'Color grading workflow in Lightroom with cinematic teal and orange look applied',
        310, 16, 'intermediate'::public.course_level, 'Edición y Retoque',
        'membership'::public.course_access_type, 'obturador'::public.subscription_tier,
        NULL, true, false, 4.9, 789, 2900),
    (c8, 'sistema-negocio-fotografia-comercial',
        'Sistema Completo: Negocio de Fotografía Comercial',
        'De fotógrafo a empresario: construye un negocio sostenible de fotografía',
        'El sistema completo para construir, escalar y monetizar tu negocio de fotografía comercial. Incluye contratos, pricing, captación de clientes y gestión de proyectos.',
        'Valentina Cruz',
        'https://img.rocket.new/generatedImages/rocket_gen_img_19b1925a8-1769680916668.png',
        'Behind the scenes of high-fashion editorial shoot with full crew and lighting team',
        720, 32, 'all_levels'::public.course_level, 'Negocio',
        'premium_purchase'::public.course_access_type, NULL,
        799.00, true, true, 4.9, 198, 540)
    ON CONFLICT (slug) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Course seed failed: %', SQLERRM;
END $$;
