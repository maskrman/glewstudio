import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Restrict CORS to legitimate application domains only
const ALLOWED_ORIGINS = [
  'https://glewstudio5224.builtwithrocket.new',
  'https://glewstudio7616.builtwithrocket.new',
  process.env.NEXT_PUBLIC_SITE_URL,
].filter(Boolean) as string[];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// Brute-force protection constants
const MAX_ATTEMPTS_PER_OTP = 5; // Max failed attempts before OTP is invalidated

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse('ok', { headers: getCorsHeaders(origin) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const { email, code, type = 'signup' } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400, headers: corsHeaders });
    }

    // Basic input validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400, headers: corsHeaders });
    }

    // OTP must be exactly 6 digits
    if (!/^\d{6}$/.test(String(code))) {
      return NextResponse.json(
        { error: 'Código incorrecto o expirado. Verifica e intenta de nuevo.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Look up the most recent unused, non-expired OTP for this email+type
    // Do NOT filter by code yet — we need to check attempt_count first
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('type', type)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .is('invalidated_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !otpRecord) {
      return NextResponse.json(
        { error: 'Código incorrecto o expirado. Verifica e intenta de nuevo.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if max attempts exceeded
    const currentAttempts = otpRecord.attempt_count ?? 0;
    if (currentAttempts >= MAX_ATTEMPTS_PER_OTP) {
      // Invalidate the OTP
      await supabaseAdmin
        .from('otp_codes')
        .update({ invalidated_at: new Date().toISOString() })
        .eq('id', otpRecord.id);

      return NextResponse.json(
        { error: 'Demasiados intentos fallidos. Solicita un nuevo código.' },
        { status: 429, headers: corsHeaders }
      );
    }

    // Verify the code matches
    if (otpRecord.code !== String(code)) {
      // Increment attempt_count on failure
      const newAttemptCount = currentAttempts + 1;
      const updatePayload: Record<string, unknown> = { attempt_count: newAttemptCount };

      // Invalidate if max attempts reached after this failure
      if (newAttemptCount >= MAX_ATTEMPTS_PER_OTP) {
        updatePayload.invalidated_at = new Date().toISOString();
      }

      await supabaseAdmin
        .from('otp_codes')
        .update(updatePayload)
        .eq('id', otpRecord.id);

      const remainingAttempts = MAX_ATTEMPTS_PER_OTP - newAttemptCount;
      const errorMsg = remainingAttempts > 0
        ? `Código incorrecto. Te quedan ${remainingAttempts} intento(s).`
        : 'Demasiados intentos fallidos. Solicita un nuevo código.';

      return NextResponse.json(
        { error: errorMsg },
        { status: 400, headers: corsHeaders }
      );
    }

    // Code matches — mark OTP as used (invalidated after use)
    await supabaseAdmin
      .from('otp_codes')
      .update({ used: true, invalidated_at: new Date().toISOString() })
      .eq('id', otpRecord.id);

    if (type === 'recovery') {
      return NextResponse.json({ success: true, verified: true }, { headers: corsHeaders });
    }

    // For signup: find the user and confirm their email
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
    if (getUserError) {
      return NextResponse.json({ error: getUserError.message }, { status: 500, headers: corsHeaders });
    }

    const user = userData?.users?.find((u) => u.email === email);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404, headers: corsHeaders });
    }

    // Confirm the user's email
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      email_confirm: true,
    });

    if (updateError) {
      console.error('Email confirm error:', updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500, headers: corsHeaders });
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
