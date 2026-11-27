import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    const { data: coupons, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API/admin/coupons] Supabase error:', error);
      return NextResponse.json(
        { error: `Error obteniendo cupones: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(coupons ?? []);
  } catch (error) {
    console.error('[API/admin/coupons] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServiceRoleClient();
    const body = await request.json();

    // Normalize code to uppercase
    const couponData = {
      ...body,
      code: body.code?.toUpperCase(),
    };

    const { data: coupon, error } = await supabase
      .from('coupons')
      .insert(couponData)
      .select()
      .single();

    if (error) {
      console.error('[API/admin/coupons] Supabase error creating coupon:', error);
      return NextResponse.json({ error: `Error creando cupón: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json(coupon, { status: 201 });
  } catch (error) {
    console.error('[API/admin/coupons] Error creating coupon:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
