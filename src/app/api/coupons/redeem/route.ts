import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

/**
 * POST /api/coupons/redeem
 *
 * Server-side endpoint to increment coupon usage after successful signup/checkout.
 * Uses service_role to bypass RLS and call the increment_coupon_usage DB function.
 *
 * Body: { userId: string, couponCode: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const body = await req.json();

    const { userId, couponCode } = body as {
      userId?: string;
      couponCode?: string;
    };

    if (!userId || !couponCode) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and couponCode' },
        { status: 400 }
      );
    }

    // Verify the user exists
    const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !authUser?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Call the DB function to increment coupon usage (service_role bypasses RLS)
    const { error: rpcError } = await supabase.rpc('increment_coupon_usage', {
      p_code: couponCode.toUpperCase(),
    });

    if (rpcError) {
      console.error('[API/coupons/redeem] Error incrementing coupon usage:', rpcError.message);
      return NextResponse.json(
        { error: `Error incrementando uso del cupón: ${rpcError.message}` },
        { status: 500 }
      );
    }

    // Verify the coupon still has available uses (optional, for logging)
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('code, current_uses, max_uses')
      .eq('code', couponCode.toUpperCase())
      .single();

    if (couponError) {
      console.warn('[API/coupons/redeem] Could not verify coupon after increment:', couponError.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Cupón aplicado correctamente',
      coupon: coupon ?? null,
    });
  } catch (error) {
    console.error('[API/coupons/redeem] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    );
  }
}