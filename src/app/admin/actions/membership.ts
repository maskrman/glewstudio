'use server';

/**
 * GLEW Studio — Admin Membership Plans API Routes
 * Server-side actions for membership plan management
 */

import { createServiceRoleClient } from '@/lib/supabase/service';
import type { Database } from '@/types/supabase';
import { revalidatePath } from 'next/cache';

export type MembershipPlan = Database['public']['Tables']['membership_plans']['Row'];
type MembershipPlanInsert = Database['public']['Tables']['membership_plans']['Insert'];
type MembershipPlanUpdate = Database['public']['Tables']['membership_plans']['Update'];

// ─── Get All Membership Plans ──────────────────────────────────────────────────

export async function getMembershipPlans(): Promise<MembershipPlan[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .order('monthly_price', { ascending: true });

  if (error) {
    throw new Error(`Error obteniendo planes de membresía: ${error.message}`);
  }

  return data ?? [];
}

// ─── Get Single Membership Plan ─────────────────────────────────────────────────

export async function getMembershipPlan(slug: string): Promise<MembershipPlan | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Error obteniendo plan de membresía: ${error.message}`);
  }

  return data;
}

// ─── Create Membership Plan ─────────────────────────────────────────────────────

export async function createMembershipPlan(data: MembershipPlanInsert) {
  const supabase = createServiceRoleClient();

  const { data: plan, error } = await supabase
    .from('membership_plans')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`Error creando plan de membresía: ${error.message}`);
  }

  revalidateAllAffectedPaths();

  return plan;
}

// ─── Update Membership Plan ─────────────────────────────────────────────────────

export async function updateMembershipPlan(slug: string, data: MembershipPlanUpdate) {
  const supabase = createServiceRoleClient();

  const { data: plan, error } = await supabase
    .from('membership_plans')
    .update(data)
    .eq('slug', slug)
    .select()
    .single();

  if (error) {
    throw new Error(`Error actualizando plan de membresía: ${error.message}`);
  }

  // Check if RLS blocked the update
  if (!plan) {
    throw new Error(
      'Actualización bloqueada por políticas de seguridad (RLS). Verifica que el usuario tenga permisos de escritura en la tabla membership_plans.'
    );
  }

  revalidateAllAffectedPaths();

  return plan;
}

// ─── Delete Membership Plan ─────────────────────────────────────────────────────

export async function deleteMembershipPlan(slug: string) {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from('membership_plans').delete().eq('slug', slug);

  if (error) {
    throw new Error(`Error eliminando plan de membresía: ${error.message}`);
  }

  revalidateAllAffectedPaths();

  return { success: true };
}

// ─── Helper: Revalidate all paths affected by membership plan changes ────────────
function revalidateAllAffectedPaths() {
  revalidatePath('/');
  revalidatePath('/planes');
  revalidatePath('/sign-up-login');
  revalidatePath('/account-subscription-management');
  revalidatePath('/account');
  revalidatePath('/admin');
  revalidatePath('/courses');
}

// ─── Public Action: Get Membership Plans for Landing/Plans Page ────────────────

export async function getPublicMembershipPlans(): Promise<MembershipPlan[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .order('monthly_price', { ascending: true });

  if (error) {
    throw new Error(`Error obteniendo planes de membresía públicos: ${error.message}`);
  }

  return data ?? [];
}
