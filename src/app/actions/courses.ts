'use server';

/**
 * GLEW Studio — Public Courses API Routes
 * Server-side actions for fetching published courses for the public catalog
 */

import { createClient as createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import type { Instructor } from '@/lib/admin-courses';
import { formatDuration } from '@/lib/admin-courses';

type CourseRow = Database['public']['Tables']['courses']['Row'];
type CategoryRow = Database['public']['Tables']['categories']['Row'];

export type PublicCourse = Omit<CourseRow, 'tier' | 'rating'> & {
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  rating: number;
  category: CategoryRow | null;
  description: string | null; // Not in DB but expected by UI
};

export async function getPublishedCourses(): Promise<PublicCourse[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('courses')
    .select(
      `
      *,
      category:categories (
        id,
        name,
        slug
      ),
      modules:course_modules (
        id,
        lessons:lessons (
          id,
          duration_seconds,
          is_free_preview
        )
      )
    `
    )
    .eq('is_published', true)
    .eq('status', 'public')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error obteniendo cursos: ${error.message}`);
  }

  // Add description field (not in DB but expected by UI), ensure tier and rating have defaults
  // Also compute lesson_count and total duration from modules/lessons
  return (data ?? []).map((course) => {
    const lessonCount =
      course.modules?.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0) || 0;

    // Calcular duración total sumando duration_seconds de todas las lecciones
    const totalSeconds =
      course.modules?.reduce((sum: number, m: any) => {
        const lessonSeconds = (m.lessons ?? []).reduce(
          (lessonSum: number, lesson: any) => lessonSum + (lesson.duration_seconds || 0),
          0
        );
        return sum + lessonSeconds;
      }, 0) || 0;

    const computedDuration =
      totalSeconds > 0 ? formatDuration(totalSeconds) : course.duration || '';

    return {
      ...course,
      tier: course.tier ?? 'apertura',
      rating: course.rating ?? 0,
      description: course.description ?? null,
      lesson_count: lessonCount,
      duration: computedDuration || course.duration || '',
    };
  }) as PublicCourse[];
}

export async function getPublishedCourseBySlug(slug: string): Promise<PublicCourse | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('courses')
    .select(
      `
      *,
      category:categories (
        id,
        name,
        slug
      )
    `
    )
    .eq('slug', slug)
    .eq('is_published', true)
    .eq('status', 'public')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Error obteniendo curso: ${error.message}`);
  }

  return data as PublicCourse;
}

export async function getCategories(): Promise<CategoryRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Error obteniendo categorías: ${error.message}`);
  }

  return data ?? [];
}

// ─── Course Reviews ─────────────────────────────────────────────────────────────

export interface CourseReview {
  id: string;
  course_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export async function getCourseReviews(courseId: string): Promise<CourseReview[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('course_reviews')
    .select(
      `
      *,
      user:profiles!course_reviews_user_id_fkey (
        full_name,
        avatar_url
      )
    `
    )
    .eq('course_id', courseId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error obteniendo reseñas: ${error.message}`);
  }

  return (data ?? []) as CourseReview[];
}

export async function getCourseReviewStats(courseId: string): Promise<{
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
}> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('course_reviews')
    .select('rating')
    .eq('course_id', courseId);

  if (error) {
    throw new Error(`Error obteniendo estadísticas de reseñas: ${error.message}`);
  }

  const reviews = data ?? [];
  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
      : 0;

  const ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => ratingDistribution[r.rating]++);

  return { averageRating, totalReviews, ratingDistribution };
}

export async function createCourseReview(
  courseId: string,
  userId: string,
  rating: number,
  comment: string | null
): Promise<CourseReview> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('course_reviews')
    .insert({
      course_id: courseId,
      user_id: userId,
      rating,
      comment,
    })
    .select(
      `
      *,
      user:profiles!course_reviews_user_id_fkey (
        full_name,
        avatar_url
      )
    `
    )
    .single();

  if (error) {
    throw new Error(`Error creando reseña: ${error.message}`);
  }

  return data as CourseReview;
}

