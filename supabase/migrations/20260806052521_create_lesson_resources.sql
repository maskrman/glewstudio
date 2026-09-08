-- lesson_resources table: stores downloadable files attached to a lesson
-- Files are stored in the private "lesson-resources" Supabase Storage bucket
-- at path: <course_id>/<lesson_id>/<file_name>

CREATE TABLE IF NOT EXISTS public.lesson_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'PDF',
  file_size TEXT,
  storage_path TEXT NOT NULL,
  required_tier TEXT NOT NULL DEFAULT 'obturador',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lesson_resources_course_lesson
  ON public.lesson_resources(course_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_lesson_resources_sort
  ON public.lesson_resources(course_id, lesson_id, sort_order);

ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all lesson resources (access control is enforced at download time)
DROP POLICY IF EXISTS "authenticated_read_lesson_resources" ON public.lesson_resources;
CREATE POLICY "authenticated_read_lesson_resources"
ON public.lesson_resources
FOR SELECT
TO authenticated
USING (true);

-- Only service role can insert/update/delete lesson resources (admin operations)
DROP POLICY IF EXISTS "service_manage_lesson_resources" ON public.lesson_resources;
CREATE POLICY "service_manage_lesson_resources"
ON public.lesson_resources
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Storage bucket for lesson resources (private — no public access)
-- The bucket must be created via Supabase Dashboard or CLI as it cannot be created via SQL migration.
-- Bucket name: lesson-resources
-- Public: false
-- Allowed MIME types: image/*, application/pdf, application/octet-stream
-- Max file size: 524288000 (500 MB)

-- Storage RLS policies for the lesson-resources bucket
-- These policies control who can download files from the private bucket.
-- Authenticated users with an active subscription or course purchase can read files.
-- Only service role can upload/delete files.

-- NOTE: Storage policies are managed via Supabase Dashboard > Storage > Policies
-- The signed URL generation in the server action enforces access control server-side.

-- Sample lesson resources for the demo course
DO $$
DECLARE
  demo_course_id TEXT := 'iluminacion-rembrandt-retrato';
  demo_lesson_id TEXT := 'lesson-004';
BEGIN
  INSERT INTO public.lesson_resources
    (id, course_id, lesson_id, file_name, display_name, file_type, file_size, storage_path, required_tier, sort_order)
  VALUES
    (gen_random_uuid(), demo_course_id, demo_lesson_id,
     'raw-lesson-004-canon5d.cr2',
     'Archivo RAW — Lección 4 (Canon 5D MkIV)',
     'RAW', '48.2 MB',
     demo_course_id || '/' || demo_lesson_id || '/raw-lesson-004-canon5d.cr2',
     'obturador', 1),
    (gen_random_uuid(), demo_course_id, demo_lesson_id,
     'esquema-iluminacion-rembrandt.pdf',
     'Esquema de Iluminación Rembrandt — PDF',
     'PDF', '2.8 MB',
     demo_course_id || '/' || demo_lesson_id || '/esquema-iluminacion-rembrandt.pdf',
     'obturador', 2),
    (gen_random_uuid(), demo_course_id, demo_lesson_id,
     'preset-lightroom-tonos-calidos.xmp',
     'Preset Lightroom — Tonos Cálidos Retrato',
     'XMP', '1.1 MB',
     demo_course_id || '/' || demo_lesson_id || '/preset-lightroom-tonos-calidos.xmp',
     'obturador', 3),
    (gen_random_uuid(), demo_course_id, demo_lesson_id,
     'lut-cinematografico-rembrandt-gold.cube',
     'LUT Cinematográfico — Rembrandt Gold',
     'LUT', '0.8 MB',
     demo_course_id || '/' || demo_lesson_id || '/lut-cinematografico-rembrandt-gold.cube',
     'diafragma', 4),
    (gen_random_uuid(), demo_course_id, demo_lesson_id,
     'raw-sesion-completa-12-tomas.zip',
     'Archivo RAW — Sesión Completa (12 tomas)',
     'RAW', '312 MB',
     demo_course_id || '/' || demo_lesson_id || '/raw-sesion-completa-12-tomas.zip',
     'diafragma', 5)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Sample lesson resources insertion skipped: %', SQLERRM;
END $$;
