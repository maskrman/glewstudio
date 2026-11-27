'use server';

/**
 * GLEW Studio — Landing Page Data Actions
 * Server-side actions for fetching public landing page data from Supabase
 */

import { createClient as createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';
import { formatDuration } from '@/lib/admin-courses';

type CourseRow = Database['public']['Tables']['courses']['Row'];
type InstructorRow = Database['public']['Tables']['instructors']['Row'];
type MembershipPlanRow = Database['public']['Tables']['membership_plans']['Row'];

export interface LandingCourse {
  id: string;
  slug: string;
  title: string;
  instructor: string;
  instructor_id: string | null;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  rating: number;
  lesson_count: number;
  reviews_count: number;
  is_published: boolean;
  status: 'draft' | 'public' | 'presale';
  access_type: 'free' | 'membership' | 'premium_purchase';
  is_featured: boolean;
  category_id: string | null;
  created_at: string | null;
  description: string | null;
}

export interface LandingInstructor {
  id: string;
  name: string;
  specialty: string | null;
  tags: string[] | null;
  photo_url: string | null;
  photo_alt: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface LandingPageData {
  heroCourse: LandingCourse | null;
  trendingCourses: LandingCourse[];
  lightingCourses: LandingCourse[];
  recentCourses: LandingCourse[];
  instructors: LandingInstructor[];
}

function mapCourseRow(course: any): LandingCourse {
  // Compute duration from lessons if available
  let duration = course.duration || '';
  if (course.modules && Array.isArray(course.modules)) {
    const totalSeconds = course.modules.reduce((sum: number, m: any) => {
      const lessonSeconds = (m.lessons ?? []).reduce(
        (lessonSum: number, lesson: any) => lessonSum + (lesson.duration_seconds || 0),
        0
      );
      return sum + lessonSeconds;
    }, 0);
    if (totalSeconds > 0) {
      duration = formatDuration(totalSeconds);
    }
  }

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    instructor: course.instructor || '',
    instructor_id: course.instructor_id || null,
    thumbnail: course.thumbnail,
    thumbnail_alt: course.thumbnail_alt,
    duration,
    tier: course.tier ?? 'apertura',
    rating: course.rating ?? 0,
    lesson_count: course.lesson_count || 0,
    reviews_count: course.reviews_count ?? 0,
    is_published: course.is_published,
    status: course.status,
    access_type: course.access_type,
    is_featured: course.is_featured ?? false,
    category_id: course.category_id ?? null,
    created_at: course.created_at ?? null,
    description: course.description ?? null,
  };
}

function mapInstructorRow(instructor: InstructorRow): LandingInstructor {
  return {
    id: instructor.id,
    name: instructor.name,
    specialty: instructor.specialty,
    tags: instructor.tags,
    photo_url: instructor.photo_url,
    photo_alt: instructor.photo_alt,
    bio: instructor.bio,
    created_at: instructor.created_at,
    updated_at: instructor.updated_at,
  };
}

export async function getLandingPageData(): Promise<LandingPageData> {
  const supabase = await createServerClient();

  // Fetch all published public courses
  const { data: allPublishedCourses, error: coursesError } = await supabase
    .from('courses')
    .select(
      `
      *,
      modules:course_modules (
        lessons:lessons (id, duration_seconds)
      )
    `
    )
    .eq('is_published', true)
    .eq('status', 'public')
    .order('rating', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(24);

  if (coursesError) {
    throw new Error(`Error obteniendo cursos publicados: ${coursesError.message}`);
  }

  // Fetch review counts for these courses
  const courseIds = (allPublishedCourses ?? []).map((c) => c.id);
  let reviewsCountMap: Record<string, number> = {};

  if (courseIds.length > 0) {
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('course_reviews')
      .select('course_id', { count: 'exact', head: false })
      .in('course_id', courseIds);

    if (!reviewsError && reviewsData) {
      // Count reviews per course
      for (const review of reviewsData) {
        reviewsCountMap[review.course_id] = (reviewsCountMap[review.course_id] || 0) + 1;
      }
    }
  }

  // Transform courses with review counts
  const transformedCourses = (allPublishedCourses ?? []).map((course) => ({
    ...mapCourseRow(course),
    reviews_count: reviewsCountMap[course.id] ?? 0,
  }));

  // Sort by reputation: rating desc, reviews_count desc, created_at desc
  transformedCourses.sort((a, b) => {
    if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
    if ((b.reviews_count || 0) !== (a.reviews_count || 0))
      return (b.reviews_count || 0) - (a.reviews_count || 0);
    return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
  });

  // Hero course: highest reputation
  const heroCourse = transformedCourses[0] ?? null;

  // Trending: top 8 by reputation
  const trendingCourses = transformedCourses.slice(0, 8);

  // Lighting courses: filter by category_id or title
  const lightingCourses = transformedCourses
    .filter(
      (c) =>
        c.category_id &&
        (c.category_id.toLowerCase().includes('iluminacion') ||
          c.category_id.toLowerCase().includes('iluminación') ||
          c.title.toLowerCase().includes('iluminación') ||
          c.title.toLowerCase().includes('luz') ||
          c.title.toLowerCase().includes('flash'))
    )
    .slice(0, 8);

  // Recent courses: top 8 by created_at
  const recentCourses = [...transformedCourses]
    .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
    .slice(0, 8);

  // Fetch instructors
  const { data: instructors, error: instructorsError } = await supabase
    .from('instructors')
    .select('*')
    .order('name', { ascending: true });

  if (instructorsError) {
    throw new Error(`Error obteniendo instructores: ${instructorsError.message}`);
  }

  return {
    heroCourse,
    trendingCourses,
    lightingCourses,
    recentCourses,
    instructors: (instructors ?? []).map(mapInstructorRow),
  };
}

// ─── Membership Plans ───────────────────────────────────────────────────────────

export interface LandingMembershipPlan {
  slug: string;
  name: string;
  badge: string | null;
  monthly_price: number;
  annual_monthly_price: number;
  premium_discount_percent: number;
  features: string[];
  is_popular: boolean;
}

export async function getLandingMembershipPlans(): Promise<LandingMembershipPlan[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .order('monthly_price', { ascending: true });

  if (error) {
    throw new Error(`Error obteniendo planes de membresía: ${error.message}`);
  }

  return (data ?? []).map((plan) => ({
    slug: plan.slug,
    name: plan.name,
    badge: plan.badge,
    monthly_price: plan.monthly_price,
    annual_monthly_price: plan.annual_monthly_price,
    premium_discount_percent: plan.premium_discount_percent,
    features: plan.features as string[],
    is_popular: plan.is_popular,
  }));
}
