import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: { get(key: string): string | undefined };
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIER_LABELS: Record<string, string> = {
  apertura: "Apertura",
  obturador: "Obturador",
  diafragma: "Diafragma",
};

const TIER_PRICES: Record<string, string> = {
  apertura: "$19/mes",
  obturador: "$39/mes",
  diafragma: "$69/mes",
};

const TIER_BENEFITS: Record<string, string[]> = {
  apertura: [
    "Acceso a más de 40 cursos de fotografía",
    "Archivos de práctica básicos",
    "Certificados digitales al completar cursos",
    "Soporte por correo electrónico",
  ],
  obturador: [
    "Todo lo incluido en Plan Apertura",
    "Acceso a más de 80 cursos avanzados",
    "Archivos RAW y esquemas de luz",
    "Acceso a talleres grabados",
    "Soporte prioritario",
  ],
  diafragma: [
    "Todo lo incluido en Plan Obturador",
    "Acceso completo a más de 120 cursos",
    "Talleres en vivo con instructores",
    "Revisión de portafolio personalizada",
    "Certificaciones de rutas completas",
    "Comunidad VIP exclusiva",
    "Sesiones Q&A mensuales",
    "Acceso offline a contenido",
  ],
};

const TIER_ACCESS_LEVEL: Record<string, string> = {
  apertura: "Acceso Básico",
  obturador: "Acceso Avanzado",
  diafragma: "Acceso VIP Completo",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Use service role key so we can write to subscriptions regardless of RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate the calling user via the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Verify the JWT and get the user
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { newTier } = body;

    if (!newTier || !["apertura", "obturador", "diafragma"].includes(newTier)) {
      return new Response(JSON.stringify({ error: "Invalid tier" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Upsert subscription using service role (bypasses RLS safely on server)
    const { error: upsertError } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          tier: newTier,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    // Send upgrade confirmation email via Resend (best-effort)
    if (resendApiKey && user.email) {
      try {
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        const billingDate = nextBillingDate.toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });

        const planName = TIER_LABELS[newTier] ?? newTier;
        const planPrice = TIER_PRICES[newTier] ?? "";
        const benefits = TIER_BENEFITS[newTier] ?? [];
        const accessLevel = TIER_ACCESS_LEVEL[newTier] ?? "Acceso completo";

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: [user.email],
            subject: `✓ Plan actualizado a ${planName} | Glewstudio`,
            html: `
              <div style="font-family:sans-serif;background:#0a0a0a;color:#f9fafb;padding:40px 20px;max-width:600px;margin:0 auto;">
                <h1 style="color:#c9a227;">Glewstudio</h1>
                <h2>¡Tu plan ha sido actualizado!</h2>
                <p>Hola, tu suscripción ha sido actualizada al <strong>Plan ${planName}</strong> (${planPrice}).</p>
                <p><strong>Nivel de acceso:</strong> ${accessLevel}</p>
                <p><strong>Próxima facturación:</strong> ${billingDate}</p>
                <h3>Beneficios incluidos:</h3>
                <ul>${benefits.map((b: string) => `<li>${b}</li>`).join("")}</ul>
                <a href="https://glewstudio7616.builtwithrocket.new/dashboard"
                   style="display:inline-block;background:#c9a227;color:#0a0a0a;padding:12px 28px;border-radius:8px;font-weight:700;text-decoration:none;margin-top:16px;">
                  Comenzar a Aprender →
                </a>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        // Email failure should not block the subscription update
        console.warn("[update-subscription] Email send failed:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, tier: newTier }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
