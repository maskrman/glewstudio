-- Membership Plans table for Glewstudio
-- Migration: 20261125000000_create_membership_plans

-- 1. Create membership_plans table
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  badge TEXT,
  monthly_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  annual_monthly_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  premium_discount_percent INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]',
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_monthly_price_id TEXT,
  stripe_annual_price_id TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Enable RLS
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies - public read access
DROP POLICY IF EXISTS "public_read_membership_plans" ON public.membership_plans;
CREATE POLICY "public_read_membership_plans"
ON public.membership_plans FOR SELECT TO public USING (true);

-- Admin full access
DROP POLICY IF EXISTS "admin_manage_membership_plans" ON public.membership_plans;
CREATE POLICY "admin_manage_membership_plans"
ON public.membership_plans FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4. Updated at trigger
DROP TRIGGER IF EXISTS set_membership_plans_updated_at ON public.membership_plans;
CREATE TRIGGER set_membership_plans_updated_at
  BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 5. Seed initial data (Apertura, Obturador, Diafragma)
INSERT INTO public.membership_plans (
  slug,
  name,
  badge,
  monthly_price,
  annual_monthly_price,
  premium_discount_percent,
  features,
  is_popular
) VALUES
  (
    'apertura',
    'Apertura',
    'Membresía Básica',
    9.99,
    7.99,
    10,
    '["Contenido seleccionado y cursos introductorios", "Clases de muestra exclusivas", "Contenido exclusivo para miembros", "10% de descuento en cursos premium", "Acceso desde cualquier dispositivo", "Comunidad de estudiantes"]'::jsonb,
    FALSE
  ),
  (
    'obturador',
    'Obturador',
    'Membresía Pro',
    19.99,
    15.99,
    20,
    '["Todo lo de Apertura", "Mayor catálogo incluido", "Contenido premium seleccionado", "20% de descuento en cursos premium", "Material complementario descargable", "Certificados cuando corresponda"]'::jsonb,
    TRUE
  ),
  (
    'diafragma',
    'Diafragma',
    'Membresía Master',
    29.99,
    23.99,
    30,
    '["Todo lo de Obturador", "Mayor catálogo disponible", "Más contenido premium incluido", "30% de descuento en cursos premium", "Masterclasses exclusivas", "Workshops y sesiones en vivo", "Sesiones Q&A con instructores", "Revisión de portafolio mensual"]'::jsonb,
    FALSE
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  badge = EXCLUDED.badge,
  monthly_price = EXCLUDED.monthly_price,
  annual_monthly_price = EXCLUDED.annual_monthly_price,
  premium_discount_percent = EXCLUDED.premium_discount_percent,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  updated_at = CURRENT_TIMESTAMP;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_membership_plans_slug ON public.membership_plans(slug);
CREATE INDEX IF NOT EXISTS idx_membership_plans_is_popular ON public.membership_plans(is_popular);