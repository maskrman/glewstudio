'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LandingCourse, LandingInstructor, LandingPageData } from '@/app/actions/landing';

interface LandingContextType {
  data: LandingPageData | null;
  isLoading: boolean;
}

const LandingContext = createContext<LandingContextType>({
  data: null,
  isLoading: true,
});

interface LandingProviderProps {
  children: React.ReactNode;
  initialData: LandingPageData;
}

export function LandingProvider({ children, initialData }: LandingProviderProps) {
  const [data, setData] = useState<LandingPageData>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Initialize Supabase client
    const supabase = createClient();
    supabaseRef.current = supabase;

    // Subscribe to courses changes
    const channel = supabase
      .channel('landing-courses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'courses',
          filter: 'is_published=eq.true AND status=eq.public',
        },
        async (payload) => {
          if (!mountedRef.current) return;

          setIsLoading(true);
          try {
            // Re-fetch all published courses to get updated data
            const { data: updatedCourses } = await supabase
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
              .order('created_at', { ascending: false })
              .limit(24);

            if (updatedCourses && mountedRef.current) {
              // Transform courses similar to server action
              const { formatDuration } = await import('@/lib/admin-courses');

              const transformedCourses = updatedCourses.map((course: any) => {
                let duration = course.duration || '';
                if (course.modules && Array.isArray(course.modules)) {
                  const totalSeconds = course.modules.reduce((sum: number, m: any) => {
                    const lessonSeconds = (m.lessons ?? []).reduce(
                      (lessonSum: number, lesson: any) =>
                        lessonSum + (lesson.duration_seconds || 0),
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
                  created_at: course.created_at,
                  description: course.description ?? null,
                };
              });

              // Sort by reputation: rating desc, reviews_count desc, created_at desc
              const sortedByReputation = [...transformedCourses].sort((a, b) => {
                if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
                if ((b.reviews_count || 0) !== (a.reviews_count || 0))
                  return (b.reviews_count || 0) - (a.reviews_count || 0);
                return (
                  new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
                );
              });

              // Hero course: highest reputation
              const heroCourse = sortedByReputation[0] ?? null;

              // Trending: top 8 by reputation
              const trendingCourses = sortedByReputation.slice(0, 8);

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
                .sort(
                  (a, b) =>
                    new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
                )
                .slice(0, 8);

              setData({
                heroCourse: heroCourse,
                trendingCourses,
                lightingCourses,
                recentCourses,
                instructors: data.instructors, // Keep current instructors
              });
            }
          } catch (error) {
            console.error('[LandingProvider] Error updating courses:', error);
          } finally {
            if (mountedRef.current) setIsLoading(false);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'instructors',
        },
        async (payload) => {
          if (!mountedRef.current) return;

          try {
            const { data: updatedInstructors } = await supabase
              .from('instructors')
              .select('*')
              .order('name', { ascending: true });

            if (updatedInstructors && mountedRef.current) {
              setData((prev) => ({
                ...prev,
                instructors: updatedInstructors as LandingInstructor[],
              }));
            }
          } catch (error) {
            console.error('[LandingProvider] Error updating instructors:', error);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return <LandingContext.Provider value={{ data, isLoading }}>{children}</LandingContext.Provider>;
}

export function useLandingData() {
  const context = useContext(LandingContext);
  if (!context) {
    throw new Error('useLandingData must be used within a LandingProvider');
  }
  return context;
}
