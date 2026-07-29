import React from 'react';
import LandingHero from './components/LandingHero';
import LandingPlans from './components/LandingPlans';
import LandingCategories from './components/LandingCategories';
import LandingInstructors from './components/LandingInstructors';
import LandingTestimonials from './components/LandingTestimonials';
import LandingFooter from './components/LandingFooter';
import LandingTopbar from './components/LandingTopbar';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <LandingTopbar />
      <LandingHero />
      <LandingCategories />
      <LandingPlans />
      <LandingInstructors />
      <LandingTestimonials />
      <LandingFooter />
    </div>
  );
}