import React from 'react';
import { getCourseBySlugForPlayer, getCourseByIdForPlayer } from '@/app/actions/courses';
import type { FullCourseData } from '@/app/actions/courses';
import AppLayout from '@/components/AppLayout';
import CourseDetailClient from './CourseDetailClient';

interface Instructor {
  id: string;
  name: string;
  specialty: string;
  tags: string[];
  bio: string | null;
  photo_url: string | null;
  photo_alt: string | null;
  created_at: string;
  updated_at: string;
}

interface CourseData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructor: string | Instructor;
  instructor_name: string;
  instructor_specialty: string;
  instructor_photo_url: string | null;
  instructor_photo_alt: string | null;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  access_type: 'free' | 'membership' | 'premium_purchase';
  minimum_tier: 'free' | 'apertura' | 'obturador' | 'diafragma' | null;
  price: number | null;
  rating: number;
  review_count: number;
  rating_distribution: Record<number, number>;
  category: { id: string; name: string; slug: string } | null;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    position: number;
    lessons: Array<{
      id: string;
      title: string;
      description: string | null;
      duration_seconds: number;
      position: number;
      video_provider: 'supabase' | 'bunny' | 'vimeo';
      video_asset_id: string | null;
      is_free_preview: boolean;
    }>;
  }>;
  reviews: Array<{
    id: string;
    course_id: string;
    user_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    updated_at: string;
    user?: { full_name: string; avatar_url: string | null };
  }>;
  lesson_count: number;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapCourseData(course: FullCourseData): CourseData {
  const instructor =
    course.instructor && typeof course.instructor === 'object' ? course.instructor : null;
  return {
    ...course,
    rating: course.rating ?? 0,
    review_count: course.review_count ?? 0,
    rating_distribution: course.rating_distribution ?? { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    lesson_count: course.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0) ?? 0,
    category_id: course.category?.id ?? null,
    created_at: course.created_at ?? new Date().toISOString(),
    updated_at: course.updated_at ?? new Date().toISOString(),
    instructor_name:
      instructor?.name ||
      (typeof course.instructor === 'string' ? course.instructor : 'Instructor'),
    instructor_specialty: instructor?.specialty || '',
    instructor_photo_url: instructor?.photo_url || null,
    instructor_photo_alt: instructor?.photo_alt || null,
  };
}

// UUID v4 regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PageProps {
  searchParams: Promise<{ course?: string }>;
}

export default async function CourseDetailPage({ searchParams }: PageProps) {
  const { course: courseParam } = await searchParams;

  if (!courseParam) {
    return (
      <AppLayout currentPath="/course-detail" fullWidth>
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 py-20 text-center">
          <h1 className="text-2xl font-800 text-foreground mb-4">Curso no especificado</h1>
          <p className="text-muted-foreground mb-6">No se proporcionó un identificador de curso.</p>
          <a href="/courses" className="btn-primary inline-flex">
            Ver todos los cursos
          </a>
        </div>
      </AppLayout>
    );
  }

  // Try by ID if it's a UUID, otherwise by slug
  const isUuid = UUID_REGEX.test(courseParam);
  let course: FullCourseData | null = null;

  if (isUuid) {
    course = await getCourseByIdForPlayer(courseParam);
  }

  // If not found by ID or not a UUID, try by slug
  if (!course) {
    course = await getCourseBySlugForPlayer(courseParam);
  }

  if (!course) {
    return (
      <AppLayout currentPath="/course-detail" fullWidth>
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 py-20 text-center">
          <h1 className="text-2xl font-800 text-foreground mb-4">Curso no encontrado</h1>
          <p className="text-muted-foreground mb-6">
            El curso que buscas no existe o no está publicado.
          </p>
          <a href="/courses" className="btn-primary inline-flex">
            Ver todos los cursos
          </a>
        </div>
      </AppLayout>
    );
  }

  const courseData = mapCourseData(course);

  return (
    <AppLayout currentPath="/course-detail" fullWidth>
      <CourseDetailClient course={courseData} />
    </AppLayout>
  );
}
