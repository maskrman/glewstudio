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
    const { email, name, type = 'signup' } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your-resend-api-key-here') {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let otpCode: string | null = null;

    if (type === 'recovery') {
      // For password recovery: use generateLink with type 'recovery'
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
      });

      if (linkError) {
        console.error('generateLink recovery error:', linkError.message);
        return NextResponse.json({ error: linkError.message }, { status: 400 });
      }

      otpCode = linkData?.properties?.email_otp ?? null;
    } else {
      // For signup: use generateLink with type 'signup' — generates a proper 6-digit email_otp
      // The user was just created via supabase.auth.signUp(), so they exist as unconfirmed
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email,
        password: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
      });

      if (linkError) {
        // If user already confirmed, fall back to magiclink which also produces email_otp
        console.warn('generateLink signup error, trying magiclink fallback:', linkError.message);
        const { data: mlData, error: mlError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email,
        });
        if (mlError) {
          console.error('generateLink magiclink fallback error:', mlError.message);
          return NextResponse.json({ error: mlError.message }, { status: 400 });
        }
        otpCode = mlData?.properties?.email_otp ?? null;
      } else {
        otpCode = linkData?.properties?.email_otp ?? null;
      }
    }

    // Ensure we have a 6-digit numeric code
    if (!otpCode || !/^\d{6}$/.test(otpCode)) {
      console.error('OTP code invalid or not 6 digits:', otpCode);
      return NextResponse.json({ error: 'No se pudo generar el código OTP de 6 dígitos' }, { status: 500 });
    }

    // Send the OTP email via Resend
    const subject =
      type === 'recovery'
        ? `${otpCode} es tu código de recuperación - GlewStudio`
        : `${otpCode} es tu código de verificación - GlewStudio`;

    const htmlContent =
      type === 'recovery' ? getRecoveryTemplate(name ||'', otpCode)
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
        { status: 500 }
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