export async function updateCourseReview(
  reviewId: string,
  userId: string,
  rating: number,
  comment: string | null
): Promise<CourseReview> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('course_reviews')
    .update({ rating, comment, updated_at: new Date().toISOString() })
    .eq('id', reviewId)
    .eq('user_id', userId)
    .select(
      `
      *,
      user:profiles!course_reviews_user_id_fkey (
        full_name,
        avatar_url
      )
    `
    )
    .single();

  if (error) {
    throw new Error(`Error actualizando reseña: ${error.message}`);
  }

  return data as CourseReview;
}

export async function deleteCourseReview(reviewId: string, userId: string): Promise<void> {
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('course_reviews')
    .delete()
    .eq('id', reviewId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Error eliminando reseña: ${error.message}`);
  }
}

export async function getUserCourseReview(
  courseId: string,
  userId: string
): Promise<CourseReview | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('course_reviews')
    .select(
      `
      *,
      user:profiles!course_reviews_user_id_fkey (
        full_name,
        avatar_url
      )
    `
    )
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Error obteniendo reseña del usuario: ${error.message}`);
  }

  return data as CourseReview;
}

// ─── Featured Courses ──────────────────────────────────────────────────────────

export async function getFeaturedCourses(): Promise<DashboardCourse[]> {
  const supabase = await createServerClient();

  const { data: courses, error } = await supabase
    .from('courses')
    .select(
      `
      id, slug, title, instructor, thumbnail, thumbnail_alt, duration, tier, rating,
      modules:course_modules (
        lessons:lessons (id, duration_seconds)
      )
    `
    )
    .eq('is_published', true)
    .eq('status', 'public')
    .eq('is_featured', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error obteniendo cursos destacados: ${error.message}`);
  }

  // Compute lesson counts and total duration
  return (courses ?? []).map((course) => {
    const lessons = course.modules?.flatMap((m: any) => m.lessons ?? []) ?? [];
    const lessonCount = lessons.length;
    const totalSeconds = lessons.reduce(
      (sum: number, l: any) => sum + (l.duration_seconds || 0),
      0
    );
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const duration = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      instructor: course.instructor,
      thumbnail: course.thumbnail,
      thumbnail_alt: course.thumbnail_alt,
      duration,
      tier: course.tier ?? 'apertura',
      rating: course.rating ?? 0,
      lesson_count: lessonCount,
    } as DashboardCourse;
  });
}

// ─── Dashboard Data ────────────────────────────────────────────────────────────

export interface DashboardCourse {
  id: string;
  slug: string;
  title: string;
  instructor: string;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  rating: number;
  lesson_count: number;
  progress?: number; // For continue watching
}

export async function getDashboardData(userId: string | null): Promise<{
  heroCourse: DashboardCourse | null;
  continueWatching: DashboardCourse[];
  recommended: DashboardCourse[];
  recentCourses: DashboardCourse[];
  stats: { totalCourses: number; completedCourses: number; totalHours: number };
}> {
  const supabase = await createServerClient();

  // Get all published courses
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select(
      `
      id, slug, title, instructor, thumbnail, thumbnail_alt, duration, tier, rating,
      modules:course_modules (
        lessons:lessons (id, duration_seconds)
      )
    `
    )
    .eq('is_published', true)
    .eq('status', 'public')
    .order('created_at', { ascending: false });

  if (coursesError) {
    throw new Error(`Error obteniendo cursos: ${coursesError.message}`);
  }

  // Compute lesson counts and total duration
  const coursesWithCounts = (courses ?? []).map((course) => {
    const lessons = course.modules?.flatMap((m: any) => m.lessons ?? []) ?? [];
    const lessonCount = lessons.length;
    const totalSeconds = lessons.reduce(
      (sum: number, l: any) => sum + (l.duration_seconds || 0),
      0
    );
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const duration = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      instructor: course.instructor,
      thumbnail: course.thumbnail,
      thumbnail_alt: course.thumbnail_alt,
      duration,
      tier: course.tier ?? 'apertura',
      rating: course.rating ?? 0,
      lesson_count: lessonCount,
    } as DashboardCourse;
  });

  let continueWatching: DashboardCourse[] = [];
  let stats = { totalCourses: 0, completedCourses: 0, totalHours: 0 };

  if (userId) {
    // Get user's lesson progress for continue watching
    const { data: progress } = await supabase
      .from('lesson_progress')
      .select('lesson_id, completed, watched_seconds')
      .eq('user_id', userId);

    const { data: courseProgress } = await supabase
      .from('course_progress')
      .select('course_id, completed, total_watched_seconds')
      .eq('user_id', userId);

    // Map lesson progress to courses
    if (progress && progress.length > 0) {
      // Get course IDs from lessons
      const lessonIds = progress.map((p) => p.lesson_id);
      const { data: lessonsWithModules } = await supabase
        .from('lessons')
        .select('id, module_id, course_id')
        .in('id', lessonIds);

      // Group by course and find partially completed courses
      const courseProgressMap = new Map<
        string,
        { watched: number; total: number; lastLesson: string }
      >();

      for (const p of progress) {
        const lesson = lessonsWithModules?.find((l) => l.id === p.lesson_id);
        if (lesson) {
          const existing = courseProgressMap.get(lesson.course_id) || {
            watched: 0,
            total: 0,
            lastLesson: '',
          };
          existing.watched += p.watched_seconds || 0;
          existing.total += 1; // Count lessons
          if (!existing.lastLesson || p.watched_seconds > 0) {
            existing.lastLesson = lesson.id;
          }
          courseProgressMap.set(lesson.course_id, existing);
        }
      }

      // Find courses with progress > 0 and < 100%
      const inProgressCourseIds = Array.from(courseProgressMap.entries())
        .filter(([, v]) => v.watched > 0 && v.total > 0)
        .map(([k]) => k);

      if (inProgressCourseIds.length > 0) {
        const inProgressCourses = coursesWithCounts.filter((c) =>
          inProgressCourseIds.includes(c.id)
        );
        // Add progress percentage
        continueWatching = inProgressCourses.map((c) => {
          const prog = courseProgressMap.get(c.id)!;
          const courseProg = courseProgress?.find((cp) => cp.course_id === c.id);
          const totalWatched = courseProg?.total_watched_seconds || prog.watched;
          const totalDuration = c.duration.includes('h')
            ? (parseInt(c.duration.split('h')[0]) * 60 +
                parseInt(c.duration.split('h')[1]?.split('min')[0] || '0')) *
              60
            : parseInt(c.duration.split('min')[0]) * 60;
          const percent = totalDuration > 0 ? Math.round((totalWatched / totalDuration) * 100) : 0;
          return { ...c, progress: Math.min(percent, 99) };
        });
      }
    }

    // Compute stats
    const completedCourses = courseProgress?.filter((cp) => cp.completed).length || 0;
    const totalWatchedSeconds =
      courseProgress?.reduce((sum, cp) => sum + (cp.total_watched_seconds || 0), 0) || 0;
    stats = {
      totalCourses: coursesWithCounts.length,
      completedCourses,
      totalHours: Math.round(totalWatchedSeconds / 3600),
    };
  }

  // Hero course - first published or first in continue watching
  const heroCourse = continueWatching[0] ?? coursesWithCounts[0] ?? null;

  // Recommended - courses user hasn't started
  const startedIds = new Set(continueWatching.map((c) => c.id));
  const recommended = coursesWithCounts.filter((c) => !startedIds.has(c.id)).slice(0, 6);

  // Recent courses
  const recentCourses = coursesWithCounts.slice(0, 8);

  return {
    heroCourse,
    continueWatching,
    recommended,
    recentCourses,
    stats,
  };
}

// ─── Full Course Data for Video Player ──────────────────────────────────────────

export interface CourseLesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  duration_seconds: number;
  position: number;
  video_provider: 'supabase' | 'bunny' | 'vimeo';
  video_asset_id: string | null;
  is_free_preview: boolean;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: CourseLesson[];
}

export interface LessonResource {
  id: string;
  course_id: string;
  lesson_id: string;
  file_name: string;
  display_name: string;
  file_type: string;
  file_size: string | null;
  storage_path: string;
  required_tier: string;
  sort_order: number;
}

export interface FullCourseData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructor: string | Instructor;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  access_type: 'free' | 'membership' | 'premium_purchase';
  minimum_tier: 'free' | 'apertura' | 'obturador' | 'diafragma' | null;
  price: number | null;
  rating: number | null;
  review_count: number;
  rating_distribution: Record<number, number>;
  category: CategoryRow | null;
  modules: CourseModule[];
  resources: LessonResource[];
  reviews: CourseReview[];
  created_at: string;
  updated_at: string;
  what_you_will_learn?: string[];
  requirements?: string[];
}

export async function getCourseBySlugForPlayer(slug: string): Promise<FullCourseData | null> {
  const supabase = await createServerClient();

  // First get the course
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select(
      `
      *,
      category:categories (
        id,
        name,
        slug
      ),
      instructor:instructors (
        id,
        name,
        specialty,
        tags,
        bio,
        photo_url,
        photo_alt,
        created_at,
        updated_at
      )
    `
    )
    .eq('slug', slug)
    .eq('is_published', true)
    .eq('status', 'public')
    .single();

  if (courseError) {
    if (courseError.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Error obteniendo curso: ${courseError.message}`);
  }

  // Get modules with lessons, resources, etc.
  return await getFullCourseData(supabase, course);
}

