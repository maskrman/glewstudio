import React from 'react';
import { getDashboardData, getFeaturedCourses, getPublishedCourses } from '@/app/actions/courses';
import AppLayout from '@/components/AppLayout';
import DashboardHero from './components/DashboardHero';
import DashboardCarousels from './components/DashboardCarousels';

export default async function DashboardPage() {
  // Fetch data with error handling and fallbacks
  let dashboardData: Awaited<ReturnType<typeof getDashboardData>>;
  let featuredCourses: Awaited<ReturnType<typeof getFeaturedCourses>>;
  let fallbackCourses: Awaited<ReturnType<typeof getPublishedCourses>> = [];

  try {
    [dashboardData, featuredCourses] = await Promise.all([
      getDashboardData(null),
      getFeaturedCourses(),
    ]);
  } catch {
    // If both fail, initialize with empty defaults
    dashboardData = {
      heroCourse: null,
      continueWatching: [],
      recommended: [],
      recentCourses: [],
      stats: { totalCourses: 0, completedCourses: 0, totalHours: 0 },
    };
    featuredCourses = [];
  }

  // If featured courses is empty, try to get at least one published course as fallback
  if (featuredCourses.length === 0) {
    try {
      fallbackCourses = await getPublishedCourses();
    } catch {
      fallbackCourses = [];
    }
  }

  // Build the final featured courses array with robust fallback chain
  const finalFeaturedCourses =
    featuredCourses.length > 0
      ? featuredCourses
      : dashboardData.continueWatching.length > 0
        ? dashboardData.continueWatching
        : dashboardData.recommended.length > 0
          ? dashboardData.recommended
          : dashboardData.recentCourses.length > 0
            ? dashboardData.recentCourses
            : fallbackCourses.slice(0, 5);

  // Ensure we always have at least one course for the hero
  const heroCourse =
    finalFeaturedCourses[0] ?? dashboardData.heroCourse ?? fallbackCourses[0] ?? null;

  return (
    <AppLayout currentPath="/dashboard" fullWidth>
      <DashboardHero
        featuredCourses={finalFeaturedCourses}
        continueWatching={dashboardData.continueWatching}
        heroCourse={heroCourse}
      />
      <div className="pb-16">
        <DashboardCarousels />
      </div>
    </AppLayout>
  );
}
