import { createClient } from '@/lib/supabase/client';

// Maximum reasonable values for progress validation
const MAX_ADDITIONAL_SECONDS = 7200; // 2 hours per session
const MAX_TOTAL_SECONDS = 86400;     // 24 hours total course duration

export interface CourseProgressPayload {
  userId: string;
  courseId: string;
  courseTitle: string;
  courseInstructor: string;
  courseThumbnail?: string;
  courseThumbnailAlt?: string;
  /**
   * Additional seconds watched in this session.
   * Must be >= 0 and <= 7200 (2 hours per session).
   * Values outside this range are rejected.
   */
  additionalSeconds: number;
  totalSeconds?: number;
  /**
   * @deprecated Do NOT pass completed=true from the client.
   * The prevent_self_completion DB trigger will reject it.
   * Use the saveVideoProgress() server action in src/app/actions/video.ts
   * which uses the service-role admin client for completion writes.
   */
  completed?: boolean;
}

/**
 * Upserts a course_progress row for the given user+course.
 * - Increments watched_seconds by additionalSeconds
 * - user_id is taken from payload.userId but the server-side action
 *   always overrides with the session user
 *
 * SECURITY NOTE (Phase 2 Audit Corrections):
 * - additionalSeconds is validated: must be >= 0 and <= MAX_ADDITIONAL_SECONDS
 * - totalSeconds is validated: must be >= 0 and <= MAX_TOTAL_SECONDS
 * - Passing completed=true from this client-side function will be REJECTED
 *   by the prevent_self_completion database trigger.
 * - Use the saveVideoProgress() server action instead for completion tracking.
 * - This function is safe for progress updates (watched_seconds, total_seconds).
 */
export async function updateCourseProgress(payload: CourseProgressPayload): Promise<void> {
  // Validate additionalSeconds
  const additionalSeconds = Math.floor(Number(payload.additionalSeconds));
  if (!Number.isFinite(additionalSeconds) || additionalSeconds < 0) {
    console.warn('[updateCourseProgress] Invalid additionalSeconds — must be >= 0. Skipping.');
    return;
  }
  if (additionalSeconds > MAX_ADDITIONAL_SECONDS) {
    console.warn(
      `[updateCourseProgress] additionalSeconds (${additionalSeconds}) exceeds max (${MAX_ADDITIONAL_SECONDS}). Clamping.`
    );
  }
  const clampedAdditional = Math.min(additionalSeconds, MAX_ADDITIONAL_SECONDS);

  // Validate totalSeconds
  const totalSeconds = payload.totalSeconds !== undefined
    ? Math.floor(Number(payload.totalSeconds))
    : 0;
  const clampedTotal = Math.max(0, Math.min(
    Number.isFinite(totalSeconds) ? totalSeconds : 0,
    MAX_TOTAL_SECONDS
  ));

  const supabase = createClient();

  // Fetch existing row first so we can increment watched_seconds correctly
  const { data: existing } = await supabase
    .from('course_progress')
    .select('id, watched_seconds, completed')
    .eq('user_id', payload.userId)
    .eq('course_id', payload.courseId)
    .maybeSingle();

  const currentWatched = existing?.watched_seconds ?? 0;
  const newWatchedSeconds = Math.min(currentWatched + clampedAdditional, MAX_TOTAL_SECONDS);
  const alreadyCompleted = existing?.completed ?? false;
  const markComplete = payload.completed === true;

  // Phase 2: Do NOT attempt to set completed=true from client-side.
  // The prevent_self_completion trigger will reject it.
  // Use saveVideoProgress() server action for completion writes.
  if (markComplete && !alreadyCompleted) {
    console.warn(
      '[updateCourseProgress] Setting completed=true from client-side is blocked by DB trigger. ' +
      'Use saveVideoProgress() server action instead.'
    );
    // Fall through without setting completed=true — only update progress metrics
  }

  const upsertData: Record<string, unknown> = {
    user_id: payload.userId,
    course_id: payload.courseId,
    course_title: payload.courseTitle,
    course_instructor: payload.courseInstructor,
    course_thumbnail: payload.courseThumbnail ?? '',
    course_thumbnail_alt: payload.courseThumbnailAlt ?? '',
    watched_seconds: newWatchedSeconds,
    total_seconds: clampedTotal,
    updated_at: new Date().toISOString(),
    // completed is intentionally NOT set here — use saveVideoProgress() server action
  };

  if (!alreadyCompleted) {
    upsertData.completed = false;
  }
  // If already completed, don't overwrite completed/completed_at

  await supabase
    .from('course_progress')
    .upsert(upsertData, { onConflict: 'user_id,course_id' });
}
