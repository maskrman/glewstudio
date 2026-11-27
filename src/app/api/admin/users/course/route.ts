import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function POST(request: Request) {
  try {
    const supabase = createServiceRoleClient();
    const { userId, courseId } = await request.json();

    if (!userId || !courseId) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    // Get course info
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('title')
      .eq('id', courseId)
      .single();

    if (courseError) {
      throw new Error(`Error obteniendo curso: ${courseError.message}`);
    }

    // Create purchase record (manual assignment)
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
        return NextResponse.json(
          { error: 'El usuario ya tiene acceso a este curso' },
          { status: 409 }
        );
      }
      throw new Error(`Error asignando curso: ${error.message}`);
    }

    return NextResponse.json({ success: true, courseTitle: course?.title });
  } catch (error) {
    console.error('[API/admin/users/course] Error:', error);
    return NextResponse.json({ error: 'Error asignando curso' }, { status: 500 });
  }
}
