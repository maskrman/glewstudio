'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserSubscriptionTier,
  hasAccess,
  TIER_LABELS,
  type SubscriptionTier } from
'@/lib/subscription';

const COURSE_REQUIRED_TIER: SubscriptionTier = 'obturador';

export default function CourseDetailHero() {
  const { user, loading: authLoading } = useAuth();
  const [userTier, setUserTier] = useState<SubscriptionTier>(null);
  const [tierLoading, setTierLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {setTierLoading(false);return;}
    getUserSubscriptionTier().then((tier) => {
      setUserTier(tier);
      setTierLoading(false);
    });
  }, [user, authLoading]);

  const isLoading = authLoading || tierLoading;
  const canAccessCourse = hasAccess(userTier, COURSE_REQUIRED_TIER);
  const isAuthenticated = !!user;

  return (
    <section className="relative w-full pt-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <AppImage
          src="https://img.rocket.new/generatedImages/rocket_gen_img_1920bb65a-1785179235656.png"
          alt="Professional studio with Rembrandt lighting setup showing dramatic shadows and warm key light"
          fill
          priority
          className="object-cover object-center opacity-20"
          sizes="100vw" />
        
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>
      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Inicio</Link>
          <Icon name="ChevronRightIcon" size={14} />
          <span className="hover:text-foreground transition-colors cursor-pointer">Iluminación de Estudio</span>
          <Icon name="ChevronRightIcon" size={14} />
          <span className="text-foreground">Iluminación Rembrandt para Retrato</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Left: info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <TierBadge tier="obturador" size="md" showIcon />
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-500">
                Iluminación de Estudio
              </span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-500">
                Nivel Intermedio
              </span>
              {/* Access status badge */}
              {!isLoading &&
              <span className={`text-xs px-2 py-0.5 rounded-full font-500 flex items-center gap-1 ${
              canAccessCourse ?
              'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`
              }>
                  <Icon name={canAccessCourse ? 'CheckCircleIcon' : 'LockClosedIcon'} size={11} />
                  {canAccessCourse ? 'Acceso incluido' : 'Requiere Plan Obturador'}
                </span>
              }
            </div>

            <h1 className="text-3xl xl:text-4xl font-800 text-foreground mb-4 leading-tight">
              Iluminación Rembrandt para Retrato Profesional
            </h1>

            <p className="text-muted-foreground text-base leading-relaxed mb-6 max-w-2xl">
              Domina una de las técnicas de iluminación más buscadas en la fotografía de retrato. Aprende a crear el triángulo de luz característico, controlar sombras y adaptar el esquema a diferentes tipos de rostro y situaciones de estudio.
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-5 mb-6 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {Array.from({ length: 5 })?.map((_, i) =>
                  <Icon key={`detail-star-${i}`} name="StarIcon" size={14} className="text-primary" variant="solid" />
                  )}
                </div>
                <span className="font-700 text-foreground">4.9</span>
                <span className="text-muted-foreground">(1,248 reseñas)</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="UsersIcon" size={14} />
                <span>3,840 estudiantes</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="ClockIcon" size={14} />
                <span>8h 32min de contenido</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="CalendarIcon" size={14} />
                <span>Actualizado julio 2026</span>
              </div>
            </div>

            {/* Instructor */}
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden">
                <AppImage
                  src="https://img.rocket.new/generatedImages/rocket_gen_img_198563160-1772096672056.png"
                  alt="Carlos Mendoza photography instructor portrait"
                  fill
                  className="object-cover"
                  sizes="40px" />
                
              </div>
              <div>
                <p className="text-sm font-600 text-foreground">Carlos Mendoza</p>
                <p className="text-xs text-muted-foreground">Fotógrafo Comercial · Ciudad de México</p>
              </div>
            </div>
          </div>

          {/* Right: thumbnail on desktop */}
          <div className="hidden lg:block w-80 xl:w-96 shrink-0">
            <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl">
              <AppImage
                src="https://img.rocket.new/generatedImages/rocket_gen_img_1d731ee8d-1779952599495.png"
                alt="Course preview thumbnail showing Rembrandt lighting triangle on portrait subject"
                fill
                className="object-cover"
                sizes="400px" />
              
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                {isLoading ?
                <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div> :
                canAccessCourse ?
                <Link href="/video-player">
                    <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-xl hover:bg-primary transition-colors">
                      <Icon name="PlayIcon" size={28} className="text-primary-foreground ml-1" />
                    </div>
                  </Link> :

                <div className="text-center px-4">
                    <div className="w-14 h-14 rounded-full bg-black/60 border border-white/20 flex items-center justify-center mx-auto mb-2">
                      <Icon name="LockClosedIcon" size={22} className="text-white/60" />
                    </div>
                    <p className="text-xs text-white/70">
                      {isAuthenticated ?
                    `Requiere ${TIER_LABELS[COURSE_REQUIRED_TIER!]}` :
                    'Inicia sesión para acceder'}
                    </p>
                  </div>
                }
              </div>
              {canAccessCourse &&
              <div className="absolute bottom-3 left-3 bg-black/70 text-xs text-white px-2 py-1 rounded font-500">
                  Vista previa — Lección 1
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </section>);

}