import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const { type, email, name, otpCode, orderDetails } = await req.json();

    let subject = "";
    let htmlContent = "";

    if (type === "OTP_VERIFICATION") {
      if (!otpCode) throw new Error("otpCode is required for OTP_VERIFICATION");
      subject = `${otpCode} es tu código de verificación - GlewStudio`;
      htmlContent = getOtpTemplate(name, otpCode);
    } else if (type === "WELCOME") {
      subject = "¡Bienvenido/a a GlewStudio! 🚀";
      htmlContent = getWelcomeTemplate(name);
    } else if (type === "INVOICE") {
      if (!orderDetails) throw new Error("orderDetails is required for INVOICE");
      subject = `Factura de compra #${orderDetails.invoiceId} - GlewStudio`;
      htmlContent = getInvoiceTemplate(name, orderDetails);
    } else if (type === "PLAN_UPGRADE") {
      if (!orderDetails) throw new Error("orderDetails is required for PLAN_UPGRADE");
      subject = `¡Tu plan ha sido actualizado a ${orderDetails.planName}! 🎉 - GlewStudio`;
      htmlContent = getPlanUpgradeTemplate(name, orderDetails);
    } else {
      return new Response(JSON.stringify({ error: "Tipo de correo inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "GlewStudio <onboarding@resend.dev>",
        to: [email],
        subject: subject,
        html: htmlContent,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || "Failed to send email via Resend");
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── OTP Template ────────────────────────────────────────────────────────────
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
                Hola ${name || ""},<br/>
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

// ─── Welcome Template ─────────────────────────────────────────────────────────
function getWelcomeTemplate(name: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a GlewStudio</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#c9a227,#f0c040);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#0a0a0a;font-size:26px;font-weight:800;">GlewStudio</h1>
              <p style="margin:6px 0 0;color:#0a0a0a;font-size:13px;opacity:0.75;">Aprende fotografía con los mejores instructores</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;text-align:center;">
              <div style="font-size:48px;margin-bottom:16px;">🎉</div>
              <h2 style="margin:0 0 12px;color:#f9fafb;font-size:24px;font-weight:800;">¡Hola ${name || ""}, tu cuenta está verificada!</h2>
              <p style="margin:0 0 28px;color:#9ca3af;font-size:14px;line-height:1.7;">
                Estamos muy entusiasmados de tenerte en GlewStudio. Ya tienes acceso completo a tu perfil y a todos los cursos de tu plan.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #2a2a2a;">
                    <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Lo que puedes hacer ahora</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:6px 0;color:#d1d5db;font-size:13px;">📸 Explorar más de 120 cursos de fotografía</td></tr>
                      <tr><td style="padding:6px 0;color:#d1d5db;font-size:13px;">🎬 Acceder a archivos RAW y esquemas de luz</td></tr>
                      <tr><td style="padding:6px 0;color:#d1d5db;font-size:13px;">🏆 Obtener certificados al completar cursos</td></tr>
                      <tr><td style="padding:6px 0;color:#d1d5db;font-size:13px;">📚 Guardar cursos en tu lista de favoritos</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
              <a href="https://glewstudio7616.builtwithrocket.new/dashboard" style="display:inline-block;background:linear-gradient(135deg,#c9a227,#f0c040);color:#0a0a0a;font-size:14px;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;">
                Ir a mi Panel →
              </a>
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

// ─── Invoice Template ─────────────────────────────────────────────────────────
function getInvoiceTemplate(name: string, order: {
  invoiceId: string;
  date: string;
  planName: string;
  paymentMethod: string;
  productName: string;
  amount: string | number;
}): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Factura #${order.invoiceId} - GlewStudio</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="650" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:650px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#c9a227,#f0c040);padding:32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin:0;color:#0a0a0a;font-size:24px;font-weight:800;">GlewStudio</h1>
                    <p style="margin:4px 0 0;color:#0a0a0a;font-size:13px;opacity:0.75;">Factura de Compra</p>
                  </td>
                  <td style="text-align:right;vertical-align:top;">
                    <p style="margin:0;font-weight:800;color:#0a0a0a;font-size:14px;">Factura #${order.invoiceId}</p>
                    <p style="margin:4px 0 0;color:#0a0a0a;font-size:13px;opacity:0.75;">Fecha: ${order.date}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Client info -->
          <tr>
            <td style="padding:28px 40px 0;background:#ffffff;">
              <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Cliente:</strong> ${name}</p>
              <p style="margin:0 0 4px;color:#374151;font-size:14px;"><strong>Plan Adquirido:</strong> ${order.planName}</p>
              <p style="margin:0;color:#374151;font-size:14px;"><strong>Método de pago:</strong> ${order.paymentMethod}</p>
            </td>
          </tr>
          <!-- Items table -->
          <tr>
            <td style="padding:24px 40px;background:#ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
                    <th style="padding:12px 16px;text-align:left;color:#4b5563;font-size:13px;font-weight:700;">Descripción</th>
                    <th style="padding:12px 16px;text-align:right;color:#4b5563;font-size:13px;font-weight:700;">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #e5e7eb;">
                    <td style="padding:14px 16px;color:#111827;font-size:14px;">${order.productName}</td>
                    <td style="padding:14px 16px;text-align:right;color:#111827;font-size:14px;font-weight:600;">$${order.amount} USD</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <!-- Total -->
          <tr>
            <td style="padding:0 40px 28px;background:#ffffff;text-align:right;">
              <p style="margin:0;font-size:18px;color:#111827;font-weight:800;">Total Pagado: $${order.amount} USD</p>
              <p style="margin:6px 0 0;color:#16a34a;font-size:13px;font-weight:700;">● Estado: PAGADO</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;background:#f9fafb;border-top:2px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#6b7280;font-size:12px;">Gracias por tu compra en GlewStudio</p>
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
}

// ─── Plan Upgrade Template ────────────────────────────────────────────────────
function getPlanUpgradeTemplate(name: string, upgrade: {
  planName: string;
  planPrice: string;
  benefits: string[];
  accessLevel: string;
  billingDate: string;
  billingCycle: string;
  upgradeDate: string;
}): string {
  const benefitRows = (upgrade.benefits ?? [])
    .map((b: string) => `<tr><td style="padding:6px 0;color:#d1d5db;font-size:13px;">✅ ${b}</td></tr>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Plan Actualizado - GlewStudio</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#c9a227,#f0c040);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#0a0a0a;font-size:26px;font-weight:800;">GlewStudio</h1>
              <p style="margin:6px 0 0;color:#0a0a0a;font-size:13px;opacity:0.75;">Confirmación de Actualización de Plan</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <div style="text-align:center;margin-bottom:28px;">
                <div style="font-size:48px;margin-bottom:12px;">🚀</div>
                <h2 style="margin:0 0 8px;color:#f9fafb;font-size:22px;font-weight:800;">¡Hola ${name}, tu plan fue actualizado!</h2>
                <p style="margin:0;color:#9ca3af;font-size:14px;line-height:1.6;">
                  Tu suscripción ha sido actualizada exitosamente al <strong style="color:#c9a227;">${upgrade.planName}</strong>.
                  A continuación encontrarás los detalles de tu nuevo plan.
                </p>
              </div>

              <!-- Plan Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #2a2a2a;">
                    <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Detalles del Plan</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:#9ca3af;font-size:13px;width:50%;">Plan:</td>
                        <td style="padding:6px 0;color:#f9fafb;font-size:13px;font-weight:700;text-align:right;">${upgrade.planName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#9ca3af;font-size:13px;">Precio:</td>
                        <td style="padding:6px 0;color:#c9a227;font-size:13px;font-weight:800;text-align:right;">${upgrade.planPrice}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#9ca3af;font-size:13px;">Ciclo de facturación:</td>
                        <td style="padding:6px 0;color:#f9fafb;font-size:13px;font-weight:600;text-align:right;">${upgrade.billingCycle}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#9ca3af;font-size:13px;">Próxima facturación:</td>
                        <td style="padding:6px 0;color:#f9fafb;font-size:13px;font-weight:600;text-align:right;">${upgrade.billingDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#9ca3af;font-size:13px;">Fecha de actualización:</td>
                        <td style="padding:6px 0;color:#f9fafb;font-size:13px;font-weight:600;text-align:right;">${upgrade.upgradeDate}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#9ca3af;font-size:13px;">Nivel de acceso:</td>
                        <td style="padding:6px 0;color:#10b981;font-size:13px;font-weight:700;text-align:right;">${upgrade.accessLevel}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Benefits -->
              ${benefitRows.length > 0 ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #2a2a2a;">
                    <p style="margin:0;color:#6b7280;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Beneficios Incluidos</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${benefitRows}
                    </table>
                  </td>
                </tr>
              </table>` : ''}

              <!-- CTA -->
              <div style="text-align:center;">
                <a href="https://glewstudio7616.builtwithrocket.new/dashboard" style="display:inline-block;background:linear-gradient(135deg,#c9a227,#f0c040);color:#0a0a0a;font-size:14px;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;">
                  Ir a mi Panel →
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 28px;border-top:1px solid #2a2a2a;text-align:center;">
              <p style="margin:0;color:#6b7280;font-size:11px;">© 2026 GlewStudio · Todos los derechos reservados</p>
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
}
