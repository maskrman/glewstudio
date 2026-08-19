import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
};

// ============================================================
// DEPRECATED — update-subscription Edge Function
//
// SECURITY: This function has been DISABLED to eliminate the
// auto-upgrade bypass vector (Audit Phase 2, Issue #2).
//
// VULNERABILITY FIXED:
//   A user could send { newTier: "diafragma" } and the function
//   would use service-role to activate a premium subscription.
//   This is a critical bypass — the user should NEVER determine
//   their own tier.
//
// REPLACEMENT:
//   Subscription upgrades will be handled exclusively by the
//   payment webhook (src/app/api/webhooks/payment/route.ts)
//   which maps provider_product_id → tier server-side.
//   No client request can determine the tier.
//
// PHASE 9: When a real payment provider is integrated, the
//   webhook will call the subscription update logic directly.
//   This function will remain deprecated.
// ============================================================

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  // ALL requests are rejected — this function is deprecated.
  // Subscription upgrades must go through the payment webhook.
  return new Response(
    JSON.stringify({
      error: "This endpoint has been deprecated for security reasons.",
      message: "Subscription upgrades are processed exclusively through the payment webhook. Direct tier assignment is not permitted.",
      code: "ENDPOINT_DEPRECATED",
    }),
    {
      status: 403,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    }
  );
});
