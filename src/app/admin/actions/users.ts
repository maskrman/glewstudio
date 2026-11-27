'use server';

/**
 * GLEW Studio — Admin Users API Routes
 * Server-side actions for user management (requires service_role)
 */

import { createServiceRoleClient } from '@/lib/supabase/service';
import type { Database } from '@/types/supabase';
import { revalidatePath } from 'next/cache';

export type UserProfile = Database['public']['Tables']['profiles']['Row'] & {
  email: string;
  role: 'student' | 'admin';
  subscription_tier: string | null;
  subscription_status: string | null;
  active_course_purchases: number;
};

// ─── Get All Users with enriched data ──────────────────────────────────

export async function getAdminUsers(search?: string): Promise<UserProfile[]> {
  const supabase = createServiceRoleClient();

  // Get all auth users (requires service role)
  const { data: usersResult, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    throw new Error(`Error obteniendo usuarios: ${usersError.message}`);
  }

  const authUsers = usersResult.users ?? [];

  // Get all profiles
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*');

  if (profilesError) {
    throw new Error(`Error obteniendo perfiles: ${profilesError.message}`);
  }

  // Get active subscriptions
  const { data: subscriptions, error: subsError } = await supabase
    .from('subscriptions')
    .select('user_id, tier, status')
    .eq('status', 'active');

  if (subsError) {
    throw new Error(`Error obteniendo suscripciones: ${subsError.message}`);
  }

  // Get course purchases
  const { data: purchases, error: purchasesError } = await supabase
    .from('course_purchases')
    .select('user_id, course_id')
    .eq('purchase_status', 'paid');

  if (purchasesError) {
    throw new Error(`Error obteniendo compras: ${purchasesError.message}`);
  }

  // Build lookup maps
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const subscriptionMap = new Map((subscriptions ?? []).map((s) => [s.user_id, s]));
  const purchaseCountMap = new Map<string, number>();
  (purchases ?? []).forEach((p) => {
    purchaseCountMap.set(p.user_id, (purchaseCountMap.get(p.user_id) || 0) + 1);
  });

  // Enrich users
  const enrichedUsers: UserProfile[] = authUsers
    .map((user) => {
      const profile = profileMap.get(user.id);
      const subscription = subscriptionMap.get(user.id);
      const activePurchases = purchaseCountMap.get(user.id) || 0;
      const role = user.app_metadata?.role === 'admin' ? 'admin' : 'student';

      return {
        id: user.id,
        email: user.email ?? '',
        full_name: profile?.full_name ?? '',
        avatar_url: profile?.avatar_url ?? null,
        bio: profile?.bio ?? null,
        created_at: profile?.created_at ?? user.created_at,
        updated_at: profile?.updated_at ?? user.updated_at ?? user.created_at,
        role,
        subscription_tier: subscription?.tier ?? null,
        subscription_status: subscription?.status ?? null,
        active_course_purchases: activePurchases,
      };
    })
    .filter((user) => {
      if (!search) return true;
      const searchLower = search.toLowerCase();
      return (
        user.email.toLowerCase().includes(searchLower) ||
        user.full_name.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return enrichedUsers;
}

// ─── Update User Role ──────────────────────────────────────────────────

export async function updateUserRole(userId: string, role: 'student' | 'admin') {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  });

  if (error) {
    throw new Error(`Error actualizando rol: ${error.message}`);
  }

  revalidatePath('/admin');

  return { success: true };
}

// ─── Assign Membership to User ─────────────────────────────────────────

export async function assignMembership(
  userId: string,
  tier: 'apertura' | 'obturador' | 'diafragma',
  status: 'active' | 'trial' = 'active'
) {
  const supabase = createServiceRoleClient();

  // Deactivate existing subscription if any
  await supabase
    .from('subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'active');

  // Create new subscription
  const { error } = await supabase.from('subscriptions').insert({
    user_id: userId,
    tier,
    status,
    started_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Error asignando membresía: ${error.message}`);
  }

  revalidatePath('/admin');
  revalidatePath('/account');

  return { success: true };
}

// ─── Assign Course to User ─────────────────────────────────────────────

export async function assignCourse(userId: string, courseId: string) {
  const supabase = createServiceRoleClient();

  // Get course info
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('title')
    .eq('id', courseId)
    .single();

  if (courseError) {
    throw new Error(`Error obteniendo curso: ${courseError.message}`);
  }

  // Create purchase record
  const { error } = await supabase.from('course_purchases').insert({
    user_id: userId,
    course_id: courseId,
    price_paid: 0,
    amount: 0,
    currency: 'USD',
    provider: 'manual',
    provider_payment_id: `manual-${Date.now()}`,
    purchase_status: 'paid',
    discount_applied: 100,
  });

  if (error) {
    // Check if it's a duplicate (unique constraint)
    if (error.code === '23505') {
      throw new Error('El usuario ya tiene acceso a este curso');
    }
    throw new Error(`Error asignando curso: ${error.message}`);
  }

  revalidatePath('/admin');
  revalidatePath('/account');
  revalidatePath('/en-curso');

  return { success: true, courseTitle: course?.title };
}

// ─── Get All Courses for Assignment ────────────────────────────────────

export async function getCoursesForAssignment() {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('courses')
    .select('id, title, slug')
    .eq('status', 'public')
    .order('title', { ascending: true });

  if (error) {
    throw new Error(`Error obteniendo cursos: ${error.message}`);
  }

  return data ?? [];
}
