'use server';

/**
 * GLEW Studio — Admin Coupons API Routes
 * Server-side actions for coupon management
 */

import { createServiceRoleClient } from '@/lib/supabase/service';
import type { Database } from '@/types/supabase';
import { revalidatePath } from 'next/cache';

export type Coupon = Database['public']['Tables']['coupons']['Row'];
type CouponInsert = Database['public']['Tables']['coupons']['Insert'];
type CouponUpdate = Database['public']['Tables']['coupons']['Update'];

// ─── Get All Coupons ────────────────────────────────────────────────────

export async function getCoupons(): Promise<Coupon[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error obteniendo cupones: ${error.message}`);
  }

  return data ?? [];
}

// ─── Get Single Coupon ─────────────────────────────────────────────────

export async function getCoupon(code: string): Promise<Coupon | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Error obteniendo cupón: ${error.message}`);
  }

  return data;
}

// ─── Create Coupon ─────────────────────────────────────────────────────

export async function createCoupon(data: CouponInsert) {
  const supabase = createServiceRoleClient();

  // Normalize code to uppercase
  const insertData: CouponInsert = {
    ...data,
    code: data.code.toUpperCase(),
  };

  const { data: coupon, error } = await supabase
    .from('coupons')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Error creando cupón: ${error.message}`);
  }

  revalidateAllAffectedPaths();

  return coupon;
}

// ─── Update Coupon ─────────────────────────────────────────────────────

export async function updateCoupon(code: string, data: CouponUpdate) {
  const supabase = createServiceRoleClient();

  // Normalize code to uppercase if provided
  const updateData: CouponUpdate = { ...data };
  if (updateData.code) {
    updateData.code = updateData.code.toUpperCase();
  }

  const { data: coupon, error } = await supabase
    .from('coupons')
    .update(updateData)
    .eq('code', code.toUpperCase())
    .select()
    .single();

  if (error) {
    throw new Error(`Error actualizando cupón: ${error.message}`);
  }

  // Check if RLS blocked the update
  if (!coupon) {
    throw new Error(
      'Actualización bloqueada por políticas de seguridad (RLS). Verifica que el usuario tenga permisos de escritura en la tabla coupons.'
    );
  }

  revalidateAllAffectedPaths();

  return coupon;
}

// ─── Delete Coupon ─────────────────────────────────────────────────────

export async function deleteCoupon(code: string) {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from('coupons').delete().eq('code', code.toUpperCase());

  if (error) {
    throw new Error(`Error eliminando cupón: ${error.message}`);
  }

  revalidateAllAffectedPaths();

  return { success: true };
}

// ─── Toggle Coupon Active Status ───────────────────────────────────────

export async function toggleCouponStatus(code: string, isActive: boolean) {
  const supabase = createServiceRoleClient();

  const { data: coupon, error } = await supabase
    .from('coupons')
    .update({ is_active: isActive })
    .eq('code', code.toUpperCase())
    .select()
    .single();

  if (error) {
    throw new Error(`Error cambiando estado del cupón: ${error.message}`);
  }

  revalidateAllAffectedPaths();

  return coupon;
}

// ─── Helper: Revalidate all paths affected by coupon changes ───────────

function revalidateAllAffectedPaths() {
  revalidatePath('/admin');
  revalidatePath('/sign-up-login');
  revalidatePath('/planes');
  revalidatePath('/checkout');
}
