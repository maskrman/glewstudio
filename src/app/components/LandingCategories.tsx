'use client';

import React from 'react';
import Link from 'next/link';
import CourseCarousel from '@/components/ui/CourseCarousel';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { useLandingData } from './LandingContext';
import type { LandingCourse } from '@/app/actions/landing';

// Transform LandingCourse to CarouselCourse format
function toCarouselCourse(course: LandingCourse) {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    instructor: course.instructor,
    thumbnail: course.thumbnail || '',
    thumbnailAlt: course.thumbnail_alt || course.title,
    duration: course.duration,
    tier: course.tier,
    rating: course.rating,
    lessonCount: course.lesson_count,
  };
}

// Large course card for grid view when few courses
function CourseCardLarge({ course }: { course: LandingCourse }) {
  return (
    <Link
      href={`/course-detail?course=${course.slug}`}
      className="group flex flex-col bg-card border border-border rounded-2xl overflow-hidden transition-all duration-500 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10"
    >
      {/* Thumbnail 16:9 */}
      <div className="relative aspect-video overflow-hidden">
        <AppImage
          src={course.thumbnail || ''}
          alt={course.thumbnail_alt || course.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute top-3 left-3">
          <TierBadge tier={course.tier} size="sm" />
        </div>
        {course.is_featured && (
          <div className="absolute top-3 right-3 bg-amber-500 text-black text-xs font-700 px-2 py-1 rounded-full">
            Destacado
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-700 text-lg text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        {course.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">
            {course.description}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Icon name="UserIcon" size={12} />
          <span className="truncate">{course.instructor || 'Instructor'}</span>
          <span>·</span>
          <Icon name="ClockIcon" size={12} />
          <span>{course.duration || '—'}</span>
          {course.lesson_count && (
            <>
              <span>·</span>
              <Icon name="FilmIcon" size={12} />
              <span>{course.lesson_count} lecciones</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <Icon
            name="ArrowRightIcon"
            size={14}
            className="text-primary group-hover:translate-x-1 transition-transform"
          />
          <span className="text-sm font-600 text-foreground">Ver curso</span>
        </div>
      </div>
    </Link>
  );
}

export default function LandingCategories() {
  const { data } = useLandingData();
  const trendingCourses = data?.trendingCourses ?? [];
  const lightingCourses = data?.lightingCourses ?? [];
  const recentCourses = data?.recentCourses ?? [];

  // Combine all unique courses
  const allCoursesMap = new Map<string, LandingCourse>();
  [...trendingCourses, ...lightingCourses, ...recentCourses].forEach((c) =>
    allCoursesMap.set(c.id, c)
  );
  const allUniqueCourses = Array.from(allCoursesMap.values());

  // Only render if there are courses
  if (allUniqueCourses.length === 0) {
    return null;
  }

  const totalCourses = allUniqueCourses.length;
  const showGrid = totalCourses < 4;

  // Subtle radial gradient for depth
  const gradientBg = (
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_0%,rgba(251,191,36,0.05)_0%,transparent_50%),radial-gradient(ellipse_at_80%_100%,rgba(217,119,6,0.04)_0%,transparent_50%)]" />
  );

  if (showGrid) {
    // Grid layout for few courses
    const columns = totalCourses === 1 ? 1 : totalCourses === 2 ? 2 : 3;

    return (
      <section id="cursos" aria-label="Cursos" className="relative z-10 py-20 lg:py-28">
        {gradientBg}
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
          <div className="text-center mb-12">
            <h2 className="text-hero-md font-800 text-foreground mb-4 relative inline-block">
              Cursos Disponibles
              <span className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-24 h-0.5 bg-gradient-to-r from-amber-500 to-transparent" />
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {totalCourses} curso{totalCourses !== 1 ? 's' : ''} disponible
              {totalCourses !== 1 ? 's' : ''} para empezar a aprender hoy.
            </p>
          </div>
          <div
            className={`grid grid-cols-1 sm:grid-cols-${columns === 1 ? 1 : columns === 2 ? 2 : 3} gap-6 lg:gap-8 max-w-5xl mx-auto`}
          >
            {allUniqueCourses.map((course) => (
              <CourseCardLarge key={course.id} course={course} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Carousel layout for 4+ courses
  return (
    <section id="cursos" aria-label="Cursos" className="relative z-10 py-20 lg:py-28">
      {gradientBg}
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
        <div className="text-center mb-12">
          <h2 className="text-hero-md font-800 text-foreground mb-4 relative inline-block">
            Catálogo de Cursos
            <span className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-24 h-0.5 bg-gradient-to-r from-amber-500 to-transparent" />
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Explora todas las categorías y encuentra tu próximo curso.
          </p>
        </div>
        <div className="space-y-12">
          {trendingCourses.length > 0 && (
            <CourseCarousel
              title="Tendencias"
              courses={trendingCourses.map(toCarouselCourse)}
              badgeLabel="Tendencia"
              badgeColor="bg-amber-500/20 text-amber-400 border border-amber-500/30"
            />
          )}
          {lightingCourses.length > 0 && (
            <CourseCarousel
              title="Iluminación Pro"
              courses={lightingCourses.map(toCarouselCourse)}
              badgeLabel="Pro"
              badgeColor="bg-blue-500/20 text-blue-400 border border-blue-500/30"
            />
          )}
          {recentCourses.length > 0 && (
            <CourseCarousel
              title="Recientes"
              courses={recentCourses.map(toCarouselCourse)}
              badgeLabel="Nuevo"
              badgeColor="bg-green-500/20 text-green-400 border border-green-500/30"
            />
          )}
        </div>
      </div>
    </section>
  );
}
