import React from 'react';
import { getLandingPageData, type LandingPageData } from '@/app/actions/landing';
import { LandingProvider } from './components/LandingContext';
import LandingHero from './components/LandingHero';
import LandingValueProps from './components/LandingValueProps';
import LandingCategories from './components/LandingCategories';
import LandingPlans from './components/LandingPlans';
import LandingHowItWorks from './components/LandingHowItWorks';
import LandingInstructors from './components/LandingInstructors';
import LandingFooter from './components/LandingFooter';
import LandingTopbar from './components/LandingTopbar';

export default async function LandingPage() {
  const data: LandingPageData = await getLandingPageData();

  return (
    <LandingProvider initialData={data}>
      <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
        <LandingTopbar />
        <LandingHero />
        <LandingValueProps />
        <LandingCategories />
        <LandingPlans />
        <LandingHowItWorks />
        <LandingInstructors />
        <LandingFooter />
      </div>
    </LandingProvider>
  );
}
