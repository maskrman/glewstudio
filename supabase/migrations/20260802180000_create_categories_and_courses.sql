-- Categories and Courses tables for Glewstudio landing page
-- Migration: 20260802180000_create_categories_and_courses

-- 1. Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  cover_image TEXT,
  cover_image_alt TEXT DEFAULT '',
  icon TEXT DEFAULT 'PhotoIcon',
  color TEXT DEFAULT 'from-amber-500/30',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Courses table
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  thumbnail TEXT,
  thumbnail_alt TEXT DEFAULT '',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  instructor TEXT DEFAULT '',
  duration TEXT DEFAULT '',
  tier TEXT DEFAULT 'apertura',
  rating NUMERIC(3,1) DEFAULT 0,
  lesson_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_courses_category_id ON public.courses(category_id);
CREATE INDEX IF NOT EXISTS idx_courses_is_published ON public.courses(is_published);

-- 4. Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — public read access (content is public)
DROP POLICY IF EXISTS "public_read_categories" ON public.categories;
CREATE POLICY "public_read_categories"
ON public.categories FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "public_read_courses" ON public.courses;
CREATE POLICY "public_read_courses"
ON public.courses FOR SELECT TO public USING (is_published = true);

-- 6. Seed data — categories
DO $$
BEGIN
  INSERT INTO public.categories (id, name, slug, cover_image, cover_image_alt, icon, color, sort_order)
  VALUES
    (gen_random_uuid(), 'Iluminación de Estudio', 'iluminacion-de-estudio',
     'https://img.rocket.new/generatedImages/rocket_gen_img_1408ce8e4-1767456938177.png',
     'Professional studio lighting setup with softboxes and reflectors arranged around a white backdrop',
     'LightBulbIcon', 'from-amber-500/30', 1),
    (gen_random_uuid(), 'Edición y Retoque', 'edicion-y-retoque',
     'https://img.rocket.new/generatedImages/rocket_gen_img_1b1bced12-1772090748084.png',
     'Photographer editing photos on dual monitor setup with Lightroom color grading interface',
     'PhotoIcon', 'from-blue-500/30', 2),
    (gen_random_uuid(), 'Fotografía de Producto', 'fotografia-de-producto',
     'https://img.rocket.new/generatedImages/rocket_gen_img_12cc6a154-1772130537457.png',
     'Elegant watch product photography on black marble surface with dramatic side lighting',
     'CubeIcon', 'from-emerald-500/30', 3),
    (gen_random_uuid(), 'Retrato Comercial', 'retrato-comercial',
     'https://img.rocket.new/generatedImages/rocket_gen_img_1d4eb9c08-1783533378529.png',
     'Professional commercial portrait of a model with dramatic studio lighting and dark background',
     'UserIcon', 'from-rose-500/30', 4),
    (gen_random_uuid(), 'Fotografía Gastronómica', 'fotografia-gastronomica',
     'https://img.rocket.new/generatedImages/rocket_gen_img_1acd6bae0-1778766509157.png',
     'Overhead flat lay food photography of colorful dishes arranged on rustic wooden table',
     'BeakerIcon', 'from-orange-500/30', 5),
    (gen_random_uuid(), 'Detrás de Cámaras', 'detras-de-camaras',
     'https://img.rocket.new/generatedImages/rocket_gen_img_1e1f7fbc5-1772733210834.png',
     'Behind the scenes of a professional photo shoot showing photographer, assistants, and lighting crew',
     'FilmIcon', 'from-purple-500/30', 6)
  ON CONFLICT (slug) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Category seed failed: %', SQLERRM;
END $$;
