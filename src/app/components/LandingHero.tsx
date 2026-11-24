'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

const FEATURED_COURSE = {
  title: 'Iluminación Cinematográfica: Del Concepto al Resultado',
  instructor: 'Carlos Mendoza',
  image: '',
  imageAlt: 'Sesión de fotografía de estudio con iluminación cinematográfica y equipo profesional',
  description:
    'Aprende a diseñar esquemas de iluminación para retratos, moda y fotografía comercial.',
};

const glassAction =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/45 px-5 py-3 text-sm font-700 text-white backdrop-blur-md transition-colors hover:border-white/20 hover:bg-black/65 focus-ring';

export default function LandingHero() {
  const [inMyList, setInMyList] = useState(false);

  const toggleMyList = () => {
    const nextInMyList = !inMyList;
    setInMyList(nextInMyList);
    toast.success(nextInMyList ? 'Guardado en Mi Lista para esta sesión' : 'Eliminado de Mi Lista');
  };

  return (
    <section className="relative isolate flex min-h-[78svh] items-end overflow-hidden bg-background pt-24 md:min-h-[88svh]">
      <div className="absolute inset-0 z-0">
        <AppImage
          src={FEATURED_COURSE.image}
          alt={FEATURED_COURSE.imageAlt}
          fill
          priority
          className="object-cover object-[62%_40%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/75 to-background/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_42%,transparent_0%,rgba(10,10,15,0.18)_38%,rgba(10,10,15,0.74)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-screen-2xl px-6 pb-24 pt-24 lg:px-8 xl:px-10 2xl:px-16 md:pb-32">
        <div className="max-w-2xl">
          <h1 className="mb-5 max-w-3xl text-4xl font-800 leading-tight text-foreground md:text-5xl xl:text-6xl">
            {FEATURED_COURSE.title}
          </h1>
          <p className="mb-3 text-sm font-600 text-foreground/90">
            Con {FEATURED_COURSE.instructor}
          </p>
          <p className="mb-8 max-w-xl text-base leading-relaxed text-foreground/75 md:text-lg">
            {FEATURED_COURSE.description}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/video-player" className={glassAction}>
              <Icon name="PlayIcon" size={18} className="text-primary" />
              Reproducir
            </Link>
            <Link href="/course-detail" className={glassAction}>
              <Icon name="InformationCircleIcon" size={18} />
              Más información
            </Link>
            <button
              type="button"
              onClick={toggleMyList}
              aria-pressed={inMyList}
              aria-label={inMyList ? 'Quitar de Mi Lista' : 'Añadir a Mi Lista'}
              className={glassAction}
            >
              <Icon name={inMyList ? 'CheckIcon' : 'PlusIcon'} size={18} />
              Mi Lista
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
