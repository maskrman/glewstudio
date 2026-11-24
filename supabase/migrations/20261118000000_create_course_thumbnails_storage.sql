-- Create course-thumbnails storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-thumbnails',
  'course-thumbnails',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for course-thumbnails bucket
-- Public read access (anyone can view thumbnails)
DROP POLICY IF EXISTS "course_thumbnails_public_read" ON storage.objects;
CREATE POLICY "course_thumbnails_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'course-thumbnails');

-- Authenticated upload (for admin panel)
DROP POLICY IF EXISTS "course_thumbnails_auth_upload" ON storage.objects;
CREATE POLICY "course_thumbnails_auth_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-thumbnails');

-- Authenticated update (for admin panel)
DROP POLICY IF EXISTS "course_thumbnails_auth_update" ON storage.objects;
CREATE POLICY "course_thumbnails_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'course-thumbnails')
WITH CHECK (bucket_id = 'course-thumbnails');

-- Authenticated delete (for admin panel)
DROP POLICY IF EXISTS "course_thumbnails_auth_delete" ON storage.objects;
CREATE POLICY "course_thumbnails_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-thumbnails');

-- Admin full access (all operations)
DROP POLICY IF EXISTS "course_thumbnails_admin_all" ON storage.objects;
CREATE POLICY "course_thumbnails_admin_all"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'course-thumbnails' AND public.is_admin())
WITH CHECK (bucket_id = 'course-thumbnails' AND public.is_admin());

COMMENT ON POLICY "course_thumbnails_public_read" ON storage.objects IS
    'Public read access for course thumbnails - anyone can view course cover images.';

COMMENT ON POLICY "course_thumbnails_auth_upload" ON storage.objects IS
    'Authenticated users can upload course thumbnails. Admin panel requires authentication.';

COMMENT ON POLICY "course_thumbnails_auth_update" ON storage.objects IS
    'Authenticated users can update course thumbnails.';

COMMENT ON POLICY "course_thumbnails_auth_delete" ON storage.objects IS
    'Authenticated users can delete course thumbnails.';

COMMENT ON POLICY "course_thumbnails_admin_all" ON storage.objects IS
    'Admin full access to course-thumbnails bucket (all operations).';