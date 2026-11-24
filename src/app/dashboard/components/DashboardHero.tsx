'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '@/lib/watchlist';
import { toast } from 'sonner';

interface DashboardCourse {
  id: string;
  slug: string;
  title: string;
  instructor: string;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  rating: number;
  lesson_count: number;
  progress?: number;
}

interface DashboardHeroProps {
  featuredCourses: DashboardCourse[];
  continueWatching: DashboardCourse[];
  heroCourse: DashboardCourse | null;
}

const TRANSITION_DURATION = 0.7;
const CARD_WIDTH = 280;
const STACK_SPACING = 16;
const STACK_SCALE_STEP = 0.08;
const PREVIEW_CARD_WIDTH = 220;

export default function DashboardHero({
  featuredCourses: propsFeaturedCourses,
  continueWatching,
  heroCourse,
}: DashboardHeroProps) {
  const [inList, setInList] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Build final featured courses array with robust fallback chain
  const featuredCourses =
    propsFeaturedCourses.length > 0
      ? propsFeaturedCourses
      : continueWatching.length > 0
        ? continueWatching
        : heroCourse
          ? [heroCourse]
          : [];

  const totalCourses = featuredCourses.length;
  const currentHero = featuredCourses[activeIndex];
  const nextCourse = totalCourses > 1 ? featuredCourses[(activeIndex + 1) % totalCourses] : null;

  // Watchlist check
  useEffect(() => {
    if (currentHero) {
      isInWatchlist(currentHero.id ?? '')
        .then((inList) => {
          if (inList) setInList(true);
        })
        .catch(() => {
          // Silently fail - watchlist check is not critical
        });
    }
  }, [currentHero]);

  const handleListToggle = async () => {
    if (!currentHero) return;
    setListLoading(true);
    try {
      if (inList) {
        await removeFromWatchlist(currentHero.id ?? '');
        setInList(false);
        toast.success('Eliminado de Mi Lista');
      } else {
        await addToWatchlist({
          courseId: currentHero.id ?? '',
          courseTitle: currentHero.title ?? '',
          courseInstructor: currentHero.instructor ?? '',
          courseThumbnail: currentHero.thumbnail ?? '',
          courseThumbnailAlt: currentHero.thumbnail_alt ?? '',
          courseDuration: currentHero.duration ?? '',
          courseTier: currentHero.tier ?? 'diafragma',
          courseRating: currentHero.rating,
          courseLessonCount: currentHero.lesson_count,
        });
        setInList(true);
        toast.success('Añadido a Mi Lista');
      }
    } catch (error) {
      toast.error(
        error instanceof Error && error.message === 'Not authenticated'
          ? 'Inicia sesión para guardar cursos en Mi Lista.'
          : 'No se pudo actualizar Mi Lista. Inténtalo de nuevo.'
      );
    } finally {
      setListLoading(false);
    }
  };

  const navigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (isTransitioning || totalCourses <= 1) return;
      setIsTransitioning(true);
      if (direction === 'next') {
        setActiveIndex((prev) => (prev + 1) % totalCourses);
      } else {
        setActiveIndex((prev) => (prev - 1 + totalCourses) % totalCourses);
      }
      setTimeout(() => setIsTransitioning(false), TRANSITION_DURATION * 1000);
    },
    [totalCourses]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navigate('prev');
      if (e.key === 'ArrowRight') navigate('next');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Auto-rotate carousel
  useEffect(() => {
    if (totalCourses <= 1) return;
    const interval = setInterval(() => {
      if (!isTransitioning) {
        navigate('next');
      }
    }, 7000);
    return () => clearInterval(interval);
  }, [totalCourses, isTransitioning, navigate]);

  // Render empty state if no courses
  if (!currentHero || featuredCourses.length === 0) {
    return (
      <section className="relative w-full min-h-[80vh] lg:min-h-[85vh] overflow-hidden py-12 lg:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/90">
          <div className="gradient-dark-overlay absolute inset-0" />
        </div>
        <div className="relative z-10 h-full flex items-center justify-center max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
          <div className="max-w-3xl text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <TierBadge tier="diafragma" size="md" showIcon />
              <span className="text-xs text-muted-foreground font-500">
                Curso Destacado del Mes
              </span>
            </div>
            <h1 className="text-hero-lg font-800 text-foreground mb-4 leading-tight">
              No hay cursos disponibles
            </h1>
            <div className="flex items-center justify-center gap-4 mb-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Icon name="StarIcon" size={14} className="text-primary" variant="solid" />
                <span className="font-600 text-foreground">—</span>
              </div>
              <span>—</span>
              <span>—</span>
              <span>—</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full min-h-[80vh] lg:min-h-[85vh] overflow-hidden py-12 lg:py-20">
      {/* Full-width Cinematic Background */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentHero.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: TRANSITION_DURATION, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <AppImage
              src={
                currentHero.thumbnail && currentHero.thumbnail.trim() !== ''
                  ? currentHero.thumbnail
                  : ''
              }
              alt={currentHero.thumbnail_alt ?? currentHero.title}
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
            />
            {/* Uniform dark cinematic gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/90" />
            {/* Vignette */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 h-full max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 w-full">
        {/* RIGHT COLUMN: Single Next Course Preview Card */}
        <div className="flex justify-end pt-6 lg:pt-8">
          <div className="relative w-full max-w-[420px]">
            {/* Next Course Preview Card - Main card on the right */}
            {totalCourses > 1 && nextCourse && (
              <motion.div
                key={nextCourse.id}
                className="relative w-full max-w-[420px]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                exit={{ opacity: 0, y: -20 }}
              >
                <button
                  onClick={() =>
                    !isTransitioning && setActiveIndex((activeIndex + 1) % totalCourses)
                  }
                  disabled={isTransitioning}
                  className="relative w-full cursor-pointer group"
                  style={{ pointerEvents: isTransitioning ? 'none' : 'auto' }}
                  aria-label={`Ver siguiente curso: ${nextCourse.title}`}
                >
                  <div className="relative aspect-video md:aspect-[16/9] lg:aspect-[4/3] rounded-xl overflow-hidden shadow-xl bg-black/40 transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]">
                    <AppImage
                      src={
                        nextCourse.thumbnail && nextCourse.thumbnail.trim() !== ''
                          ? nextCourse.thumbnail
                          : ''
                      }
                      alt={nextCourse.thumbnail_alt ?? nextCourse.title}
                      fill
                      className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
                      sizes={`${PREVIEW_CARD_WIDTH}px`}
                    />
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    {/* Tier badge */}
                    <div className="absolute top-3 left-3 z-10">
                      <TierBadge tier={nextCourse.tier} size="sm" showIcon />
                    </div>
                    {/* "Próximo" label */}
                    <div className="absolute top-3 right-3 z-10">
                      <span className="text-[10px] uppercase tracking-widest font-600 text-white/90 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10">
                        Próximo
                      </span>
                    </div>
                    {/* Course info overlay at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                      <h3 className="text-sm md:text-base font-700 text-white truncate group-hover:text-primary transition-colors">
                        {nextCourse.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-2 text-xs md:text-sm text-white/70">
                        <Icon name="UserIcon" size={14} className="w-3.5 h-3.5" />
                        <span className="truncate">{nextCourse.instructor}</span>
                        <span className="hidden sm:inline">·</span>
                        <Icon name="ClockIcon" size={14} className="hidden sm:inline w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{nextCourse.duration}</span>
                      </div>
                    </div>
                    {/* Click hint */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center px-3 py-2 bg-black/70 backdrop-blur-sm rounded-lg"
                      >
                        <Icon name="ChevronRightIcon" size={18} className="text-primary mb-1" />
                        <span className="text-xs font-600 text-white">Ver curso</span>
                      </motion.div>
                    </div>
                  </div>
                </button>

                {/* Navigation Arrows - positioned relative to the preview card */}
                <div className="absolute left-0 right-0 bottom-[55px] -translate-y-1/2 px-2 pointer-events-none">
                  <div className="flex justify-between pointer-events-auto">
                    <motion.button
                      onClick={() => navigate('prev')}
                      disabled={isTransitioning}
                      className="w-10 h-10 rounded-full border border-white/10 bg-black/60 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                      aria-label="Curso anterior"
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Icon name="ChevronLeftIcon" size={20} />
                    </motion.button>
                    <motion.button
                      onClick={() => navigate('next')}
                      disabled={isTransitioning}
                      className="w-10 h-10 rounded-full border border-white/10 bg-black/60 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                      aria-label="Siguiente curso"
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Icon name="ChevronRightIcon" size={20} />
                    </motion.button>
                  </div>
                </div>

                {/* Dot Indicators - positioned relative to the preview card */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                  {featuredCourses.map((_, index) => (
                    <motion.button
                      key={index}
                      onClick={() => !isTransitioning && setActiveIndex(index)}
                      disabled={isTransitioning}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === activeIndex ? 'bg-primary w-5' : 'bg-white/30 hover:bg-white/50'
                      }`}
                      whileHover={{ scale: 1.4 }}
                      aria-label={`Ir a curso ${index + 1}`}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Single course fallback - show current course when only 1 course */}
            {totalCourses === 1 && currentHero && (
              <motion.div
                key={currentHero.id}
                className="relative w-full max-w-[420px]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <div className="relative aspect-video md:aspect-[16/9] lg:aspect-[4/3] rounded-xl overflow-hidden shadow-xl bg-black/40">
                  <AppImage
                    src={
                      currentHero.thumbnail && currentHero.thumbnail.trim() !== ''
                        ? currentHero.thumbnail
                        : ''
                    }
                    alt={currentHero.thumbnail_alt ?? currentHero.title}
                    fill
                    className="object-cover object-center"
                    sizes={`${PREVIEW_CARD_WIDTH}px`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <div className="absolute top-3 left-3 z-10">
                    <TierBadge tier={currentHero.tier} size="sm" showIcon />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                    <h3 className="text-sm md:text-base font-700 text-white truncate">
                      {currentHero.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 text-xs md:text-sm text-white/70">
                      <Icon name="UserIcon" size={14} className="w-3.5 h-3.5" />
                      <span className="truncate">{currentHero.instructor}</span>
                      <span className="hidden sm:inline">·</span>
                      <Icon name="ClockIcon" size={14} className="hidden sm:inline w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{currentHero.duration}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* LEFT COLUMN: Course Info anchored bottom-left */}
        <div className="flex justify-start pb-8 lg:pb-10">
          <div className="relative w-full max-w-[640px] lg:max-w-[720px]">
            {/* Category Tag & Tier Badge */}
            <motion.div
              className="flex items-center gap-3 mb-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <span className="text-[10px] uppercase tracking-widest text-primary/90 font-600 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full border border-primary/20">
                Curso Destacado del Mes
              </span>
              <TierBadge tier={currentHero.tier} size="md" showIcon />
            </motion.div>

            {/* Course Title */}
            <AnimatePresence mode="wait">
              <motion.h1
                key={currentHero.id}
                className="text-hero-md lg:text-hero-lg font-800 text-foreground mb-3 leading-tight max-w-[600px]"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {currentHero.title}
              </motion.h1>
            </AnimatePresence>

            {/* Meta Info */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentHero.id}
                className="flex flex-wrap items-center gap-4 mb-3 text-xs text-muted-foreground"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
              >
                <div className="flex items-center gap-1">
                  <Icon name="StarIcon" size={14} className="text-primary" variant="solid" />
                  <span className="font-600 text-foreground">{currentHero.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">/5</span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="BookOpenIcon" size={14} />
                  <span>{currentHero.lesson_count} lecciones</span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="ClockIcon" size={14} />
                  <span>{currentHero.duration}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="UserIcon" size={14} />
                  <span>{currentHero.instructor}</span>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Description */}
            <AnimatePresence mode="wait">
              <motion.p
                key={currentHero.id}
                className="text-base text-muted-foreground/90 leading-relaxed mb-5 max-w-[520px]"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
              >
                Aprende con{' '}
                <span className="text-foreground font-600">{currentHero.instructor}</span> en este
                curso completo de {currentHero.lesson_count} lecciones.
              </motion.p>
            </AnimatePresence>

            {/* Action Buttons */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentHero.id}
                className="flex flex-wrap items-center gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, delay: 0.3, ease: 'easeOut' }}
              >
                <Link
                  href={`/video-player?course=${currentHero.slug}`}
                  className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-700 text-primary-foreground shadow-xl shadow-primary/25 transition-all hover:shadow-primary/40 hover:scale-[1.02] focus-ring"
                >
                  <Icon name="PlayIcon" size={18} />
                  <span>
                    {continueWatching.length > 0 && currentHero.progress
                      ? `Continuar (${currentHero.progress}%)`
                      : 'Ver Ahora'}
                  </span>
                </Link>
                <button
                  onClick={handleListToggle}
                  disabled={listLoading}
                  aria-pressed={inList}
                  className={`inline-flex items-center gap-1.5 rounded-xl border bg-black/40 px-5 py-3 text-sm font-600 text-foreground backdrop-blur-md transition-all hover:bg-black/60 focus-ring disabled:cursor-wait disabled:opacity-60 ${
                    inList
                      ? 'border-primary/50 text-primary bg-primary/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {listLoading ? (
                    <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
                  ) : inList ? (
                    <Icon name="CheckIcon" size={18} className="text-primary" />
                  ) : (
                    <Icon name="PlusIcon" size={18} />
                  )}
                  {inList ? 'En Mi Lista' : 'Añadir a Mi Lista'}
                </button>
                <Link
                  href={`/course-detail?course=${currentHero.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-5 py-3 text-sm font-600 text-foreground backdrop-blur-md transition-all hover:border-white/20 hover:bg-black/60 focus-ring"
                >
                  <Icon name="InformationCircleIcon" size={18} />
                  Más Info
                </Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
