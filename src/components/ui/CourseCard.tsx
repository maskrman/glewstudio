'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from './TierBadge';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '@/lib/watchlist';

interface CourseCardProps {
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
  initialInWatchlist?: boolean;
}

export default function CourseCard({
  id,
  slug,
  title,
  instructor,
  thumbnail,
  thumbnailAlt,
  duration,
  tier,
  progress,
  isLive = false,
  isLocked = false,
  lessonCount,
  rating,
  initialInWatchlist = false,
}: CourseCardProps) {
  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const progressPercent =
    progress === undefined || !Number.isFinite(progress) ? 0 : Math.min(100, Math.max(0, progress));

  const router = useRouter();

  const courseId = slug || id;

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!courseId) return;
    router.push(`/video-player?course=${courseId}`);
  };

  const handleDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!courseId) return;
    router.push(`/course-detail?course=${courseId}`);
  };

  // Check watchlist status on mount using the shared lib helper
  useEffect(() => {
    isInWatchlist(id).then((inList) => {
      if (inList) setInWatchlist(true);
    });
  }, [id]);

  const handleWatchlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWatchlistLoading(true);
    try {
      if (inWatchlist) {
        await removeFromWatchlist(id);
        setInWatchlist(false);
      } else {
        await addToWatchlist({
          courseId: id,
          courseTitle: title,
          courseInstructor: instructor,
          courseThumbnail: thumbnail,
          courseThumbnailAlt: thumbnailAlt,
          courseDuration: duration,
          courseTier: tier,
          courseRating: rating,
          courseLessonCount: lessonCount,
        });
        setInWatchlist(true);
      }
    } catch {
      // silently fail if not authenticated
    } finally {
      setWatchlistLoading(false);
    }
  };

  return (
    <motion.article
      layout
      className="relative overflow-hidden rounded-xl bg-card group"
      whileHover={{
        scale: 1.03,
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.55)',
        zIndex: 10,
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      style={{ willChange: 'transform, box-shadow' }}
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        <AppImage
          src={thumbnail && thumbnail.trim() !== '' ? thumbnail : ''}
          alt={thumbnailAlt}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 80vw, 288px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 bg-black/35 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
          role="group"
          aria-label={`Acciones para ${title}`}
        >
          <button
            onClick={handlePlay}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-700 text-background focus-ring"
            aria-label={`Reproducir ${title}`}
          >
            <Icon name="PlayIcon" size={14} />
            Reproducir
          </button>
          <button
            onClick={handleDetails}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/55 px-4 py-2 text-xs font-600 text-white backdrop-blur-md focus-ring"
            aria-label={`Detalles de ${title}`}
          >
            <Icon name="InformationCircleIcon" size={14} />
            Detalles
          </button>
        </div>
        <span className="absolute bottom-3 right-3 rounded-md bg-black/55 px-2 py-1 text-xs font-600 text-white backdrop-blur-sm">
          {duration}
        </span>
        {progressPercent > 0 && (
          <div
            role="progressbar"
            aria-label={`${title}: ${progressPercent}% completado`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-valuetext={`${progressPercent}% completado`}
            className="absolute inset-x-0 bottom-0 h-1 bg-white/35"
          >
            <div
              className="h-full bg-primary transition-[width] duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <Link
            href={`/course-detail?course=${courseId}`}
            className="text-sm font-600 leading-snug text-foreground line-clamp-2 hover:text-primary focus-ring"
            onClick={(e) => {
              if (!courseId) e.preventDefault();
            }}
          >
            {title}
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mb-2">{instructor}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {rating && (
              <div className="flex items-center gap-1">
                <Icon name="StarIcon" size={12} className="text-primary" />
                <span className="text-xs text-muted-foreground">{rating.toFixed(1)}</span>
              </div>
            )}
            {lessonCount && (
              <span className="text-xs text-muted-foreground">{lessonCount} lecciones</span>
            )}
          </div>
          <TierBadge tier={tier} size="sm" />
        </div>
      </div>
    </motion.article>
  );
}
