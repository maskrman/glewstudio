'use client';

import React from 'react';
import CourseCardSkeleton from './CourseCardSkeleton';

interface CourseCarouselSkeletonProps {
  count?: number;
}

export default function CourseCarouselSkeleton({ count = 5 }: CourseCarouselSkeletonProps) {
  return (
    <section className="relative">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4 px-6 lg:px-8 xl:px-10 2xl:px-16">
        <div className="h-5 bg-muted rounded w-48 animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
          <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        </div>
      </div>
      {/* Cards row */}
      <div className="flex gap-4 overflow-hidden px-6 lg:px-8 xl:px-10 2xl:px-16 pb-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={`skeleton-card-${i}`} className="shrink-0 w-64 xl:w-72">
            <CourseCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  );
}
