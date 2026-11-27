import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('courses')
      .select('id, title, slug')
      .eq('status', 'public')
      .order('title', { ascending: true });

    if (error) {
      throw new Error(`Error obteniendo cursos: ${error.message}`);
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error('[API/admin/courses-for-assignment] Error:', error);
    return NextResponse.json({ error: 'Error obteniendo cursos' }, { status: 500 });
  }
}
