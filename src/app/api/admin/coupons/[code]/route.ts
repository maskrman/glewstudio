import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const supabase = createServiceRoleClient();
    const { code } = await params;
    const body = await request.json();

    // Normalize code to uppercase
    const updateData = { ...body };
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
      console.error('[API/admin/coupons/[code]] Supabase error updating coupon:', error);
      return NextResponse.json(
        { error: `Error actualizando cupón: ${error.message}` },
        { status: 500 }
      );
    }

    // Check if RLS blocked the update
    if (!coupon) {
      return NextResponse.json(
        { error: 'Cupón no encontrado o actualización bloqueada por políticas de seguridad' },
        { status: 404 }
      );
    }

    return NextResponse.json(coupon);
  } catch (error) {
    console.error('[API/admin/coupons/[code]] Error updating coupon:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const supabase = createServiceRoleClient();
    const { code } = await params;

    const { error } = await supabase.from('coupons').delete().eq('code', code.toUpperCase());

    if (error) {
      console.error('[API/admin/coupons/[code]] Supabase error deleting coupon:', error);
      return NextResponse.json(
        { error: `Error eliminando cupón: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/admin/coupons/[code]] Error deleting coupon:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
