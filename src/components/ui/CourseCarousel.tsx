'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, useDragControls, useMotionValue, useSpring } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import CourseCard from './CourseCard';

interface CarouselCourse {
  id: string;
  slug?: string;
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
  const [isDragging, setIsDragging] = useState(false);
  const dragControls = useDragControls();
  const scrollX = useMotionValue(0);
  const scrollXSpring = useSpring(scrollX, { stiffness: 100, damping: 30 });

  // Sync scroll position with motion value for momentum
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const onScroll = () => {
      scrollX.set(element.scrollLeft);
    };

    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, [scrollX]);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = Math.round(scrollRef.current.clientWidth * 0.8);
    const target =
      dir === 'right'
        ? scrollRef.current.scrollLeft + amount
        : scrollRef.current.scrollLeft - amount;
    scrollRef.current.scrollTo({ left: target, behavior: 'smooth' });
  };

  const handleDragStart = () => setIsDragging(true);
  const handleDragEnd = () => setIsDragging(false);

  // Keyboard navigation for TV/console
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!scrollRef.current) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scroll('right');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scroll('left');
    }
  };

  return (
    <section
      className="group/carousel relative"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={title}
    >
      <div className="flex items-center justify-between mb-4 px-6 lg:px-8 xl:px-10 2xl:px-16">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-700 text-foreground">{title}</h2>
          {badgeLabel && (
            <span className={`text-xs font-700 px-2 py-0.5 rounded-full ${badgeColor}`}>
              {badgeLabel}
            </span>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-6 lg:px-8 xl:px-10 2xl:px-16 pb-2"
        style={{ touchAction: 'pan-x' }}
        onKeyDown={handleKeyDown}
      >
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragMomentum={true}
          dragElastic={0.15}
          dragSnapToOrigin={false}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          style={{
            display: 'flex',
            gap: '1rem',
            width: 'max-content',
            willChange: 'transform',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          className="pb-2"
        >
          {courses.map((course, index) => (
            <div key={`carousel-${course.id}-${index}`} className="shrink-0 w-64 xl:w-72">
              <CourseCard {...course} />
            </div>
          ))}
        </motion.div>
      </div>

      <motion.button
        onClick={() => scroll('left')}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        className="absolute left-2 top-[58%] z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/65 text-foreground opacity-100 shadow-xl backdrop-blur-md transition-opacity focus-ring md:opacity-0 md:group-hover/carousel:opacity-100 md:group-focus-within/carousel:opacity-100"
        aria-label={`Desplazar ${title} a la izquierda`}
      >
        <Icon name="ChevronLeftIcon" size={18} />
      </motion.button>
      <motion.button
        onClick={() => scroll('right')}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        className="absolute right-2 top-[58%] z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/65 text-foreground opacity-100 shadow-xl backdrop-blur-md transition-opacity focus-ring md:opacity-0 md:group-hover/carousel:opacity-100 md:group-focus-within/carousel:opacity-100"
        aria-label={`Desplazar ${title} a la derecha`}
      >
        <Icon name="ChevronRightIcon" size={18} />
      </motion.button>
    </section>
  );
}
