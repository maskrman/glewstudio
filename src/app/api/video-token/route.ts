import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasAccess, type SubscriptionTier } from '@/lib/config';

/**
 * Secure Video Token API
 *
 * Authorization model (server-side, in order):
 *   1. User must be authenticated (auth.getUser()).
 *   2. courseId and lessonId must be present in query params.
 *   3. Access is granted if EITHER:
 *      a. course_purchases row exists where:
 *           user_id  = authenticated user's id
 *           course_id = requested courseId
 *           purchase_status = 'paid'
 *      b. subscriptions row exists where:
 *           user_id = authenticated user's id
 *           status  = 'active'
 *           AND the subscription tier is sufficient for the course's required tier
 *             (tier check is performed server-side via hasAccess())
 *   4. If the video asset does not exist in storage → 404 (not 200+null).
 *   5. Internal errors → 500.
 *
 * Usage:
 *   GET /api/video-token?courseId=<id>&lessonId=<id>&requiredTier=<tier>
 *
 * Returns:
 *   { url: "<signed-url>", expiresAt: "<iso-timestamp>" }
 *
 * The signed URL expires in 1 hour.
 */

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── 1. Authenticate user ────────────────────────────────────────────────
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Validate query params ────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const lessonId = searchParams.get('lessonId');
    // requiredTier: the minimum subscription tier needed for this course.
    // Provided by the caller (e.g. VideoPlayerScreen) based on course metadata.
    // Server validates this against the user's actual subscription tier.
    const requiredTier = (searchParams.get('requiredTier') ?? null) as SubscriptionTier;

    if (!courseId || !lessonId) {
      return NextResponse.json(
        { error: 'courseId and lessonId are required' },
        { status: 400 }
      );
    }

    // ── 3a. Check course_purchases (explicit purchase) ──────────────────────
    // Must match: user_id = auth user, course_id = requested course, purchase_status = 'paid'
    const { data: purchase, error: purchaseError } = await supabase
      .from('course_purchases')
      .select('id, purchase_status')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .eq('purchase_status', 'paid')
      .maybeSingle();

    if (purchaseError) {
      console.error('[video-token] purchase check error:', purchaseError.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const hasPurchase = !!purchase;

    // ── 3b. Check subscription (membership access) ──────────────────────────
    // Must match: user_id = auth user, status = 'active'
    // AND subscription tier must be sufficient for the required tier of this course.
    let hasSubscriptionAccess = false;

    if (!hasPurchase) {
      const { data: subscription, error: subscriptionError } = await supabase
        .from('subscriptions')
        .select('tier, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (subscriptionError) {
        console.error('[video-token] subscription check error:', subscriptionError.message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }

      if (subscription) {
        const userTier = subscription.tier as SubscriptionTier;
        // If no requiredTier is specified, any active subscription grants access.
        // If requiredTier is specified, the user's tier must be >= requiredTier.
        hasSubscriptionAccess = hasAccess(userTier, requiredTier);
      }
    }

    // ── 3c. Deny if neither purchase nor sufficient subscription ─────────────
    if (!hasPurchase && !hasSubscriptionAccess) {
      return NextResponse.json(
        {
          error: requiredTier
            ? `Access denied. This content requires a "${requiredTier}" subscription or higher, or a direct course purchase.`
            : 'Access denied. Purchase the course or subscribe to access this content.',
        },
        { status: 403 }
      );
    }

    // ── 4. Generate signed URL ───────────────────────────────────────────────
    const videoPath = `${courseId}/${lessonId}.mp4`;

    const { data: signedData, error: signError } = await supabase.storage
      .from('videos')
      .createSignedUrl(videoPath, SIGNED_URL_EXPIRY_SECONDS);

    if (signError) {
      // Distinguish between "file not found" and other storage errors.
      // Supabase Storage returns "Object not found" for missing files.
      const isNotFound =
        signError.message?.toLowerCase().includes('not found') ||
        signError.message?.toLowerCase().includes('does not exist');

      if (isNotFound) {
        console.warn(`[video-token] Video asset not found: ${videoPath}`);
        return NextResponse.json(
          { error: `Video asset not found: ${videoPath}` },
          { status: 404 }
        );
      }

      console.error(`[video-token] Storage error for ${videoPath}:`, signError.message);
      return NextResponse.json({ error: 'Failed to generate video token' }, { status: 500 });
    }

    if (!signedData?.signedUrl) {
      // Signed URL is null without an explicit error — treat as not found.
      console.warn(`[video-token] No signed URL returned for ${videoPath}`);
      return NextResponse.json(
        { error: `Video asset not found: ${videoPath}` },
        { status: 404 }
      );
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString();

    return NextResponse.json({
      url: signedData.signedUrl,
      expiresAt,
    });
  } catch (error) {
    console.error('[video-token] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
