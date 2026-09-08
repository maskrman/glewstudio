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

// OTP brute-force protection constants
const MAX_RESEND_PER_WINDOW = 3;       // Max resend requests per email per window
const RESEND_WINDOW_MINUTES = 15;      // Window duration in minutes
const RESEND_COOLDOWN_SECONDS = 60;    // Min seconds between resend requests

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  return new NextResponse('ok', { headers: getCorsHeaders(origin) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const { email, name, type = 'signup' } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400, headers: corsHeaders });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400, headers: corsHeaders });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Anti-spam / resend rate limiting ──────────────────────────────────────
    // Count recent OTP requests for this email+type within the window
    const windowStart = new Date(Date.now() - RESEND_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { data: recentOtps, error: countError } = await supabaseAdmin
      .from('otp_codes')
      .select('id, last_resend_at, resend_count, created_at')
      .eq('email', email)
      .eq('type', type)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false });

    if (!countError && recentOtps && recentOtps.length >= MAX_RESEND_PER_WINDOW) {
      return NextResponse.json(
        { error: `Demasiadas solicitudes. Espera ${RESEND_WINDOW_MINUTES} minutos antes de solicitar otro código.` },
        { status: 429, headers: corsHeaders }
      );
    }

    // Enforce cooldown between resend requests
    if (!countError && recentOtps && recentOtps.length > 0) {
      const lastOtp = recentOtps[0];
      const lastResendAt = lastOtp.last_resend_at ?? lastOtp.created_at;
      if (lastResendAt) {
        const secondsSinceLast = (Date.now() - new Date(lastResendAt).getTime()) / 1000;
        if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
          const waitSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast);
          return NextResponse.json(
            { error: `Espera ${waitSeconds} segundos antes de solicitar otro código.` },
            { status: 429, headers: corsHeaders }
          );
        }
      }
    }

    // ── Generate cryptographically secure OTP ─────────────────────────────────
    // Use crypto.getRandomValues() instead of Math.random()
    // crypto is available in Next.js API routes (Node.js 19+ / Web Crypto API)
    const otpCode = generateSecureOtp();

    // Delete any existing unused OTPs for this email+type to avoid confusion
    await supabaseAdmin
      .from('otp_codes')
      .delete()
      .eq('email', email)
      .eq('type', type)
      .eq('used', false);

    // Store the new OTP in the database
    const { error: insertError } = await supabaseAdmin
      .from('otp_codes')
      .insert({
        email,
        code: otpCode,
        type,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        used: false,
        attempt_count: 0,
        resend_count: recentOtps ? recentOtps.length : 0,
        last_resend_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('OTP insert error:', insertError.message);
      return NextResponse.json({ error: 'No se pudo generar el código OTP' }, { status: 500, headers: corsHeaders });
    }

    // Send the OTP email via Resend
    const subject =
      type === 'recovery'
        ? `${otpCode} es tu código de recuperación - GlewStudio`
        : `${otpCode} es tu código de verificación - GlewStudio`;

    const htmlContent =
      type === 'recovery' ? getRecoveryTemplate(name || '', otpCode)
        : getOtpTemplate(name || '', otpCode);

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'GlewStudio <onboarding@resend.dev>',
        to: [email],
        subject,
        html: htmlContent,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error('Resend error:', resendData);
      return NextResponse.json(
        { error: resendData?.message || 'Failed to send email' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('send-otp error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Generate a cryptographically secure 6-digit OTP.
 * Uses crypto.getRandomValues() — NOT Math.random().
 *
 * Math.random() is NOT cryptographically secure and can be predicted.
 * crypto.getRandomValues() uses the OS CSPRNG.
 */
function generateSecureOtp(): string {
  // Generate a random number in range [100000, 999999]
  // Use rejection sampling to avoid modulo bias
  const array = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(array);
    value = array[0] % 1000000;
  } while (value < 100000);
  return String(value);
}

// ─── OTP Verification Template ────────────────────────────────────────────────
function getOtpTemplate(name: string, code: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Código de Verificación - GlewStudio</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;max-width:500px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#c9a227,#f0c040);padding:28px 40px;text-align:center;">
              <h1 style="margin:0;color:#0a0a0a;font-size:22px;font-weight:800;">GlewStudio</h1>
              <p style="margin:4px 0 0;color:#0a0a0a;font-size:12px;opacity:0.75;">Plataforma Premium de Fotografía</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;text-align:center;">
              <h2 style="margin:0 0 12px;color:#f9fafb;font-size:20px;font-weight:800;">Verifica tu cuenta</h2>
              <p style="margin:0 0 28px;color:#9ca3af;font-size:14px;line-height:1.6;">
                Hola ${name || 'usuario'},<br/>
                Usa el siguiente código de 6 dígitos para completar tu registro en GlewStudio:
              </p>
              <div style="background:#1a1a1a;border:2px solid #c9a22740;border-radius:12px;padding:24px 32px;display:inline-block;margin-bottom:28px;">
                <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#c9a227;font-family:monospace;">${code}</span>
              </div>
              <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
                Este código caduca en <strong style="color:#9ca3af;">10 minutos</strong>.<br/>
                Si no solicitaste este registro, puedes ignorar este correo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 28px;border-top:1px solid #2a2a2a;text-align:center;">
              <p style="margin:0;color:#6b7280;font-size:11px;">© 2026 GlewStudio · Todos los derechos reservados</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Recovery OTP Template ────────────────────────────────────────────────────
function getRecoveryTemplate(name: string, code: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recuperación de Contraseña - GlewStudio</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;max-width:500px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#c9a227,#f0c040);padding:28px 40px;text-align:center;">
              <h1 style="margin:0;color:#0a0a0a;font-size:22px;font-weight:800;">GlewStudio</h1>
              <p style="margin:4px 0 0;color:#0a0a0a;font-size:12px;opacity:0.75;">Plataforma Premium de Fotografía</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;text-align:center;">
              <h2 style="margin:0 0 12px;color:#f9fafb;font-size:20px;font-weight:800;">Recupera tu contraseña</h2>
              <p style="margin:0 0 28px;color:#9ca3af;font-size:14px;line-height:1.6;">
                Hola ${name || 'usuario'},<br/>
                Usa el siguiente código de 6 dígitos para restablecer tu contraseña:
              </p>
              <div style="background:#1a1a1a;border:2px solid #c9a22740;border-radius:12px;padding:24px 32px;display:inline-block;margin-bottom:28px;">
                <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#c9a227;font-family:monospace;">${code}</span>
              </div>
              <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
                Este código caduca en <strong style="color:#9ca3af;">10 minutos</strong>.<br/>
                Si no solicitaste este cambio, puedes ignorar este correo.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 28px;border-top:1px solid #2a2a2a;text-align:center;">
              <p style="margin:0;color:#6b7280;font-size:11px;">© 2026 GlewStudio · Todos los derechos reservados</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
