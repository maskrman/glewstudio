import { createClient } from '@/lib/supabase/client';

export interface CourseProgressPayload {
  userId: string;
  courseId: string;
  courseTitle: string;
  courseInstructor: string;
  courseThumbnail?: string;
  courseThumbnailAlt?: string;
  /** Additional seconds watched in this session */
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
 * - Sets completed = true when explicitly passed
 * - Sets completed_at when marking complete for the first time
 *
 * ⚠️  SECURITY NOTE (Phase 2):
 * Passing completed=true from this client-side function will be REJECTED
 * by the prevent_self_completion database trigger.
 * Use the saveVideoProgress() server action instead for completion tracking.
 * This function is safe for progress updates (watched_seconds, total_seconds).
 */
export async function updateCourseProgress(payload: CourseProgressPayload): Promise<void> {
  const supabase = createClient();

  // Fetch existing row first so we can increment watched_seconds correctly
  const { data: existing } = await supabase
    .from('course_progress')
    .select('id, watched_seconds, completed')
    .eq('user_id', payload.userId)
    .eq('course_id', payload.courseId)
    .maybeSingle();

  const newWatchedSeconds = (existing?.watched_seconds ?? 0) + payload.additionalSeconds;
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
    total_seconds: payload.totalSeconds ?? 0,
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
