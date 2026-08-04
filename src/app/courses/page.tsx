import React from 'react';
import AppLayout from '@/components/AppLayout';
import CoursesScreen from './components/CoursesScreen';

export default function CoursesPage() {
  return (
    <AppLayout currentPath="/courses">
      <CoursesScreen />
    </AppLayout>
  );
}
