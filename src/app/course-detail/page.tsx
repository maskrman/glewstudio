import React from 'react';
import AppLayout from '@/components/AppLayout';
import CourseDetailHero from './components/CourseDetailHero';
import CourseDetailBody from './components/CourseDetailBody';

export default function CourseDetailPage() {
  return (
    <AppLayout currentPath="/course-detail" fullWidth>
      <CourseDetailHero />
      <CourseDetailBody />
    </AppLayout>
  );
}