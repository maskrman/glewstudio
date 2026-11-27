'use server';

/**
 * GLEW Studio — In Progress Courses API
 * Server-side actions for fetching courses the user has started watching
 */

import { createClient as createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type CourseProgressRow = Database['public']['Tables']['course_progress']['Row'];
type CourseRow = Database['public']['Tables']['courses']['Row'];

interface CourseWithModules {
  id: string;
  slug: string;
  title: string;
  instructor: string | null;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma' | null;
  modules: Array<{
    lessons: Array<{
      id: string;
      title: string;
      position: number;
      duration_seconds: number | null;
    }> | null;
  }> | null;
}

export interface InProgressCourse {
  id: string;
  slug: string;
  title: string;
  instructor: string;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  tier_label: string;
  progress: number; // percentage 0-100
  last_lesson: string | null;
  updated_at: string;
}

function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    free: 'Gratis',
    apertura: 'Apertura',
    obturador: 'Obturador',
    diafragma: 'Diafragma',
  };
  return labels[tier] || tier;
}

export async function getInProgressCourses(): Promise<InProgressCourse[]> {
  const supabase = await createServerClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Get user's course progress
  const { data: progress, error: progressError } = await supabase
    .from('course_progress')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (progressError) {
    throw new Error(`Error obteniendo progreso: ${progressError.message}`);
  }

  if (!progress || progress.length === 0) {
    return [];
  }

  // Get course details for courses with progress > 0 and < 100%
  const inProgressCourseIds = progress
    .filter((p) => p.watched_seconds > 0 && !p.completed)
    .map((p) => p.course_id);

  if (inProgressCourseIds.length === 0) {
    return [];
  }

  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select(
      `
      id, slug, title, instructor, thumbnail, thumbnail_alt, tier,
      modules:course_modules (
        lessons:lessons (id, title, position)
      )
    `
    )
    .in('id', inProgressCourseIds)
    .eq('is_published', true)
    .eq('status', 'public');

  if (coursesError) {
    throw new Error(`Error obteniendo cursos: ${coursesError.message}`);
  }

  if (!courses || courses.length === 0) {
    return [];
  }

  // Map progress to courses and calculate progress percentage
  const progressMap = new Map(progress.map((p) => [p.course_id, p]));

  return (courses as CourseWithModules[])
    .map((course) => {
      const prog = progressMap.get(course.id);
      if (!prog) return null;

      // Calculate total course duration from modules/lessons
      const lessons = course.modules?.flatMap((m: any) => m.lessons ?? []) ?? [];
      const totalSeconds = lessons.reduce(
        (sum: number, l: any) => sum + (l.duration_seconds || 0),
        0
      );

      const percent =
        totalSeconds > 0
          ? Math.round((prog.watched_seconds / totalSeconds) * 100)
          : prog.completed
            ? 100
            : 0;

      // Find last lesson watched (by matching watched_seconds > 0)
      let lastLessonTitle = '';
      if (lessons.length > 0) {
        // Sort lessons by position
        const sortedLessons = [...lessons].sort((a, b) => a.position - b.position);
        // Find the last lesson that has some progress
        // For simplicity, use the lesson corresponding to the progress percentage
        const lessonIndex = Math.min(
          Math.floor((percent / 100) * sortedLessons.length),
          sortedLessons.length - 1
        );
        lastLessonTitle = sortedLessons[Math.max(0, lessonIndex)].title || '';
      }

      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        instructor: course.instructor || '',
        thumbnail: course.thumbnail,
        thumbnail_alt: course.thumbnail_alt,
        tier: course.tier ?? 'apertura',
        tier_label: getTierLabel(course.tier ?? 'apertura'),
        progress: Math.min(percent, 99), // Cap at 99% if not completed
        last_lesson: lastLessonTitle || null,
        updated_at: prog.updated_at,
      } as InProgressCourse;
    })
    .filter(Boolean) as InProgressCourse[];
}
