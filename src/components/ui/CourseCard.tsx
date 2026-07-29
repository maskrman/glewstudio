'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

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