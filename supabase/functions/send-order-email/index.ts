import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const { email, name, orderId, planName, planSubtitle, price, billingCycle, annualTotal, purchaseDate, renewalDate, features } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const featuresHtml = (features as string[])
      .map((f: string) => `<li style="margin:4px 0;color:#d1d5db;">✓ ${f}</li>`)
      .join("");

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recibo de Compra — Glewstudio</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#c9a227,#f0c040);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#0a0a0a;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Glewstudio</h1>
              <p style="margin:6px 0 0;color:#0a0a0a;font-size:13px;opacity:0.75;">Aprende fotografía con los mejores instructores</p>
            </td>
          </tr>

          <!-- Success badge -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <div style="display:inline-block;background:#16a34a22;border:1px solid #16a34a55;border-radius:50px;padding:8px 20px;margin-bottom:16px;">
                <span style="color:#4ade80;font-size:13px;font-weight:700;">✓ Suscripción Activada</span>
              </div>
              <h2 style="margin:0 0 8px;color:#f9fafb;font-size:22px;font-weight:800;">¡Gracias por tu compra, ${name}!</h2>
              <p style="margin:0;color:#9ca3af;font-size:14px;">Tu pago fue procesado exitosamente. Ya tienes acceso completo a tu plan.</p>
            </td>
          </tr>

          <!-- Plan card -->
          <tr>
            <td style="padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #2a2a2a;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="display:inline-block;background:#c9a22722;color:#c9a227;font-size:11px;font-weight:700;padding:3px 10px;border-radius:50px;margin-bottom:8px;">${planSubtitle}</span>
                          <h3 style="margin:0 0 4px;color:#f9fafb;font-size:18px;font-weight:800;">Plan ${planName}</h3>
                          <p style="margin:0;color:#9ca3af;font-size:12px;">Suscripción ${billingCycle === 'annual' ? 'anual' : 'mensual'} · Acceso inmediato</p>
                        </td>
                        <td style="text-align:right;vertical-align:top;">
                          <p style="margin:0;color:#c9a227;font-size:22px;font-weight:800;">$${price}<span style="font-size:12px;color:#9ca3af;font-weight:400;">/mes</span></p>
                          <p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">Facturado anualmente</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;">
                    <ul style="margin:0;padding:0;list-style:none;">
                      ${featuresHtml}
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Billing details -->
          <tr>
            <td style="padding:0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;">
                <tr>
                  <td style="padding:16px 24px;border-bottom:1px solid #2a2a2a;">
                    <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Detalle de Facturación</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:5px 0;color:#9ca3af;font-size:13px;">Número de orden</td>
                        <td style="padding:5px 0;color:#f9fafb;font-size:12px;font-weight:600;text-align:right;font-family:monospace;">${orderId}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#9ca3af;font-size:13px;">Fecha de compra</td>
                        <td style="padding:5px 0;color:#f9fafb;font-size:13px;font-weight:600;text-align:right;">${purchaseDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#9ca3af;font-size:13px;">Ciclo de facturación</td>
                        <td style="padding:5px 0;color:#f9fafb;font-size:13px;font-weight:600;text-align:right;">${billingCycle === 'annual' ? 'Anual' : 'Mensual'}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#9ca3af;font-size:13px;">Próxima renovación</td>
                        <td style="padding:5px 0;color:#f9fafb;font-size:13px;font-weight:600;text-align:right;">${renewalDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#9ca3af;font-size:13px;">Estado</td>
                        <td style="padding:5px 0;text-align:right;"><span style="color:#4ade80;font-size:13px;font-weight:700;">● Activo</span></td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top:12px;border-top:1px solid #2a2a2a;"></td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;color:#f9fafb;font-size:14px;font-weight:700;">Total cobrado</td>
                        <td style="padding:5px 0;color:#c9a227;font-size:16px;font-weight:800;text-align:right;">$${annualTotal}.00 USD</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Invoice attachment note -->
          <tr>
            <td style="padding:0 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#c9a22710;border:1px solid #c9a22730;border-radius:12px;padding:16px 20px;">
                <tr>
                  <td>
                    <p style="margin:0;color:#c9a227;font-size:13px;font-weight:600;">📄 Tu recibo está adjunto a este correo</p>
                    <p style="margin:4px 0 0;color:#9ca3af;font-size:12px;">Guarda este correo como comprobante de tu suscripción a Glewstudio.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <a href="https://glewstudio7616.builtwithrocket.new/dashboard" style="display:inline-block;background:linear-gradient(135deg,#c9a227,#f0c040);color:#0a0a0a;font-size:14px;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;">
                Comenzar a Aprender →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #2a2a2a;text-align:center;">
              <p style="margin:0;color:#6b7280;font-size:11px;">© 2026 Glewstudio · Todos los derechos reservados</p>
              <p style="margin:4px 0 0;color:#6b7280;font-size:11px;">
                <a href="https://glewstudio7616.builtwithrocket.new" style="color:#c9a227;text-decoration:none;">glewstudio7616.builtwithrocket.new</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Plain text invoice attachment content
    const invoiceText = `GLEWSTUDIO — RECIBO DE COMPRA
==============================
Número de Orden: ${orderId}
Fecha: ${purchaseDate}
------------------------------
Plan: ${planName} (${planSubtitle})
Ciclo de Facturación: ${billingCycle === 'annual' ? 'Anual' : 'Mensual'}
Precio mensual: $${price}/mes
Total anual: $${annualTotal}.00 USD
------------------------------
Estado: PAGADO
Próxima renovación: ${renewalDate}
==============================
Gracias por suscribirte a Glewstudio.
Aprende fotografía con los mejores instructores.
https://glewstudio7616.builtwithrocket.new`;

    const invoiceBase64 = btoa(unescape(encodeURIComponent(invoiceText)));

    const resendPayload = {
      from: "onboarding@resend.dev",
      to: [email],
      subject: `✓ Suscripción activada — Plan ${planName} | Glewstudio`,
      html,
      attachments: [
        {
          filename: `recibo-${orderId}.txt`,
          content: invoiceBase64,
        },
      ],
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      throw new Error(resendData?.message || "Failed to send email via Resend");
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
