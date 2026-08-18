'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserSubscriptionTier,
  type SubscriptionTier,
} from '@/lib/subscription';
import { canAccessCourse, calculateCoursePrice, TIER_LABELS,  } from '@/lib/config';

interface CourseDetailHeroProps {
  courseSlug?: string;
}

// Demo course data — in production this would come from Supabase
const DEMO_COURSE = {
  id: 'iluminacion-rembrandt-retrato',
  title: 'Iluminación Rembrandt para Retrato Profesional',
  instructor: 'Carlos Mendoza',
  instructorTitle: 'Fotógrafo Comercial · Ciudad de México',
  thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1d731ee8d-1779952599495.png',
  thumbnailAlt: 'Course preview thumbnail showing Rembrandt lighting triangle on portrait subject',
  backgroundImage: 'https://img.rocket.new/generatedImages/rocket_gen_img_15bc46116-1786109313129.png',
  backgroundAlt: 'Professional studio with Rembrandt lighting setup showing dramatic shadows and warm key light',
  instructorAvatar: 'https://img.rocket.new/generatedImages/rocket_gen_img_198563160-1772096672056.png',
  instructorAvatarAlt: 'Carlos Mendoza photography instructor portrait',
  rating: 4.9,
  reviewCount: 1248,
  studentCount: 3840,
  duration: '8h 32min',
  lessonCount: 12,
  updatedAt: 'julio 2026',
  category: 'Iluminación de Estudio',
  level: 'Nivel Intermedio',
  accessType: 'membership' as const,
  minimumTier: 'obturador' as SubscriptionTier,
  price: null as number | null,
};

export default function CourseDetailHero({ courseSlug }: CourseDetailHeroProps) {
  const { user, loading: authLoading } = useAuth();
  const [userTier, setUserTier] = useState<SubscriptionTier>(null);
  const [tierLoading, setTierLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setTierLoading(false); return; }
    getUserSubscriptionTier().then((tier) => {
      setUserTier(tier);
      setTierLoading(false);
    });
  }, [user, authLoading]);

  const isLoading = authLoading || tierLoading;
  const isAuthenticated = !!user;

  const hasAccess = canAccessCourse({
    accessType: DEMO_COURSE.accessType,
    minimumTier: DEMO_COURSE.minimumTier,
    userTier,
    isAuthenticated,
    hasPurchased: false,
  });

  const priceInfo = DEMO_COURSE.price
    ? calculateCoursePrice(DEMO_COURSE.price, userTier)
    : null;

  return (
    <section className="relative w-full pt-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <AppImage
          src={DEMO_COURSE.backgroundImage}
          alt={DEMO_COURSE.backgroundAlt}
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
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Inicio</Link>
          <Icon name="ChevronRightIcon" size={14} />
          <span className="hover:text-foreground transition-colors cursor-pointer">{DEMO_COURSE.category}</span>
          <Icon name="ChevronRightIcon" size={14} />
          <span className="text-foreground">{DEMO_COURSE.title}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Left: info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <TierBadge tier={DEMO_COURSE.minimumTier ?? 'free'} size="md" showIcon />
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-500">
                {DEMO_COURSE.category}
              </span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-500">
                {DEMO_COURSE.level}
              </span>

              {/* Access status badge */}
              {!isLoading && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-500 flex items-center gap-1 ${
                  hasAccess ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  <Icon name={hasAccess ? 'CheckCircleIcon' : 'LockClosedIcon'} size={11} />
                  {hasAccess
                    ? 'Acceso incluido'
                    : DEMO_COURSE.accessType === 'membership' && DEMO_COURSE.minimumTier
                    ? `Requiere ${TIER_LABELS[DEMO_COURSE.minimumTier]}`
                    : 'Requiere compra'}
                </span>
              )}
            </div>

            <h1 className="text-3xl xl:text-4xl font-800 text-foreground mb-4 leading-tight">
              {DEMO_COURSE.title}
            </h1>

            <p className="text-muted-foreground text-base leading-relaxed mb-6 max-w-2xl">
              Domina una de las técnicas de iluminación más buscadas en la fotografía de retrato. Aprende a crear el triángulo de luz característico, controlar sombras y adaptar el esquema a diferentes tipos de rostro y situaciones de estudio.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-5 mb-6 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Icon key={`detail-star-${i}`} name="StarIcon" size={14} className="text-primary" variant="solid" />
                  ))}
                </div>
                <span className="font-700 text-foreground">{DEMO_COURSE.rating}</span>
                <span className="text-muted-foreground">({DEMO_COURSE.reviewCount.toLocaleString()} reseñas)</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="UsersIcon" size={14} />
                <span>{DEMO_COURSE.studentCount.toLocaleString()} estudiantes</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="ClockIcon" size={14} />
                <span>{DEMO_COURSE.duration} de contenido</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="CalendarIcon" size={14} />
                <span>Actualizado {DEMO_COURSE.updatedAt}</span>
              </div>
            </div>

            {/* Instructor */}
            <div className="flex items-center gap-3 mb-6">
              <div className="relative w-10 h-10 rounded-full overflow-hidden">
                <AppImage
                  src={DEMO_COURSE.instructorAvatar}
                  alt={DEMO_COURSE.instructorAvatarAlt}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </div>
              <div>
                <p className="text-sm font-600 text-foreground">{DEMO_COURSE.instructor}</p>
                <p className="text-xs text-muted-foreground">{DEMO_COURSE.instructorTitle}</p>
              </div>
            </div>

            {/* Pricing block for premium courses */}
            {priceInfo && (
              <div className="bg-card border border-border rounded-xl p-4 max-w-sm mb-4">
                <p className="text-xs text-muted-foreground mb-2 font-500">Precio del curso</p>
                {priceInfo.discountPct > 0 ? (
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-800 gradient-gold-text">${priceInfo.finalPrice}</span>
                    <span className="text-muted-foreground line-through text-sm mb-1">${priceInfo.originalPrice}</span>
                    <span className="text-primary text-xs font-700 bg-primary/10 px-2 py-0.5 rounded-full mb-1">
                      -{priceInfo.discountPct}% {userTier ? TIER_LABELS[userTier] : ''}
                    </span>
                  </div>
                ) : (
                  <span className="text-3xl font-800 gradient-gold-text">${priceInfo.originalPrice}</span>
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
            {priceInfo && !hasAccess && (
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
                src={DEMO_COURSE.thumbnail}
                alt={DEMO_COURSE.thumbnailAlt}
                fill
                className="object-cover"
                sizes="400px"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                {isLoading ? (
                  <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : hasAccess ? (
                  <Link href="/video-player">
                    <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-xl hover:bg-primary transition-colors">
                      <Icon name="PlayIcon" size={28} className="text-primary-foreground ml-1" />
                    </div>
                  </Link>
                ) : (
                  <div className="text-center px-4">
                    <div className="w-14 h-14 rounded-full bg-black/60 border border-white/20 flex items-center justify-center mx-auto mb-2">
                      <Icon name="LockClosedIcon" size={22} className="text-white/60" />
                    </div>
                    <p className="text-xs text-white/70">
                      {isAuthenticated
                        ? DEMO_COURSE.accessType === 'membership' && DEMO_COURSE.minimumTier
                          ? `Requiere ${TIER_LABELS[DEMO_COURSE.minimumTier]}`
                          : 'Requiere compra individual' :'Inicia sesión para acceder'}
                    </p>
                  </div>
                )}
              </div>
              {hasAccess && (
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