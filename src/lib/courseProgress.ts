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
  completed?: boolean;
}

/**
 * Upserts a course_progress row for the given user+course.
 * - Increments watched_seconds by additionalSeconds
 * - Sets completed = true when explicitly passed
 * - Sets completed_at when marking complete for the first time
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
  };

  if (markComplete && !alreadyCompleted) {
    upsertData.completed = true;
    upsertData.completed_at = new Date().toISOString();
  } else if (!markComplete && !alreadyCompleted) {
    upsertData.completed = false;
  }
  // If already completed, don't overwrite completed/completed_at

  await supabase
    .from('course_progress')
    .upsert(upsertData, { onConflict: 'user_id,course_id' });
}
