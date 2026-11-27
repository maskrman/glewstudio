import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function POST(request: Request) {
  try {
    const supabase = createServiceRoleClient();
    const { userId, tier } = await request.json();

    if (!userId || !tier || !['apertura', 'obturador', 'diafragma'].includes(tier)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

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
      status: 'active',
      started_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Error asignando membresía: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/admin/users/membership] Error:', error);
    return NextResponse.json({ error: 'Error asignando membresía' }, { status: 500 });
  }
}
