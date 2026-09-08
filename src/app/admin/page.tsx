import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppLayout from '@/components/AppLayout';
import AdminPanel from './components/AdminPanel';

/**
 * /admin — Server-side admin protection.
 *
 * SECURITY (Phase 2 Audit — Issue #5):
 * This page is protected server-side by verifying raw_app_meta_data.role = 'admin'.
 * raw_app_meta_data can ONLY be written by the service-role key — never by the client.
 * A regular user cannot self-elevate to admin by modifying raw_user_meta_data.
 *
 * The UI (AdminPanel) also checks auth state, but that is NOT the security boundary.
 * This server-side check IS the security boundary.
 *
 * Non-admin users are redirected to /dashboard (not shown a 403 to avoid enumeration).
 */
export default async function AdminPage() {
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
  // raw_app_meta_data is only writable via service-role key.
  // raw_user_meta_data is intentionally NOT checked here (user-writable).
  const appMeta = user.app_metadata as Record<string, unknown> | undefined;
  const isAdmin = appMeta?.role === 'admin';

  if (!isAdmin) {
    // Redirect non-admins silently — do not reveal that /admin exists
    redirect('/dashboard');
  }

  return (
    <AppLayout currentPath="/admin">
      <AdminPanel />
    </AppLayout>
  );
}
