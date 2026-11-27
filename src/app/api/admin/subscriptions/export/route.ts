import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function GET(request: Request) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') || 'all';
    const tier = searchParams.get('tier') || 'all';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');

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
      (plans ?? []).map((p) => [
        p.slug,
        { monthly: p.monthly_price, annual: p.annual_monthly_price },
      ])
    );

    // Build subscription query
    let query = supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (tier !== 'all') {
      query = query.eq('tier', tier);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
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

    if (search) {
      const searchLower = search.toLowerCase();
      enriched = enriched.filter(
        (s) =>
          s.user_email.toLowerCase().includes(searchLower) ||
          s.user_name.toLowerCase().includes(searchLower) ||
          s.tier.toLowerCase().includes(searchLower)
      );
    }

    // Generate CSV
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

    const rows = enriched.map((s) => [
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

    return new NextResponse('﻿' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="suscripciones-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('[API/admin/subscriptions/export] Error:', error);
    return NextResponse.json({ error: 'Error generando CSV' }, { status: 500 });
  }
}
