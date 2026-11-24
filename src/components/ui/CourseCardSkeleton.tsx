'use client';

import React from 'react';

export default function CourseCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-card animate-pulse">
      {/* Thumbnail */}
      <div className="aspect-video bg-muted" />
      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="h-3.5 bg-muted rounded w-4/5" />
        <div className="h-3.5 bg-muted rounded w-3/5" />
        <div className="h-3 bg-muted rounded w-2/5 mt-1" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-3 bg-muted rounded w-1/4" />
          <div className="h-5 bg-muted rounded-full w-16" />
        </div>
      </div>
    </div>
  );
}
