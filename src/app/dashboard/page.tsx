import React from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardHero from './components/DashboardHero';
import DashboardCarousels from './components/DashboardCarousels';

export default function DashboardPage() {
  return (
    <AppLayout currentPath="/dashboard" fullWidth>
      <DashboardHero />
      <div className="pb-16">
        <DashboardCarousels />
      </div>
    </AppLayout>
  );
}