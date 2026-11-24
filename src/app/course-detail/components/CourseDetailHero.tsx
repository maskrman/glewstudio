'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSubscriptionTier } from '@/lib/subscription';
import {
  canAccessCourse,
  calculateCoursePrice,
  TIER_LABELS,
  TIER_SHORT_LABELS,
  type SubscriptionTier,
} from '@/lib/config';
import { parseDuration } from '@/lib/admin-courses';

function getTierValue(
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma' | null
): SubscriptionTier {
  return (tier as SubscriptionTier) || 'apertura';
}

interface Instructor {
  id: string;
  name: string;
  specialty: string;
  tags: string[];
  bio: string | null;
  photo_url: string | null;
  photo_alt: string | null;
  created_at: string;
  updated_at: string;
}

interface CourseData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructor: string | Instructor;
  instructor_name: string;
  instructor_specialty: string;
  instructor_photo_url: string | null;
  instructor_photo_alt: string | null;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  rating: number;
  review_count: number;
  lesson_count: number;
  category_id: string | null;
  access_type: 'free' | 'membership' | 'premium_purchase';
  minimum_tier: SubscriptionTier | null;
  price: number | null;
  created_at: string;
  updated_at: string;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface CourseDetailHeroProps {
  course: CourseData;
  onScrollToReviews?: () => void;
}

