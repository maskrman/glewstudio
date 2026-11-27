'use client';

import React, { useState, useEffect } from 'react';
import { getInProgressCourses, type InProgressCourse } from '@/app/actions/in-progress';
import AppLayout from '@/components/AppLayout';
import { createClient } from '@/lib/supabase/client';

export default function InProgressPage() {
  const [courses, setCourses] = useState<InProgressCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadCourses() {
      try {
        const data = await getInProgressCourses();
        if (mounted) {
          setCourses(data);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading in-progress courses:', error);
        if (mounted) {
          setCourses([]);
          setLoading(false);
        }
      }
    }

    loadCourses();

    // Subscribe to Realtime changes on course_progress table
    const channel = supabase
      .channel('course-progress-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'course_progress',
        },
        () => {
          if (mounted) {
            loadCourses();
          }
        }
      )
      .subscribe();

    // Also subscribe to courses table changes (new courses, updates, etc.)
    const coursesChannel = supabase
      .channel('courses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'courses',
        },
        () => {
          if (mounted) {
            loadCourses();
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(coursesChannel);
    };
  }, []);

  if (loading) {
    return (
      <AppLayout currentPath="/en-curso">
        <div className="min-h-screen bg-background pt-20 pb-16">
          <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
            <div className="mb-10">
              <h1 className="text-hero-md font-800 text-foreground mb-3">En Curso</h1>
              <p className="text-muted-foreground">
                Continúa donde lo dejaste. Tu progreso se guarda automáticamente.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="glass-card rounded-2xl overflow-hidden border-white/10 animate-pulse"
                >
                  <div className="aspect-video bg-muted" />
                  <div className="p-4 space-y-2">
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-10 bg-muted rounded w-full mt-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPath="/en-curso">
      <div className="min-h-screen bg-background pt-20 pb-16">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
          <div className="mb-10">
            <h1 className="text-hero-md font-800 text-foreground mb-3">En Curso</h1>
            <p className="text-muted-foreground">
              Continúa donde lo dejaste. Tu progreso se guarda automáticamente.
            </p>
          </div>

          {courses.length === 0 ? (
            // Empty state
            <div className="glass-card rounded-2xl p-16 md:p-24 text-center border-white/10">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M14.752 15.652l-3.353 3.353a2 2 0 01-2.828 0l-3.353-3.353m9.172 0l-3.353 3.353a2 2 0 01-2.828 0l-4.899-4.899a2 2 0 010-2.828l4.899-4.899a2 2 0 012.828 0l3.353 3.353m-9.172 0l3.353-3.353a2 2 0 012.828 0l4.899 4.899a2 2 0 010 2.828l-4.899 4.899a2 2 0 01-2.828 0l-3.353-3.353"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-700 text-foreground mb-3">No hay cursos en progreso</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">
                Aún no has empezado ningún curso. Explora el catálogo y comienza a aprender hoy
                mismo.
              </p>
              <a
                href="/courses"
                className="btn-primary px-8 py-3 text-base inline-flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Explorar Cursos
              </a>
            </div>
          ) : (
            // Courses grid
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {courses.map((course) => (
                <InProgressCourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

interface InProgressCourseCardProps {
  course: InProgressCourse;
}

function InProgressCourseCard({ course }: InProgressCourseCardProps) {
  return (
    <article className="glass-card rounded-2xl overflow-hidden border-white/10 hover:border-primary/30 transition-colors group">
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt={course.thumbnail_alt || course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <img
              src="/assets/images/studio-hero.jpg"
              alt="Imagen por defecto del curso"
              className="w-full h-full object-cover opacity-50"
            />
          </div>
        )}
        {/* Progress overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-600 text-white/90">{course.tier_label}</span>
            <span className="text-xs font-700 text-gold">{course.progress}%</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold rounded-full transition-all duration-500"
              style={{ width: `${Math.min(course.progress, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <h3 className="font-700 text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-1">{course.instructor}</p>

        {course.last_lesson && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50">
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 15.652l-3.353 3.353a2 2 0 01-2.828 0l-3.353-3.353m9.172 0l-3.353 3.353a2 2 0 01-2.828 0l-4.899-4.899a2 2 0 010-2.828l4.899-4.899a2 2 0 012.828 0l3.353 3.353m-9.172 0l3.353-3.353a2 2 0 012.828 0l4.899 4.899a2 2 0 010 2.828l-4.899 4.899a2 2 0 01-2.828 0l-3.353-3.353"
              />
            </svg>
            <span className="truncate">Última: {course.last_lesson}</span>
          </div>
        )}

        <a
          href={`/video-player/${course.slug}`}
          className="btn-primary w-full py-2.5 text-sm font-600 mt-2 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          Continuar viendo
        </a>
      </div>
    </article>
  );
}
