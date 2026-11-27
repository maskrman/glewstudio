import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function GET(request: Request) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

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

    if (status !== 'all') {
      query = query.eq('purchase_status', status);
    }
    if (dateFrom) {
      query = query.gte('purchased_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('purchased_at', dateTo);
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

    if (search) {
      const searchLower = search.toLowerCase();
      enriched = enriched.filter(
        (p) =>
          p.user_email.toLowerCase().includes(searchLower) ||
          p.user_name.toLowerCase().includes(searchLower) ||
          p.course_title.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('[API/admin/purchases] Error:', error);
    return NextResponse.json({ error: 'Error obteniendo compras' }, { status: 500 });
  }
}
