-- Instructors table for Glewstudio
-- Migration: 20261123000000_create_instructors

-- 1. Create instructors table
CREATE TABLE IF NOT EXISTS public.instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialty TEXT,
  tags TEXT[] DEFAULT '{}',
  bio TEXT,
  photo_url TEXT,
  photo_alt TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add instructor_id to courses table (replace instructor text field)
DO $$
BEGIN
  -- Add instructor_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'instructor_id'
  ) THEN
    ALTER TABLE public.courses ADD COLUMN instructor_id UUID REFERENCES public.instructors(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Migrate existing instructor text data to instructors table and link via instructor_id
-- Create instructors from existing course instructor names
DO $$
DECLARE
  course_rec RECORD;
  instructor_id UUID;
BEGIN
  FOR course_rec IN SELECT DISTINCT instructor FROM public.courses WHERE instructor IS NOT NULL AND instructor != '' LOOP
    -- Insert instructor if not exists
    INSERT INTO public.instructors (name, specialty, tags, bio, photo_url, photo_alt)
    VALUES (course_rec.instructor, '', '{}', NULL, NULL, '')
    ON CONFLICT DO NOTHING
    RETURNING id INTO instructor_id;

    -- If instructor was newly created, get its ID
    IF instructor_id IS NULL THEN
      SELECT id INTO instructor_id FROM public.instructors WHERE name = course_rec.instructor LIMIT 1;
    END IF;

    -- Update courses with instructor_id
    IF instructor_id IS NOT NULL THEN
      UPDATE public.courses SET instructor_id = instructor_id WHERE instructor = course_rec.instructor;
    END IF;
  END LOOP;
END $$;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_instructors_name ON public.instructors(name);
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id ON public.courses(instructor_id);

-- 5. Enable RLS
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies - public read access
DROP POLICY IF EXISTS "public_read_instructors" ON public.instructors;
CREATE POLICY "public_read_instructors"
ON public.instructors FOR SELECT TO public USING (true);

-- Admin full access
DROP POLICY IF EXISTS "admin_manage_instructors" ON public.instructors;
CREATE POLICY "admin_manage_instructors"
ON public.instructors FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 7. Updated at trigger
DROP TRIGGER IF EXISTS set_instructors_updated_at ON public.instructors;
CREATE TRIGGER set_instructors_updated_at
  BEFORE UPDATE ON public.instructors
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 8. Storage bucket for instructor photos (create if not exists)
-- Note: This needs to be created manually in Supabase Storage panel or via separate migration
-- Bucket name: 'instructor-photos' or reuse 'course-thumbnails'