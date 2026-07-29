'use client';

import React, { useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import CourseCard from './CourseCard';

interface CarouselCourse {
  id: string;
  title: string;
  instructor: string;
  thumbnail: string;
  thumbnailAlt: string;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  progress?: number;
  isLive?: boolean;
  isLocked?: boolean;
  lessonCount?: number;
  rating?: number;
}

interface CourseCarouselProps {
  title: string;
  courses: CarouselCourse[];
  badgeLabel?: string;
  badgeColor?: string;
}

export default function CourseCarousel({
  title,
  courses,
  badgeLabel,
  badgeColor = 'bg-primary text-primary-foreground',
}: CourseCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 320;
    scrollRef.current.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' });
  };

  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-4 px-6 lg:px-8 xl:px-10 2xl:px-16">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-700 text-foreground">{title}</h2>
          {badgeLabel && (
            <span className={`text-xs font-700 px-2 py-0.5 rounded-full ${badgeColor}`}>
              {badgeLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Desplazar izquierda"
          >
            <Icon name="ChevronLeftIcon" size={16} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Desplazar derecha"
          >
            <Icon name="ChevronRightIcon" size={16} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-6 lg:px-8 xl:px-10 2xl:px-16 pb-2"
      >
        {courses.map((course) => (
          <div key={`carousel-${course.id}`} className="shrink-0 w-64 xl:w-72">
            <CourseCard {...course} />
          </div>
        ))}
      </div>
    </section>
  );
}