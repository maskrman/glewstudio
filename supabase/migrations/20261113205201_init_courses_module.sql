-- LMS core: course lifecycle, modules, lessons, and protected video sources.

DO $$
BEGIN
  CREATE TYPE public.course_status AS ENUM ('draft', 'public', 'presale');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.lesson_video_provider AS ENUM ('supabase', 'bunny');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS status public.course_status;

UPDATE public.courses
SET status = CASE WHEN is_published THEN 'public'::public.course_status
                  ELSE 'draft'::public.course_status END
WHERE status IS NULL;

ALTER TABLE public.courses
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN status SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_course_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_published := NEW.status IN ('public', 'presale');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.is_published := NEW.status IN ('public', 'presale');
  ELSIF NEW.is_published IS DISTINCT FROM OLD.is_published THEN
    NEW.status := CASE WHEN NEW.is_published THEN 'public' ELSE 'draft' END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS courses_sync_status ON public.courses;
CREATE TRIGGER courses_sync_status
  BEFORE INSERT OR UPDATE OF status, is_published ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_course_status();

CREATE TABLE IF NOT EXISTS public.course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (course_id, position)
);

CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  position INTEGER NOT NULL DEFAULT 0,
  video_provider public.lesson_video_provider NOT NULL DEFAULT 'supabase',
  video_asset_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (module_id, position)
);

CREATE INDEX IF NOT EXISTS idx_course_modules_course_position
  ON public.course_modules(course_id, position);
CREATE INDEX IF NOT EXISTS idx_lessons_module_position
  ON public.lessons(module_id, position);

ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_course_modules" ON public.course_modules;
CREATE POLICY "public_read_course_modules"
  ON public.course_modules
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.courses c
      WHERE c.id = course_modules.course_id
        AND c.status IN ('public', 'presale')
    )
  );

DROP POLICY IF EXISTS "admin_manage_course_modules" ON public.course_modules;
CREATE POLICY "admin_manage_course_modules"
  ON public.course_modules
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public_read_lessons" ON public.lessons;
CREATE POLICY "public_read_lessons"
  ON public.lessons
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.course_modules m
      JOIN public.courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id
        AND c.status IN ('public', 'presale')
    )
  );

DROP POLICY IF EXISTS "admin_manage_lessons" ON public.lessons;
CREATE POLICY "admin_manage_lessons"
  ON public.lessons
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS set_course_modules_updated_at ON public.course_modules;
CREATE TRIGGER set_course_modules_updated_at
  BEFORE UPDATE ON public.course_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_lessons_updated_at ON public.lessons;
CREATE TRIGGER set_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.lessons.video_asset_id IS
  'Supabase Storage path or Bunny Stream video UUID. Bunny tokens are generated server-side.';