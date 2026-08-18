/**
 * GLEW Studio — Sensitive Operations Registry
 *
 * This file documents the security posture of all sensitive operations.
 * Updated after Phase 1 Security Hardening (migration 20260818200000).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ FIXED IN PHASE 1 SECURITY HARDENING
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * [FIXED] Subscription creation from client — AuthContext.signUp()
 *   Was:  Client inserted into subscriptions with arbitrary tier/status.
 *   Now:  Client insert removed. DB trigger (SECURITY DEFINER) creates
 *         tier='apertura', status='trialing' on auth.users INSERT.
 *         RLS blocks all authenticated INSERT on subscriptions.
 *   Migration: 20260818200000_security_hardening_phase1.sql
 *
 * [FIXED] Subscription insert after OTP verification — OtpVerifyScreen
 *   Was:  Client inserted subscription after OTP verify with user-supplied plan.
 *   Now:  Client insert removed. Same DB trigger handles it.
 *   Migration: 20260818200000_security_hardening_phase1.sql
 *
 * [FIXED] Course purchase insert from browser — CoursesScreen PurchaseModal
 *   Was:  Browser could INSERT into course_purchases without payment.
 *   Now:  Client insert code removed. RLS blocks all authenticated INSERT
 *         on course_purchases. Modal shows "payment coming soon" instead.
 *   Migration: 20260818200000_security_hardening_phase1.sql
 *
 * [FIXED] .gitignore missing .env.local
 *   Was:  .env.local not excluded — real secrets could be committed.
 *   Now:  .env.local and all *.local env files added to .gitignore.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  PENDING — Requires Phase 9 (Payment Integration)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * [PENDING] Premium subscription upgrade
 *   When a user pays, the payment webhook must:
 *   1. Verify the payment with the provider server-side.
 *   2. Use SUPABASE_SERVICE_ROLE_KEY (server-only) to update subscriptions.
 *   3. Set tier and status — never trust client-supplied values.
 *   File: src/app/api/webhooks/payment/route.ts
 *
 * [PENDING] Course purchase creation
 *   When a user pays for a course, the payment webhook must:
 *   1. Verify the payment server-side.
 *   2. Use service role to INSERT into course_purchases with purchase_status='paid'.
 *   File: src/app/api/webhooks/payment/route.ts
 *
 * [PENDING] Admin Panel uses demo/mock data
 *   File: src/app/admin/components/AdminPanel.tsx
 *   Fix:  Replace with server-side queries in Phase 4 (Admin Dashboard).
 *
 * [PENDING] Receipt screen generates order ID client-side
 *   File: src/app/receipt/components/ReceiptScreen.tsx
 *   Fix:  Generate and store real order IDs server-side when payment is integrated.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ ALREADY SECURE (server-side validated)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   ✅ Subscription creation — DB trigger SECURITY DEFINER (Phase 1 fix)
 *   ✅ Video signed URL generation — src/app/actions/video.ts
 *   ✅ Download signed URL generation — src/app/actions/lessonResources.ts
 *   ✅ Video token API — src/app/api/video-token/route.ts
 *   ✅ OTP send/verify — src/app/api/send-otp, api/verify-otp (service role)
 *   ✅ Payment webhook — src/app/api/webhooks/payment/route.ts (service role)
 *   ✅ Auth callback — src/app/auth/callback/route.ts
 *   ✅ Middleware session refresh — src/middleware.ts
 *   ✅ SUPABASE_SERVICE_ROLE_KEY — server-only, not in NEXT_PUBLIC_* vars
 *   ✅ .gitignore — .env.local excluded from version control
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔒 ENVIRONMENT VARIABLE SECURITY AUDIT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   NEXT_PUBLIC_SUPABASE_URL        — Safe (public, needed by client)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   — Safe (public anon key, RLS enforced)
 *   NEXT_PUBLIC_GA_MEASUREMENT_ID   — Safe (analytics ID, public by design)
 *   NEXT_PUBLIC_ADSENSE_ID          — Safe (public ad ID)
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — Safe (publishable key, public by design)
 *   NEXT_PUBLIC_SITE_URL            — Safe (public URL)
 *
 *   SUPABASE_SERVICE_ROLE_KEY       — ✅ Server-only (no NEXT_PUBLIC_ prefix)
 *   OPENAI_API_KEY                  — ✅ Server-only
 *   GEMINI_API_KEY                  — ✅ Server-only
 *   ANTHROPIC_API_KEY               — ✅ Server-only
 *   PERPLEXITY_API_KEY              — ✅ Server-only
 *   RESEND_API_KEY                  — ✅ Server-only
 */

// This file is documentation only — no runtime exports.
export {};
