/**
 * GLEW Studio — Sensitive Operations Registry
 *
 * This file documents the security posture of all sensitive operations.
 * Updated after Phase 1 Audit Corrections (20260818).
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
 * ✅ FIXED IN PHASE 1 AUDIT CORRECTIONS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * [FIXED] Webhook accepted arbitrary tier/status from unauthenticated requests
 *   Was:  POST /api/webhooks/payment accepted user_id, tier, status from any
 *         unauthenticated request and wrote them directly to subscriptions.
 *   Now:  Endpoint requires WEBHOOK_INTERNAL_SECRET header verification.
 *         Requests that fail verification are rejected with 401.
 *         Tier is validated against a server-side whitelist (ALLOWED_TIERS).
 *         Event type is validated against ALLOWED_EVENTS whitelist.
 *         Status is derived from event type — never from client-supplied value.
 *         user_id is validated against auth.users before any DB write.
 *   File: src/app/api/webhooks/payment/route.ts
 *   Phase 9: Replace WEBHOOK_INTERNAL_SECRET guard with real provider HMAC
 *            (e.g. stripe.webhooks.constructEvent). The verifyWebhookRequest()
 *            function is the isolated layer to replace.
 *
 * [FIXED] Webhook had no idempotency — same event could be processed twice
 *   Was:  No deduplication. Replayed events would re-activate subscriptions.
 *   Now:  processed_webhook_events table stores provider_event_id with UNIQUE
 *         constraint. Duplicate events are detected and rejected with 200.
 *   Migration: 20260818210000_webhook_idempotency.sql
 *   File: src/app/api/webhooks/payment/route.ts
 *
 * [FIXED] video-token did not validate purchase_status or subscription tier
 *   Was:  Checked only that a course_purchases row existed (any status).
 *         Checked only that a subscriptions row existed with status='active'
 *         without verifying the tier was sufficient for the course.
 *   Now:  course_purchases: validates user_id + course_id + purchase_status='paid'.
 *         subscriptions: validates user_id + status='active' + hasAccess(tier, requiredTier).
 *         requiredTier is passed as a query param and validated server-side.
 *   File: src/app/api/video-token/route.ts
 *
 * [FIXED] video-token returned HTTP 200 with {url: null} for missing videos
 *   Was:  Missing video assets returned { url: null } with HTTP 200.
 *   Now:  Missing video assets return HTTP 404 with descriptive error message.
 *         Storage errors return HTTP 500.
 *   File: src/app/api/video-token/route.ts
 *
 * [FIXED] ALL_COURSES used as implicit authority in CoursesScreen
 *   Was:  No documentation that ALL_COURSES is provisional and non-authoritative.
 *   Now:  Prominent comment block documents that ALL_COURSES is UI-only and
 *         must NOT be used for authorization, pricing, permissions, or memberships.
 *         The authoritative source is the database (courses, course_purchases,
 *         subscriptions tables).
 *   File: src/app/courses/components/CoursesScreen.tsx
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ FIXED IN PHASE 3.1 SECURITY HARDENING (HIGH FINDINGS)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * [FIXED] HIGH #1 — Service Role in public endpoints (user-count, categories)
 *   Was:  /api/user-count used SUPABASE_SERVICE_ROLE_KEY with no auth check.
 *         /api/categories used SUPABASE_SERVICE_ROLE_KEY with no auth check.
 *   Now:  /api/user-count uses anon client + get_public_user_count() SECURITY DEFINER.
 *         /api/categories uses anon client + public SELECT policies on categories/courses.
 *         Service Role is NOT used in either public endpoint.
 *   Files: src/app/api/user-count/route.ts, src/app/api/categories/route.ts
 *   Migration: 20260819050000_phase31_high_findings_fix.sql
 *
 * [FIXED] HIGH #2 — Service Role helpers without authorization boundary
 *   Was:  findTestCourses() and findDiafragmaResource() in storageAudit.ts
 *         created their own admin clients independently, without requiring
 *         an authorization check to have occurred first.
 *   Now:  Both helpers accept the admin client as a parameter.
 *         The admin client is created ONCE in runStorageAudit() AFTER
 *         auth.getUser() + is_admin() checks pass. Helpers cannot be
 *         called without going through the authorization boundary.
 *   File: src/app/actions/storageAudit.ts
 *
 * [FIXED] HIGH #3 — lesson_resources TABLE RLS parallel permissive policy
 *   Was:  "authenticated_read_lesson_resources" policy had USING(true) with
 *         no documentation of intent, creating ambiguity about whether it
 *         was a bypass for file access.
 *   Now:  Policy re-created with explicit COMMENT documenting it is
 *         metadata-only. Actual file access is gated by:
 *           1. generateSignedDownloadUrl() — checks required_tier server-side
 *           2. Storage policy lesson_resources_tier_select — calls
 *              user_can_access_lesson_resource() which checks required_tier
 *         The TABLE policy does NOT grant access to actual files.
 *   Migration: 20260819050000_phase31_high_findings_fix.sql
 *
 * [FIXED] HIGH #4 — Demo data with slug-based course_id
 *   Was:  Migration 20260806052521 inserted demo rows with
 *         course_id = 'iluminacion-rembrandt-retrato' (TEXT slug, not UUID).
 *         These rows were fail-closed in Storage (user_can_access_lesson_resource
 *         rejects non-UUID path segments) but were dirty data.
 *   Now:  New migration deletes all lesson_resources rows where course_id
 *         does not match UUID format. Production is clean.
 *   Migration: 20260819050000_phase31_high_findings_fix.sql
 *
 * [FIXED] HIGH #5 — lesson_resources.course_id TEXT vs UUID (partial)
 *   Was:  course_id was TEXT with no format constraint, allowing slug-based
 *         or arbitrary string values.
 *   Now:  CHECK constraint added to enforce UUID format on future inserts.
 *         Full ALTER COLUMN TYPE UUID migration is deferred as technical debt
 *         pending production data verification.
 *   Technical debt: Full UUID migration (ALTER COLUMN + FK to courses(id))
 *         should be done after confirming all production rows have valid UUIDs
 *         and all application queries handle UUID type correctly.
 *   Migration: 20260819050000_phase31_high_findings_fix.sql
 *
 * [FIXED] HIGH #6 — Admin authorization (is_admin() using raw_user_meta_data)
 *   Was:  Migration 20260818220000 defined is_admin() checking BOTH
 *         raw_user_meta_data AND raw_app_meta_data. A user could call
 *         supabase.auth.updateUser({ data: { role: 'admin' } }) to become admin.
 *   Now:  is_admin() checks ONLY raw_app_meta_data (server-side only).
 *         Migration 20260819000000 fixed this; 20260819050000 re-confirms it
 *         with search_path pinned and explicit documentation.
 *         raw_user_meta_data is intentionally NOT checked.
 *   Migration: 20260819050000_phase31_high_findings_fix.sql
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  PENDING — Requires Phase 9 (Payment Integration)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * [PENDING] Replace WEBHOOK_INTERNAL_SECRET with real provider HMAC verification
 *   When a payment provider is chosen (Stripe/PayPal/MercadoPago):
 *   1. Replace verifyWebhookRequest() in route.ts with provider SDK verification.
 *   2. Use raw body (not parsed JSON) for HMAC computation.
 *   3. Remove WEBHOOK_INTERNAL_SECRET from .env — use provider's webhook secret.
 *   File: src/app/api/webhooks/payment/route.ts → verifyWebhookRequest()
 *
 * [PENDING] Premium subscription upgrade flow
 *   When a user pays, the payment webhook must:
 *   1. Verify the payment with the provider server-side (HMAC).
 *   2. Use SUPABASE_SERVICE_ROLE_KEY (server-only) to update subscriptions.
 *   3. Set tier and status — never trust client-supplied values.
 *   4. Record provider_event_id in processed_webhook_events for idempotency.
 *   File: src/app/api/webhooks/payment/route.ts
 *
 * [PENDING] Course purchase creation via webhook
 *   When a user pays for a course, the payment webhook must:
 *   1. Verify the payment server-side.
 *   2. Use service role to INSERT into course_purchases with purchase_status='paid'.
 *   File: src/app/api/webhooks/payment/route.ts
 *
 * [PENDING] Migrate course catalog from ALL_COURSES to database
 *   ALL_COURSES in CoursesScreen is a provisional static list.
 *   Future phase: fetch from public.courses table via server component or API.
 *   File: src/app/courses/components/CoursesScreen.tsx
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
 *   ✅ Video token API — src/app/api/video-token/route.ts (Phase 1 audit fix)
 *   ✅ OTP send/verify — src/app/api/send-otp, api/verify-otp (service role)
 *   ✅ Payment webhook — src/app/api/webhooks/payment/route.ts (Phase 1 audit fix)
 *   ✅ Auth callback — src/app/auth/callback/route.ts
 *   ✅ Middleware session refresh — src/middleware.ts
 *   ✅ SUPABASE_SERVICE_ROLE_KEY — server-only, not in NEXT_PUBLIC_* vars
 *   ✅ WEBHOOK_INTERNAL_SECRET — server-only, not in NEXT_PUBLIC_* vars
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
 *   WEBHOOK_INTERNAL_SECRET         — ✅ Server-only (no NEXT_PUBLIC_ prefix)
 *   OPENAI_API_KEY                  — ✅ Server-only
 *   GEMINI_API_KEY                  — ✅ Server-only
 *   ANTHROPIC_API_KEY               — ✅ Server-only
 *   PERPLEXITY_API_KEY              — ✅ Server-only
 *   RESEND_API_KEY                  — ✅ Server-only
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔄 SUBSCRIPTION TRIGGER — CONSISTENCY NOTES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Trigger: on_auth_user_created_free_subscription
 * Function: create_free_subscription_for_new_user() — SECURITY DEFINER
 * Migration: 20260818200000_security_hardening_phase1.sql
 *
 * Behavior:
 *   - Fires AFTER INSERT on auth.users (every new signup).
 *   - Inserts tier='apertura', status='trialing' into public.subscriptions.
 *   - Uses ON CONFLICT DO NOTHING to prevent duplicate rows.
 *   - Uses EXCEPTION handler: if insert fails, logs a WARNING and returns NEW
 *     (non-blocking — user creation is NOT rolled back).
 *
 * Non-blocking trade-off:
 *   The trigger is intentionally non-blocking to prevent a subscription insert
 *   failure from blocking user registration. This means a user COULD theoretically
 *   be created without a subscription row if the trigger fails silently.
 *
 * Recovery mechanism:
 *   - The WARNING log is visible in Supabase database logs (search for
 *     "create_free_subscription_for_new_user failed").
 *   - To detect affected users: run the following query as admin:
 *       SELECT au.id, au.email, au.created_at
 *       FROM auth.users au
 *       LEFT JOIN public.subscriptions s ON s.user_id = au.id
 *       WHERE s.id IS NULL;
 *   - To repair: INSERT INTO public.subscriptions (user_id, tier, status)
 *       SELECT id, 'apertura', 'trialing' FROM auth.users
 *       WHERE id NOT IN (SELECT user_id FROM public.subscriptions);
 *   - Consider adding a monitoring alert or scheduled job in Phase 4 (Admin).
 */

// This file is documentation only — no runtime exports.
export {};
