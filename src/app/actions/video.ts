'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const SIGNED_URL_EXPIRY_SECONDS = 7200; // 2 hours

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
 *   - An active subscription (any tier), OR
 *   - A direct course purchase for the requested courseId
 *
 * Video assets must be stored in the "videos" bucket at:
 *   <courseId>/<lessonId>.mp4
 *
 * Returns { url, expiresAt } on success, or { url: null, error } on failure.
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

    // 2. Check active subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    // 3. Check course purchase (fallback if no subscription)
    let hasPurchase = false;
    if (!subscription) {
      const { data: purchase } = await supabase
        .from('course_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle();
      hasPurchase = !!purchase;
    }

    const hasAccess = !!subscription || hasPurchase;

    if (!hasAccess) {
      return {
        url: null,
        expiresAt: null,
        error: 'Acceso denegado. Necesitas una suscripción activa o haber adquirido este curso.',
      };
    }

    // 4. Generate 2-hour signed URL from Supabase Storage
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
 * - Increments watched_seconds by additionalSeconds
 * - Marks completed = true when markComplete is true
 *
 * Security note: When marking a course as completed, the write uses the
 * service-role admin client to bypass the prevent_self_completion trigger.
 * The trigger blocks direct browser/session-based completion writes.
 * Authentication is always verified first via the user session client.
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'No autenticado.' };
    }

    // Fetch existing row to increment watched_seconds correctly
    const { data: existing } = await supabase
      .from('course_progress')
      .select('id, watched_seconds, completed')
      .eq('user_id', user.id)
      .eq('course_id', payload.courseId)
      .maybeSingle();

    const newWatchedSeconds = (existing?.watched_seconds ?? 0) + payload.additionalSeconds;
    const alreadyCompleted = existing?.completed ?? false;
    const markComplete = payload.markComplete === true;

    const upsertData: Record<string, unknown> = {
      user_id: user.id,
      course_id: payload.courseId,
      course_title: payload.courseTitle,
      course_instructor: payload.courseInstructor,
      course_thumbnail: payload.courseThumbnail ?? '',
      course_thumbnail_alt: payload.courseThumbnailAlt ?? '',
      watched_seconds: newWatchedSeconds,
      total_seconds: payload.totalSeconds ?? 0,
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
