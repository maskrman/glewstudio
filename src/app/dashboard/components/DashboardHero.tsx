'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { addToWatchlist, removeFromWatchlist } from '@/lib/watchlist';
import { createClient } from '@/lib/supabase/client';

const HERO_COURSE = {
  courseId: 'hero-iluminacion-cinematografica',
  courseTitle: 'Iluminación Cinematográfica: Del Concepto al Resultado',
  courseInstructor: 'Carlos Mendoza',
  courseThumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_19e5903ef-1783560999543.png',
  courseThumbnailAlt: 'Dramatic studio photography session with professional lighting rigs and a model in elegant pose',
  courseDuration: '8h 30min',
  courseTier: 'diafragma',
  courseRating: 4.9,
  courseLessonCount: 24
};

export default function DashboardHero() {
  const [inList, setInList] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase?.auth?.getUser()?.then(({ data: { user } }) => {
      if (!user) return;
      supabase?.from('watchlist')?.select('id')?.eq('user_id', user?.id)?.eq('course_id', HERO_COURSE?.courseId)?.maybeSingle()?.then(({ data }) => {
        if (data) setInList(true);
      });
    });
  }, []);

  const handleListToggle = async () => {
    setListLoading(true);
    try {
      if (inList) {
        await removeFromWatchlist(HERO_COURSE?.courseId);
        setInList(false);
      } else {
        await addToWatchlist(HERO_COURSE);
        setInList(true);
      }
    } catch {




      // silently fail if not authenticated
    } finally {setListLoading(false);}};
  return (
    <section className="relative w-full h-[85vh] min-h-[560px] max-h-[860px] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <AppImage
          src="https://img.rocket.new/generatedImages/rocket_gen_img_19e5903ef-1783560999543.png"
          alt="Dramatic studio photography session with professional lighting rigs and a model in elegant pose"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw" />
        
        <div className="gradient-dark-overlay absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex items-end pb-16 max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
        <div className="max-w-xl">
          {/* Category tag */}
          <div className="flex items-center gap-2 mb-4">
            <TierBadge tier="diafragma" size="md" showIcon />
            <span className="text-xs text-muted-foreground font-500">Masterclass del Mes</span>
          </div>

          <h1 className="text-hero-md font-800 text-foreground mb-4 leading-tight">
            Iluminación Cinematográfica:<br />
            Del Concepto al Resultado
          </h1>

          <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Icon name="StarIcon" size={14} className="text-primary" variant="solid" />
              <span className="font-600 text-foreground">4.9</span>
            </div>
            <span>2.4K estudiantes</span>
            <span>8h 30min</span>
            <span>24 lecciones</span>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed mb-6 max-w-md">
            Aprende a diseñar esquemas de iluminación complejos para retratos, moda y fotografía comercial con Carlos Mendoza.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/video-player"
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-700">
              <Icon name="PlayIcon" size={18} />
              Ver Ahora
            </Link>
            <button
              onClick={handleListToggle}
              disabled={listLoading}
              className={`btn-ghost inline-flex items-center gap-2 px-5 py-3 text-sm font-600 ${
              inList ? 'border-primary/50 text-primary' : ''}`
              }>
              
              {listLoading ?
              <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" /> :
              inList ?
              <Icon name="CheckIcon" size={18} className="text-primary" /> :

              <Icon name="PlusIcon" size={18} />
              }
              {inList ? 'En Mi Lista' : 'Añadir a Mi Lista'}
            </button>
            <Link
              href="/course-detail"
              className="btn-ghost inline-flex items-center gap-2 px-5 py-3 text-sm font-600">
              <Icon name="InformationCircleIcon" size={18} />
              Más Info
            </Link>
          </div>
        </div>
      </div>

      {/* Mute toggle */}
      <button
        onClick={() => setMuted(!muted)}
        className="absolute bottom-16 right-8 z-10 w-10 h-10 rounded-full border border-border bg-black/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
        <Icon name={muted ? 'SpeakerXMarkIcon' : 'SpeakerWaveIcon'} size={18} />
      </button>
    </section>);

}