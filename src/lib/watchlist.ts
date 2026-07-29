'use client';

import { createClient } from '@/lib/supabase/client';

export interface WatchlistCourse {
  id: string;
  courseId: string;
  courseTitle: string;
  courseInstructor: string;
  courseThumbnail: string;
  courseThumbnailAlt: string;
  courseDuration: string;
  courseTier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  courseRating?: number;
  courseLessonCount?: number;
  addedAt: string;
}

function mapRow(row: any): WatchlistCourse {
  return {
    id: row.id,
    courseId: row.course_id,
    courseTitle: row.course_title,
    courseInstructor: row.course_instructor,
    courseThumbnail: row.course_thumbnail,
    courseThumbnailAlt: row.course_thumbnail_alt,
    courseDuration: row.course_duration,
    courseTier: row.course_tier as WatchlistCourse['courseTier'],
    courseRating: row.course_rating ?? undefined,
    courseLessonCount: row.course_lesson_count ?? undefined,
    addedAt: row.added_at,
  };
}

export async function getWatchlist(): Promise<WatchlistCourse[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function addToWatchlist(course: {
  courseId: string;
  courseTitle: string;
  courseInstructor: string;
  courseThumbnail: string;
  courseThumbnailAlt: string;
  courseDuration: string;
  courseTier: string;
  courseRating?: number;
  courseLessonCount?: number;
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('watchlist').upsert(
    {
      user_id: user.id,
      course_id: course.courseId,
      course_title: course.courseTitle,
      course_instructor: course.courseInstructor,
      course_thumbnail: course.courseThumbnail,
      course_thumbnail_alt: course.courseThumbnailAlt,
      course_duration: course.courseDuration,
      course_tier: course.courseTier,
      course_rating: course.courseRating ?? null,
      course_lesson_count: course.courseLessonCount ?? null,
    },
    { onConflict: 'user_id,course_id' }
  );
  if (error) throw error;
}

export async function removeFromWatchlist(courseId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', user.id)
    .eq('course_id', courseId);
  if (error) throw error;
}

export async function isInWatchlist(courseId: string): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('watchlist')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function getWatchlistCourseIds(): Promise<Set<string>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from('watchlist')
    .select('course_id')
    .eq('user_id', user.id);
  if (error) return new Set();
  return new Set((data ?? []).map((r: any) => r.course_id));
}