export default function CourseDetailHero({ course, onScrollToReviews }: CourseDetailHeroProps) {
  const { user, loading: authLoading } = useAuth();
  const [userTier, setUserTier] = useState<SubscriptionTier>(null);
  const [tierLoading, setTierLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTierLoading(false);
      return;
    }
    getUserSubscriptionTier().then((tier) => {
      setUserTier(tier);
      setTierLoading(false);
    });
  }, [user, authLoading]);

  const isLoading = authLoading || tierLoading;
  const isAuthenticated = !!user;

  const hasAccess = canAccessCourse({
    accessType: course.access_type,
    minimumTier: getTierValue(course.minimum_tier),
    userTier,
    isAuthenticated,
    hasPurchased: false,
  });

  // Format duration - handle both numeric seconds and string formats
  const formattedDuration =
    typeof course.duration === 'string' && !/^\d+$/.test(course.duration.trim())
      ? course.duration
      : parseDuration(course.duration);

  const priceInfo = course.price ? calculateCoursePrice(course.price, userTier) : null;

  const handleReviewClick = () => {
    onScrollToReviews?.();
  };

  return (
    <section className="relative w-full pt-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <AppImage
          src={course.thumbnail || ''}
          alt={course.thumbnail_alt || course.title}
          fill
          priority
          className="object-cover object-center opacity-20"
          sizes="100vw"
        />

        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Inicio
          </Link>
          <Icon name="ChevronRightIcon" size={14} />
          <span className="hover:text-foreground transition-colors cursor-pointer">
            {course.category?.name || 'Sin categoría'}
          </span>
          <Icon name="ChevronRightIcon" size={14} />
          <span className="text-foreground">{course.title}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Left: info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <TierBadge tier={course.minimum_tier ?? 'free'} size="md" showIcon />
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-500">
                {course.category?.name || 'Sin categoría'}
              </span>

              {/* Access status badge - hide for free courses */}
              {!isLoading && course.access_type !== 'free' && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-500 flex items-center gap-1 ${
                    hasAccess ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon name={hasAccess ? 'CheckCircleIcon' : 'LockClosedIcon'} size={11} />
                  {hasAccess
                    ? 'Acceso incluido'
                    : course.access_type === 'membership' && course.minimum_tier
                      ? `Requiere ${TIER_LABELS[course.minimum_tier]}`
                      : 'Requiere compra'}
                </span>
              )}
            </div>

            <h1 className="text-3xl xl:text-4xl font-800 text-foreground mb-4 leading-tight">
              {course.title}
            </h1>

            <p className="text-muted-foreground text-base leading-relaxed mb-6 max-w-2xl line-clamp-3">
              {course.description || 'Este curso te enseñará técnicas profesionales de fotografía.'}
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-5 mb-6 text-sm">
              <div
                className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors"
                onClick={handleReviewClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleReviewClick()}
                aria-label={`Ver ${course.review_count} reseñas`}
              >
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Icon
                      key={`detail-star-${i}`}
                      name="StarIcon"
                      size={14}
                      className="text-primary"
                      variant="solid"
                    />
                  ))}
                </div>
                <span className="font-700 text-foreground">{course.rating.toFixed(1)}</span>
                <span className="text-muted-foreground underline">
                  ({course.review_count.toLocaleString()} reseñas)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="UsersIcon" size={14} />
                <span>{course.lesson_count} lecciones</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="ClockIcon" size={14} />
                <span>{formattedDuration} de contenido</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="CalendarIcon" size={14} />
                <span>
                  Actualizado{' '}
                  {new Date(course.updated_at).toLocaleDateString('es-ES', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Instructor */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative w-10 h-10 rounded-full overflow-hidden">
                <AppImage
                  src={course.instructor_photo_url || course.thumbnail || ''}
                  alt={course.instructor_photo_alt || course.instructor_name}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </div>
              <div>
                <p className="text-sm font-600 text-foreground">{course.instructor_name}</p>
                <p className="text-xs text-muted-foreground">
                  {course.instructor_specialty || 'Fotógrafo Comercial'}
                </p>
              </div>
            </div>

            {/* Access type badge & pricing */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* Access type indicator */}
              {course.access_type === 'free' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-xs font-600">
                  <Icon name="GiftIcon" size={12} />
                  Gratis
                </span>
              ) : course.access_type === 'membership' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-xs font-600">
                  <Icon name="ShieldIcon" size={12} />
                  Membresía{' '}
                  {course.minimum_tier ? TIER_SHORT_LABELS[course.minimum_tier] : 'Apertura'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-600">
                  <Icon name="GemIcon" size={12} />
                  Compra Premium
                </span>
              )}
            </div>

            {/* Pricing block for premium courses */}
            {priceInfo && course.access_type === 'premium_purchase' && (
              <div className="bg-card border border-border rounded-xl p-4 max-w-sm mb-4">
                <p className="text-xs text-muted-foreground mb-2 font-500">Precio del curso</p>
                {priceInfo.discountPct > 0 ? (
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-800 gradient-gold-text">
                      ${priceInfo.finalPrice}
                    </span>
                    <span className="text-muted-foreground line-through text-sm mb-1">
                      ${priceInfo.originalPrice}
                    </span>
                    <span className="text-primary text-xs font-700 bg-primary/10 px-2 py-0.5 rounded-full mb-1">
                      -{priceInfo.discountPct}% {userTier ? TIER_LABELS[userTier] : ''}
                    </span>
                  </div>
                ) : (
                  <span className="text-3xl font-800 gradient-gold-text">
                    ${priceInfo.originalPrice}
                  </span>
                )}
                {!isAuthenticated && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <Icon name="TagIcon" size={11} className="inline mr-1 text-primary" />
                    Los miembros obtienen hasta 30% de descuento
                  </p>
                )}
                {isAuthenticated && !userTier && (
                  <p className="text-xs text-muted-foreground mt-2">
                    <Icon name="TagIcon" size={11} className="inline mr-1 text-primary" />
                    Suscríbete para obtener hasta 30% de descuento
                  </p>
                )}
              </div>
            )}

            {/* Membership discount preview for premium courses */}
            {priceInfo && !hasAccess && course.access_type === 'premium_purchase' && (
              <div className="bg-muted/50 border border-border rounded-xl p-4 max-w-sm">
                <p className="text-xs font-600 text-foreground mb-3">Precio según membresía</p>
                <div className="flex flex-col gap-1.5">
                  {(['apertura', 'obturador', 'diafragma'] as const).map((tier) => {
                    const info = calculateCoursePrice(priceInfo.originalPrice, tier);
                    return (
                      <div key={tier} className="flex items-center justify-between text-xs">
                        <TierBadge tier={tier} size="sm" />
                        <span className="text-foreground font-600">${info.finalPrice}</span>
                        <span className="text-primary font-500">-{info.discountPct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: thumbnail */}
          <div className="hidden lg:block w-80 xl:w-96 shrink-0">
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl">
              <AppImage
                src={course.thumbnail || ''}
                alt={course.thumbnail_alt || course.title}
                fill
                className="object-cover"
                sizes="400px"
              />

              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                {isLoading ? (
                  <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : course.access_type === 'free' ? (
                  <Link href={`/video-player?course=${course.slug}`}>
                    <div className="w-16 h-16 rounded-full bg-green-500/90 flex items-center justify-center shadow-xl hover:bg-green-500 transition-colors">
                      <Icon name="PlayIcon" size={28} className="text-white ml-1" />
                    </div>
                  </Link>
                ) : hasAccess ? (
                  <Link href={`/video-player?course=${course.slug}`}>
                    <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-xl hover:bg-primary transition-colors">
                      <Icon name="PlayIcon" size={28} className="text-primary-foreground ml-1" />
                    </div>
                  </Link>
                ) : (
                  <div className="text-center px-4">
                    <div className="w-14 h-14 rounded-full bg-black/60 border border-white/20 flex items-center justify-center mx-auto mb-2">
                      <Icon name="LockClosedIcon" size={22} className="text-white/60" />
                    </div>
                    <p className="text-xs text-white/70 mb-3">
                      {isAuthenticated
                        ? course.access_type === 'membership' && course.minimum_tier
                          ? `Requiere Membresía ${TIER_SHORT_LABELS[course.minimum_tier]}`
                          : course.access_type === 'premium_purchase'
                            ? 'Requiere compra individual'
                            : 'Acceso no disponible'
                        : 'Inicia sesión para acceder'}
                    </p>
                    <Link
                      href={isAuthenticated ? '/account-subscription-management' : '/sign-up-login'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/80 text-primary-foreground text-xs font-600 rounded-lg hover:bg-primary transition-colors"
                    >
                      {isAuthenticated ? 'Actualizar Plan' : 'Iniciar Sesión'}
                    </Link>
                  </div>
                )}
              </div>
              {(hasAccess || course.access_type === 'free') && (
                <div className="absolute bottom-3 left-3 bg-black/70 text-xs text-white px-2 py-1 rounded font-500">
                  Vista previa — Lección 1
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
