/**
 * GLEW Studio — Sensitive Operations Registry
 *
 * This file documents all operations that currently run client-side
 * but MUST be migrated to server-side before production launch.
 *
 * Status: PHASE 1 — Documentation only. No migration yet.
 * Migration target: Phase 3 (Server-Side Security Hardening)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * [CRITICAL] Subscription creation from client
 *   File: src/contexts/AuthContext.tsx → signUp()
 *   Risk: Users can create subscriptions without payment verification.
 *   Fix:  Remove client insert. Trigger subscription creation only from
 *         the payment webhook: src/app/api/webhooks/payment/route.ts
 *
 * [CRITICAL] Subscription insert after OTP verification
 *   File: src/app/sign-up-login/components/OtpVerifyScreen.tsx → handleVerify()
 *   Risk: Same as above — subscription created from browser after OTP.
 *   Fix:  Move to server action or webhook-triggered flow.
 *
 * [HIGH] Course purchase insert from browser
 *   File: src/app/courses/components/CoursesScreen.tsx → PurchaseModal → handlePurchase()
 *   Risk: Users can insert course_purchases rows without payment.
 *   Fix:  Replace with a server action that validates payment before insert.
 *         Integrate with payment provider webhook in Phase 9.
 *
 * [HIGH] Subscription tier read used for UI access control
 *   Files: src/lib/subscription.ts, src/hooks/useUserPlan.ts,
 *          src/app/video-player/components/VideoPlayerScreen.tsx,
 *          src/app/course-detail/components/CourseDetailHero.tsx
 *   Risk:  Client-side tier is informational only. A user could manipulate
 *          local state to bypass UI gates.
 *   Fix:   All actual content delivery (video URLs, downloads) already goes
 *          through server-side validation in:
 *          - src/app/actions/video.ts (generateSignedVideoUrl)
 *          - src/app/actions/lessonResources.ts (generateSignedDownloadUrl)
 *          - src/app/api/video-token/route.ts
 *          UI gates are acceptable as UX only — server gates are the authority.
 *
 * [MEDIUM] Admin panel uses demo/mock data
 *   File: src/app/admin/components/AdminPanel.tsx
 *   Risk:  Stats (MRR, ARR, subscribers) are hardcoded demo values.
 *   Fix:   Replace with server-side queries in Phase 4 (Admin Dashboard).
 *
 * [LOW] Receipt screen generates order ID client-side
 *   File: src/app/receipt/components/ReceiptScreen.tsx → generateOrderId()
 *   Risk:  Order IDs are not persisted — purely cosmetic.
 *   Fix:   Generate and store real order IDs server-side when payment is integrated.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ALREADY SECURE (server-side validated):
 *   ✅ Video signed URL generation — src/app/actions/video.ts
 *   ✅ Download signed URL generation — src/app/actions/lessonResources.ts
 *   ✅ Video token API — src/app/api/video-token/route.ts
 *   ✅ OTP send/verify — src/app/api/send-otp, api/verify-otp (service role)
 *   ✅ Payment webhook — src/app/api/webhooks/payment/route.ts (service role)
 *   ✅ Auth callback — src/app/auth/callback/route.ts
 *   ✅ Middleware session refresh — src/middleware.ts
 */

// This file is documentation only — no runtime exports.
export {};
