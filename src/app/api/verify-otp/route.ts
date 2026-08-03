import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export async function OPTIONS() {
  return new NextResponse('ok', { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const { email, code, type = 'signup' } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Look up the OTP record
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('type', type)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      return NextResponse.json(
        { error: 'Código incorrecto o expirado. Verifica e intenta de nuevo.' },
        { status: 400 }
      );
    }

    // Mark OTP as used
    await supabaseAdmin
      .from('otp_codes')
      .update({ used: true })
      .eq('id', otpRecord.id);

    if (type === 'recovery') {
      return NextResponse.json({ success: true, verified: true }, { headers: corsHeaders });
    }

    // For signup: find the user and confirm their email
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
    if (getUserError) {
      return NextResponse.json({ error: getUserError.message }, { status: 500 });
    }

    const user = userData?.users?.find((u) => u.email === email);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Confirm the user's email
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });

    if (updateError) {
      console.error('Email confirm error:', updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, verified: true, userId: user.id },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('verify-otp error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}