export async function getCourseByIdForPlayer(id: string): Promise<FullCourseData | null> {
  const supabase = await createServerClient();

  // First get the course by ID
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select(
      `
      *,
      category:categories (
        id,
        name,
        slug
      ),
      instructor:instructors (
        id,
        name,
        specialty,
        tags,
        bio,
        photo_url,
        photo_alt,
        created_at,
        updated_at
      )
    `
    )
    .eq('id', id)
    .eq('is_published', true)
    .eq('status', 'public')
    .single();

  if (courseError) {
    if (courseError.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Error obteniendo curso: ${courseError.message}`);
  }

  // Get modules with lessons, resources, etc.
  return await getFullCourseData(supabase, course);
}

async function getFullCourseData(supabase: any, course: any): Promise<FullCourseData> {
  // Get modules with lessons
  let modulesWithLessons: CourseModule[] = [];
  try {
    const { data: modules, error: modulesError } = await supabase
      .from('course_modules')
      .select(
        `
        *,
        lessons:lessons (
          id,
          module_id,
          title,
          description,
          duration_seconds,
          position,
          video_provider,
          video_asset_id,
          is_free_preview
        )
      `
      )
      .eq('course_id', course.id)
      .order('position', { ascending: true });

    if (modulesError) {
      throw new Error(modulesError.message);
    }

    // Sort lessons by position within each module
    modulesWithLessons = (modules ?? []).map((module: any) => ({
      ...module,
      lessons: (module.lessons ?? []).sort(
        (a: CourseLesson, b: CourseLesson) => a.position - b.position
      ) as CourseLesson[],
    }));
  } catch (error) {
    console.warn('[getFullCourseData] Error fetching modules/lessons:', error);
    modulesWithLessons = [];
  }

  // Get all lesson resources for this course
  let resources: LessonResource[] = [];
  try {
    const { data: resourcesData, error: resourcesError } = await supabase
      .from('lesson_resources')
      .select('*')
      .eq('course_id', course.id)
      .order('sort_order', { ascending: true });

    if (resourcesError) {
      throw new Error(resourcesError.message);
    }

    resources = (resourcesData ?? []) as LessonResource[];
  } catch (error) {
    console.warn('[getFullCourseData] Error fetching resources:', error);
    resources = [];
  }

  // Get reviews for this course
  let reviews: CourseReview[] = [];
  let reviewCount = 0;
  let ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  try {
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('course_reviews')
      .select(
        `
        *,
        user:profiles!course_reviews_user_id_fkey (
          full_name,
          avatar_url
        )
      `
      )
      .eq('course_id', course.id)
      .order('created_at', { ascending: false });

    if (reviewsError) {
      throw new Error(reviewsError.message);
    }

    reviews = (reviewsData ?? []) as CourseReview[];
    reviewCount = reviews.length;
    reviews.forEach((r) => ratingDistribution[r.rating]++);
  } catch (error) {
    console.warn('[getFullCourseData] Error fetching reviews:', error);
    reviews = [];
    reviewCount = 0;
    ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  }

  return {
    ...course,
    tier: course.tier ?? 'apertura',
    rating: course.rating ?? 0,
    review_count: reviewCount,
    rating_distribution: ratingDistribution,
    description: course.description ?? null,
    modules: modulesWithLessons,
    resources,
    reviews,
    created_at: course.created_at ?? new Date().toISOString(),
    updated_at: course.updated_at ?? new Date().toISOString(),
    what_you_will_learn: course.what_you_will_learn ?? [],
    requirements: course.requirements ?? [],
  } as FullCourseData;
}
