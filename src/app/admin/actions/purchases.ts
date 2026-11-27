'use server';

/**
 * GLEW Studio — Admin Course Purchases API Routes
 * Server-side actions for purchase management with real data and CSV export
 */

import { createServiceRoleClient } from '@/lib/supabase/service';
import type { Database } from '@/types/supabase';

export type PurchaseWithDetails = Database['public']['Tables']['course_purchases']['Row'] & {
  user_email: string;
  user_name: string;
  course_title: string;
  course_slug: string;
};

export interface PurchaseFilters {
  search?: string;
  status?: 'paid' | 'pending' | 'refunded' | 'failed' | 'all';
  dateFrom?: string;
  dateTo?: string;
}

// ─── Get Purchases with Filters ────────────────────────────────────────

export async function getAdminPurchases(
  filters: PurchaseFilters = {}
): Promise<PurchaseWithDetails[]> {
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

  // Get courses for titles
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id, title, slug');

  if (coursesError) {
    throw new Error(`Error obteniendo cursos: ${coursesError.message}`);
  }

  const courseMap = new Map((courses ?? []).map((c) => [c.id, { title: c.title, slug: c.slug }]));

  // Build purchase query
  let query = supabase
    .from('course_purchases')
    .select('*')
    .order('purchased_at', { ascending: false });

  // Apply filters
  if (filters.status && filters.status !== 'all') {
    query = query.eq('purchase_status', filters.status);
  }
  if (filters.dateFrom) {
    query = query.gte('purchased_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('purchased_at', filters.dateTo);
  }

  const { data: purchases, error } = await query;

  if (error) {
    throw new Error(`Error obteniendo compras: ${error.message}`);
  }

  // Enrich with user and course data
  let enriched = (purchases ?? []).map((p) => {
    const user = userMap.get(p.user_id);
    const course = courseMap.get(p.course_id);
    return {
      ...p,
      user_email: user?.email ?? '—',
      user_name: user?.name ?? '—',
      course_title: course?.title ?? p.course_id,
      course_slug: course?.slug ?? '—',
    };
  });

  // Apply search filter (client-side for email/name/course)
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    enriched = enriched.filter(
      (p) =>
        p.user_email.toLowerCase().includes(searchLower) ||
        p.user_name.toLowerCase().includes(searchLower) ||
        p.course_title.toLowerCase().includes(searchLower)
    );
  }

  return enriched;
}

// ─── Get Purchase Stats ────────────────────────────────────────────────

export async function getPurchaseStats() {
  const supabase = createServiceRoleClient();

  const { data: purchases, error } = await supabase
    .from('course_purchases')
    .select('purchase_status, price_paid, purchased_at');

  if (error) {
    throw new Error(`Error obteniendo stats: ${error.message}`);
  }

  const paid = purchases?.filter((p) => p.purchase_status === 'paid') ?? [];
  const totalRevenue = paid.reduce((sum, p) => sum + (p.price_paid || 0), 0);

  const stats = {
    total: purchases?.length ?? 0,
    paid: paid.length,
    pending: purchases?.filter((p) => p.purchase_status === 'pending').length ?? 0,
    refunded: purchases?.filter((p) => p.purchase_status === 'refunded').length ?? 0,
    failed: purchases?.filter((p) => p.purchase_status === 'failed').length ?? 0,
    totalRevenue: Math.round(totalRevenue),
    averageTicket: paid.length > 0 ? Math.round(totalRevenue / paid.length) : 0,
  };

  return stats;
}

// ─── CSV Export ────────────────────────────────────────────────────────

export async function exportPurchasesCSV(filters: PurchaseFilters = {}): Promise<string> {
  const purchases = await getAdminPurchases(filters);

  const headers = [
    'ID',
    'Usuario (Email)',
    'Nombre',
    'Curso',
    'Slug del Curso',
    'Monto Pagado (USD)',
    'Moneda',
    'Proveedor',
    'ID de Pago Proveedor',
    'Estado',
    'Descuento Aplicado (%)',
    'Fecha de Compra',
    'Creado',
    'Actualizado',
  ];

  const rows = purchases.map((p) => [
    p.id,
    p.user_email,
    p.user_name,
    p.course_title,
    p.course_slug,
    (p.price_paid ?? 0).toFixed(2),
    p.currency ?? 'USD',
    p.provider ?? '—',
    p.provider_payment_id ?? '—',
    p.purchase_status,
    (p.discount_applied ?? 0).toFixed(0),
    p.purchased_at ? new Date(p.purchased_at).toLocaleDateString('es-ES') : '—',
    p.created_at ? new Date(p.created_at).toLocaleDateString('es-ES') : '—',
    p.updated_at ? new Date(p.updated_at).toLocaleDateString('es-ES') : '—',
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return '﻿' + csv; // BOM for Excel UTF-8
}
