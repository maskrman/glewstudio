import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import CoursesScreen from './components/CoursesScreen';
import { getPublishedCourses, getCategories } from '@/app/actions/courses';
import type { PublicCourse } from '@/app/actions/courses';

export default async function CoursesPage() {
  const [coursesData, categoriesData] = await Promise.all([getPublishedCourses(), getCategories()]);

  // Transform categories to match expected type
  const categories: {
    id: string;
    name: string;
    slug: string;
    cover_image: string | null;
    cover_image_alt: string | null;
    icon: string;
    color: string;
    sort_order: number;
  }[] = categoriesData.map((c) => ({
    ...c,
    icon: c.icon ?? '',
    color: c.color ?? '',
  }));

  return (
    <AppLayout currentPath="/courses">
      <Suspense fallback={<div className="min-h-screen bg-background pt-20" />}>
        <CoursesScreen initialCourses={coursesData} initialCategories={categories} />
      </Suspense>
    </AppLayout>
  );
}
