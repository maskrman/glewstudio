'use server';

/**
 * GLEW Studio — Admin Subscriptions API Routes
 * Server-side actions for subscription management with real data and CSV export
 */

import { createServiceRoleClient } from '@/lib/supabase/service';
import type { Database } from '@/types/supabase';

export type SubscriptionWithUser = Database['public']['Tables']['subscriptions']['Row'] & {
  user_email: string;
  user_name: string;
  plan_monthly_price: number;
  plan_annual_price: number;
};

export interface SubscriptionFilters {
  search?: string;
  status?: 'active' | 'cancelled' | 'expired' | 'trial' | 'all';
  tier?: 'apertura' | 'obturador' | 'diafragma' | 'all';
  dateFrom?: string;
  dateTo?: string;
}

// ─── Get Subscriptions with Filters ────────────────────────────────────

export async function getAdminSubscriptions(
  filters: SubscriptionFilters = {}
): Promise<SubscriptionWithUser[]> {
  const supabase = createServiceRoleClient();

  // Get all auth users for email/name
  const { data: usersResult, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    throw new Error(`Error obteniendo usuarios: ${usersError.message}`);
  }

  const userMap = new Map(
    (usersResult.users ?? []).map((u) => [
      u.id,
      { email: u.email ?? '', name: u.user_metadata?.full_name ?? '' },
    ])
  );

  // Get membership plans for pricing
  const { data: plans, error: plansError } = await supabase
    .from('membership_plans')
    .select('slug, monthly_price, annual_monthly_price');

  if (plansError) {
    throw new Error(`Error obteniendo planes: ${plansError.message}`);
  }

  const planMap = new Map(
    (plans ?? []).map((p) => [p.slug, { monthly: p.monthly_price, annual: p.annual_monthly_price }])
  );

  // Build subscription query
  let query = supabase.from('subscriptions').select('*').order('created_at', { ascending: false });

  // Apply filters
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.tier && filters.tier !== 'all') {
    query = query.eq('tier', filters.tier);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  const { data: subscriptions, error } = await query;

  if (error) {
    throw new Error(`Error obteniendo suscripciones: ${error.message}`);
  }

  // Enrich with user and plan data
  let enriched = (subscriptions ?? []).map((sub) => {
    const user = userMap.get(sub.user_id);
    const plan = planMap.get(sub.tier);
    return {
      ...sub,
      user_email: user?.email ?? '—',
      user_name: user?.name ?? '—',
      plan_monthly_price: plan?.monthly ?? 0,
      plan_annual_price: plan?.annual ?? 0,
    };
  });

  // Apply search filter (client-side for email/name)
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    enriched = enriched.filter(
      (s) =>
        s.user_email.toLowerCase().includes(searchLower) ||
        s.user_name.toLowerCase().includes(searchLower) ||
        s.tier.toLowerCase().includes(searchLower)
    );
  }

  return enriched;
}

// ─── Get Subscription Stats ────────────────────────────────────────────

export async function getSubscriptionStats() {
  const supabase = createServiceRoleClient();

  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('status, tier, created_at');

  if (error) {
    throw new Error(`Error obteniendo stats: ${error.message}`);
  }

  const stats = {
    total: subscriptions?.length ?? 0,
    active: subscriptions?.filter((s) => s.status === 'active').length ?? 0,
    cancelled: subscriptions?.filter((s) => s.status === 'cancelled').length ?? 0,
    expired: subscriptions?.filter((s) => s.status === 'expired').length ?? 0,
    trial: subscriptions?.filter((s) => s.status === 'trial').length ?? 0,
    byTier: {
      apertura: subscriptions?.filter((s) => s.tier === 'apertura').length ?? 0,
      obturador: subscriptions?.filter((s) => s.tier === 'obturador').length ?? 0,
      diafragma: subscriptions?.filter((s) => s.tier === 'diafragma').length ?? 0,
    },
  };

  return stats;
}

// ─── CSV Export ────────────────────────────────────────────────────────

export async function exportSubscriptionsCSV(filters: SubscriptionFilters = {}): Promise<string> {
  const subscriptions = await getAdminSubscriptions(filters);

  const headers = [
    'ID',
    'Usuario (Email)',
    'Nombre',
    'Plan',
    'Estado',
    'Precio Mensual (USD)',
    'Precio Anual (USD/mes)',
    'Inicio',
    'Expira',
    'Creado',
    'Actualizado',
  ];

  const rows = subscriptions.map((s) => [
    s.id,
    s.user_email,
    s.user_name,
    s.tier,
    s.status,
    s.plan_monthly_price.toFixed(2),
    s.plan_annual_price.toFixed(2),
    s.started_at ? new Date(s.started_at).toLocaleDateString('es-ES') : '—',
    s.expires_at ? new Date(s.expires_at).toLocaleDateString('es-ES') : '—',
    s.created_at ? new Date(s.created_at).toLocaleDateString('es-ES') : '—',
    s.updated_at ? new Date(s.updated_at).toLocaleDateString('es-ES') : '—',
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return '﻿' + csv; // BOM for Excel UTF-8
}
