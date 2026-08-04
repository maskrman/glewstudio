'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from './TierBadge';
import { addToWatchlist, removeFromWatchlist } from '@/lib/watchlist';
import { createClient } from '@/lib/supabase/client';

interface CourseCardProps {
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
  initialInWatchlist?: boolean;
}

export default function CourseCard({
  id,
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
  const [hovered, setHovered] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist);
  const [watchlistLoading, setWatchlistLoading] = useState(false);

  // Check watchlist status on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('watchlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setInWatchlist(true);
        });
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
    <Link href="/course-detail" className="block">
      <div
        className="relative rounded-xl overflow-hidden bg-card card-hover-lift cursor-pointer group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden bg-muted">
          <AppImage
            src={thumbnail}
            alt={thumbnailAlt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 288px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-600 px-1.5 py-0.5 rounded">
            {duration}
          </div>
          {/* Live badge */}
          {isLive && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 text-white text-xs font-700 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              EN VIVO
            </div>
          )}
          {/* Lock overlay */}
          {isLocked && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Icon name="LockClosedIcon" size={24} className="text-white/80" />
            </div>
          )}
          {/* Watchlist button — visible on hover */}
          <button
            onClick={handleWatchlistToggle}
            disabled={watchlistLoading}
            className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
              hovered || inWatchlist ? 'opacity-100' : 'opacity-0'
            } ${inWatchlist ? 'bg-primary text-primary-foreground' : 'bg-black/60 text-white hover:bg-black/80'}`}
            aria-label={inWatchlist ? 'Quitar de mi lista' : 'Añadir a mi lista'}
          >
            {watchlistLoading ? (
              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            ) : inWatchlist ? (
              <Icon name="CheckIcon" size={13} />
            ) : (
              <Icon name="PlusIcon" size={13} />
            )}
          </button>
        </div>

        {/* Info */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-600 text-foreground line-clamp-2 leading-snug">{title}</h3>
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

          {/* Progress bar */}
          {progress !== undefined && progress > 0 && (
            <div className="mt-2">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full progress-bar rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{progress}% completado</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}