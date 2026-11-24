'use client';

import React, { useEffect, useState } from 'react';
import CourseCarousel from '@/components/ui/CourseCarousel';
import { getDashboardData } from '@/app/actions/courses';

interface DashboardCourse {
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
  progress?: number;
}

interface CarouselProps {
  title: string;
  courses: DashboardCourse[];
  badgeLabel?: string;
  badgeColor?: string;
}

function Carousel({ title, courses, badgeLabel, badgeColor }: CarouselProps) {
  if (courses.length === 0) return null;
  return (
    <CourseCarousel
      title={title}
      courses={courses.map((c) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        instructor: c.instructor,
        thumbnail: c.thumbnail ?? '',
        thumbnailAlt: c.thumbnail_alt ?? '',
        duration: c.duration,
        tier: c.tier,
        progress: c.progress,
        lessonCount: c.lesson_count,
        rating: c.rating,
        accessBadge: badgeLabel,
      }))}
      badgeLabel={badgeLabel}
      badgeColor={badgeColor}
    />
  );
}

export default function DashboardCarousels() {
  const [data, setData] = useState<{
    continueWatching: DashboardCourse[];
    recommended: DashboardCourse[];
    recentCourses: DashboardCourse[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const result = await getDashboardData(null);
        setData({
          continueWatching: result.continueWatching,
          recommended: result.recommended,
          recentCourses: result.recentCourses,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando datos');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-10 pt-10">
        {[1, 2, 3].map((i) => (
          <CourseCarousel
            key={i}
            title={['Continuar Viendo', 'Incluido en tu Membresía', 'Cursos Recientes'][i - 1]}
            courses={Array(5).fill({
              id: '',
              title: '',
              instructor: '',
              duration: '',
              tier: 'apertura' as const,
              lessonCount: 0,
              rating: 0,
            })}
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-10 pt-10">
        <CourseCarousel title="Continuar Viendo" courses={[]} />
        <CourseCarousel
          title="Incluido en tu Membresía"
          courses={[]}
          badgeLabel="Membresía"
          badgeColor="tier-badge-obturador"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pt-10">
      <Carousel title="Continuar Viendo" courses={data.continueWatching} />
      <Carousel
        title="Incluido en tu Membresía"
        courses={data.recommended.slice(0, 8)}
        badgeLabel="Membresía"
        badgeColor="tier-badge-obturador"
      />
      <Carousel
        title="Cursos Recientes"
        courses={data.recentCourses.slice(0, 8)}
        badgeLabel="Nuevo"
        badgeColor="tier-badge-apertura"
      />
    </div>
  );
}
