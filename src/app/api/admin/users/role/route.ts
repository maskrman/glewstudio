import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function PATCH(request: Request) {
  try {
    const supabase = createServiceRoleClient();
    const { userId, role } = await request.json();

    if (!userId || !role || !['student', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { role },
    });

    if (error) {
      throw new Error(`Error actualizando rol: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/admin/users/role] Error:', error);
    return NextResponse.json({ error: 'Error cambiando rol' }, { status: 500 });
  }
}
