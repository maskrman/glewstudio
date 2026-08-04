import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Secure Video Token API
 *
 * Strategy: Server-side signed URL generation for video assets stored in
 * Supabase Storage (or a compatible object store). This prevents direct
 * downloads by ensuring every video request requires a short-lived token
 * that is tied to the authenticated user.
 *
 * Usage:
 *   GET /api/video-token?courseId=<id>&lessonId=<id>
 *
 * Returns:
 *   { url: "<signed-url>", expiresAt: "<iso-timestamp>" }
 *
 * The signed URL expires in 1 hour. The client should request a new token
 * before expiry (e.g. every 50 minutes) to keep playback uninterrupted.
 *
 * For HLS delivery: store .m3u8 + .ts segments in the bucket and sign the
 * manifest URL. The HLS player will use the signed manifest to fetch segments.
 *
 * For Bunny.net / Cloudflare Stream: replace the Supabase Storage signing
 * logic below with the respective provider's token-signing SDK call.
 */

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const lessonId = searchParams.get('lessonId');

    if (!courseId || !lessonId) {
      return NextResponse.json(
        { error: 'courseId and lessonId are required' },
        { status: 400 }
      );
    }

    // Verify the user has access to this course (purchased or active subscription)
    const { data: purchase } = await supabase
      .from('course_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle();

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const hasAccess = !!purchase || !!subscription;

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied. Purchase the course or subscribe to access this content.' },
        { status: 403 }
      );
    }

    // Generate a signed URL for the video asset in Supabase Storage.
    // Video files should be stored at: videos/<courseId>/<lessonId>.mp4
    // or for HLS: videos/<courseId>/<lessonId>/index.m3u8
    const videoPath = `${courseId}/${lessonId}.mp4`;

    const { data: signedData, error: signError } = await supabase.storage
      .from('videos')
      .createSignedUrl(videoPath, SIGNED_URL_EXPIRY_SECONDS);

    if (signError || !signedData?.signedUrl) {
      // If the bucket/file doesn't exist yet, return a placeholder response
      // so the UI can handle it gracefully during development.
      console.warn(`[video-token] Could not sign URL for ${videoPath}:`, signError?.message);
      return NextResponse.json(
        {
          url: null,
          message: 'Video asset not yet available. Upload the video to the "videos" storage bucket.',
          expiresAt: null,
        },
        { status: 200 }
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
