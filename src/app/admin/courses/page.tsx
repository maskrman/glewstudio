import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppLayout from '@/components/AppLayout';
import AdminCourses from '@/app/admin/components/courses/AdminCourses';
import { getCourses } from '@/app/admin/actions/courses';

/**
 * /admin/courses — Server-side admin protection for course management.
 *
 * This page is protected server-side by verifying raw_app_meta_data.role = 'admin'.
 * raw_app_meta_data can ONLY be written by the service-role key — never by the client.
 * A regular user cannot self-elevate to admin by modifying raw_user_meta_data.
 *
 * Non-admin users are redirected to /dashboard (not shown a 403 to avoid enumeration).
 */
export default async function AdminCoursesPage() {
  const supabase = await createClient();

  // 1. Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/sign-up-login');
  }

  // 2. Verify admin role from raw_app_meta_data (server-side, cannot be spoofed by client)
  const appMeta = user.app_metadata as Record<string, unknown> | undefined;
  const isAdmin = appMeta?.role === 'admin';

  if (!isAdmin) {
    // Redirect non-admins silently — do not reveal that /admin exists
    redirect('/dashboard');
  }

  // 3. Fetch courses server-side for initial render
  const courses = await getCourses();

  return (
    <AppLayout currentPath="/admin/courses">
      <AdminCourses initialCourses={courses} />
    </AppLayout>
  );
}
