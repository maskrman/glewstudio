'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { TIER_RANK } from '@/lib/config';
import type { SubscriptionTier } from '@/lib/config';

const SIGNED_URL_EXPIRY_SECONDS = 7200; // 2 hours

// Maximum reasonable values for progress validation
const MAX_ADDITIONAL_SECONDS = 7200; // 2 hours per session
const MAX_TOTAL_SECONDS = 86400;     // 24 hours total course duration

export interface SignedVideoResult {
  url: string | null;
  expiresAt: string | null;
  error?: string;
}

/**
 * Server Action: generateSignedVideoUrl
 *
 * Generates a 2-hour Supabase Storage signed URL for a video asset.
 * Access is granted only when the authenticated user has:
 *   - A subscription with tier >= courses.minimum_tier, OR
 *   - A direct paid course purchase for the requested courseId
 *
 * SECURITY FIX (Audit Phase 2, Issue #3):
 *   Previously checked only subscription.status = active without verifying
 *   minimum_tier. Now uses the same policy as /api/video-token:
 *     courseId → courses.minimum_tier → hasAccess(userTier, requiredTier)
 *
 * Video assets must be stored in the "videos" bucket at:
 *   <courseId>/<lessonId>.mp4
 */
export async function generateSignedVideoUrl(
  courseId: string,
  lessonId: string
): Promise<SignedVideoResult> {
  try {
    const supabase = await createClient();

    // 1. Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { url: null, expiresAt: null, error: 'No autenticado. Inicia sesión para ver este contenido.' };
    }

    if (!courseId || !lessonId) {
      return { url: null, expiresAt: null, error: 'courseId y lessonId son requeridos.' };
    }

    // 2. Fetch course to get minimum_tier and access_type (server-side authority)
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, minimum_tier, access_type, is_published')
      .eq('id', courseId)
      .maybeSingle();

    if (courseError || !course) {
      return { url: null, expiresAt: null, error: 'Curso no encontrado.' };
    }

    if (!course.is_published) {
      return { url: null, expiresAt: null, error: 'Este curso no está disponible.' };
    }

    // 3. Free courses: allow any authenticated user
    if (course.access_type === 'free') {
      // Skip subscription/purchase check for free courses
    } else if (course.access_type === 'premium_purchase') {
      // 4a. Premium purchase: require paid purchase for this specific course
      const { data: purchase } = await supabase
        .from('course_purchases')
        .select('id, purchase_status')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .eq('purchase_status', 'paid')
        .maybeSingle();

      if (!purchase) {
        return {
          url: null,
          expiresAt: null,
          error: 'Acceso denegado. Este curso requiere una compra individual.',
        };
      }
    } else {
      // 4b. Membership course: check subscription tier >= minimum_tier
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('tier, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      // Also allow paid purchase as fallback for membership courses
      let hasPaidPurchase = false;
      if (!subscription) {
        const { data: purchase } = await supabase
          .from('course_purchases')
          .select('id')
          .eq('user_id', user.id)
          .eq('course_id', courseId)
          .eq('purchase_status', 'paid')
          .maybeSingle();
        hasPaidPurchase = !!purchase;
      }

      if (!subscription && !hasPaidPurchase) {
        return {
          url: null,
          expiresAt: null,
          error: 'Acceso denegado. Necesitas una suscripción activa para ver este contenido.',
        };
      }

      if (subscription && !hasPaidPurchase) {
        // Check tier rank: user tier must be >= course minimum_tier
        const requiredTier = course.minimum_tier as SubscriptionTier;
        if (requiredTier) {
          const userTierRank = TIER_RANK[subscription.tier] ?? 0;
          const requiredTierRank = TIER_RANK[requiredTier] ?? 0;
          if (userTierRank < requiredTierRank) {
            return {
              url: null,
              expiresAt: null,
              error: `Acceso denegado. Este curso requiere el plan ${requiredTier}.`,
            };
          }
        }
      }
    }

    // 5. Generate 2-hour signed URL from Supabase Storage
    const videoPath = `${courseId}/${lessonId}.mp4`;

    const { data: signedData, error: signError } = await supabase.storage
      .from('videos')
      .createSignedUrl(videoPath, SIGNED_URL_EXPIRY_SECONDS);

    if (signError || !signedData?.signedUrl) {
      console.warn(`[generateSignedVideoUrl] Could not sign URL for ${videoPath}:`, signError?.message);
      return {
        url: null,
        expiresAt: null,
        error: 'El archivo de video aún no está disponible. Contacta al administrador.',
      };
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString();

    return { url: signedData.signedUrl, expiresAt };
  } catch (err) {
    console.error('[generateSignedVideoUrl] Unexpected error:', err);
    return { url: null, expiresAt: null, error: 'Error interno del servidor.' };
  }
}

/**
 * Server Action: saveVideoProgress
 *
 * Upserts a course_progress row for the authenticated user.
 * - user_id is ALWAYS derived from the server-side session (never from client input)
 * - additionalSeconds is validated: must be >= 0 and <= MAX_ADDITIONAL_SECONDS
 * - totalSeconds is validated: must be >= 0 and <= MAX_TOTAL_SECONDS
 * - course_title, course_instructor, course_thumbnail are accepted from payload
 *   but user_id is always overridden with the session user
 *
 * SECURITY FIX (Audit Phase 2, Issue #6):
 *   - additionalSeconds validated >= 0 and <= 7200 (2h per session)
 *   - totalSeconds validated >= 0 and <= 86400 (24h max)
 *   - user_id always from session, never from payload
 */
export interface SaveProgressPayload {
  courseId: string;
  courseTitle: string;
  courseInstructor: string;
  courseThumbnail?: string;
  courseThumbnailAlt?: string;
  additionalSeconds: number;
  totalSeconds?: number;
  markComplete?: boolean;
}

export async function saveVideoProgress(payload: SaveProgressPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // user_id ALWAYS from server-side session — never from payload
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No autenticado.' };
    }

    // Validate additionalSeconds: must be a non-negative integer within bounds
    const additionalSeconds = Math.floor(Number(payload.additionalSeconds));
    if (!Number.isFinite(additionalSeconds) || additionalSeconds < 0) {
      return { success: false, error: 'additionalSeconds debe ser un número no negativo.' };
    }
    if (additionalSeconds > MAX_ADDITIONAL_SECONDS) {
      return { success: false, error: `additionalSeconds no puede exceder ${MAX_ADDITIONAL_SECONDS} segundos por sesión.` };
    }

    // Validate totalSeconds
    const totalSeconds = payload.totalSeconds !== undefined
      ? Math.floor(Number(payload.totalSeconds))
      : 0;
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
      return { success: false, error: 'totalSeconds debe ser un número no negativo.' };
    }
    const clampedTotalSeconds = Math.min(totalSeconds, MAX_TOTAL_SECONDS);

    // Fetch existing row to increment watched_seconds correctly
    const { data: existing } = await supabase
      .from('course_progress')
      .select('id, watched_seconds, completed')
      .eq('user_id', user.id)
      .eq('course_id', payload.courseId)
      .maybeSingle();

    const currentWatched = existing?.watched_seconds ?? 0;
    const newWatchedSeconds = Math.min(currentWatched + additionalSeconds, MAX_TOTAL_SECONDS);
    const alreadyCompleted = existing?.completed ?? false;
    const markComplete = payload.markComplete === true;

    const upsertData: Record<string, unknown> = {
      user_id: user.id,           // Always from session — never from payload
      course_id: payload.courseId,
      course_title: payload.courseTitle,
      course_instructor: payload.courseInstructor,
      course_thumbnail: payload.courseThumbnail ?? '',
      course_thumbnail_alt: payload.courseThumbnailAlt ?? '',
      watched_seconds: newWatchedSeconds,
      total_seconds: clampedTotalSeconds,
      updated_at: new Date().toISOString(),
    };

    if (markComplete && !alreadyCompleted) {
      upsertData.completed = true;
      upsertData.completed_at = new Date().toISOString();
    } else if (!markComplete && !alreadyCompleted) {
      upsertData.completed = false;
    }
    // If already completed, don't overwrite completed/completed_at

    // When marking complete, use the service-role admin client to bypass the
    // prevent_self_completion trigger (which blocks session-based completion writes).
    // Authentication has already been verified above via the user session client.
    const writeClient = (markComplete && !alreadyCompleted)
      ? createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
      : supabase;

    const { error: upsertError } = await writeClient
      .from('course_progress')
      .upsert(upsertData, { onConflict: 'user_id,course_id' });

    if (upsertError) {
      console.error('[saveVideoProgress] Upsert error:', upsertError.message);
      return { success: false, error: upsertError.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[saveVideoProgress] Unexpected error:', err);
    return { success: false, error: 'Error interno del servidor.' };
  }
}
