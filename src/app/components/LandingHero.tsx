'use client';

import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const btnPrimaryGold =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-3 text-sm font-700 text-black shadow-lg shadow-amber-500/30 transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-400/40 focus-ring';
const btnSecondaryTranslucent =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-8 py-3 text-sm font-700 text-white backdrop-blur-md transition-colors hover:border-white/30 hover:bg-white/10 focus-ring';

const badgeStyle =
  'inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-1.5 text-xs font-700 text-amber-400 uppercase tracking-wider';

export default function LandingHero() {
  return (
    <section className="relative isolate flex min-h-[78svh] items-center justify-start overflow-hidden bg-background pt-24 md:min-h-[88svh]">
      <div className="absolute inset-0 z-0">
        <AppImage
          src="/assets/images/studio-hero.jpg"
          alt="Glewstudio - Estudio de fotografía profesional"
          fill
          priority
          className="object-cover object-[62%_40%]"
          sizes="100vw"
        />
        {/* Deep dark gradient from left and bottom for maximum text contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(0,0,0,0)_0%,rgba(10,10,15,0.6)_70%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-screen-2xl px-6 pb-24 pt-24 lg:px-8 xl:px-10 2xl:px-16 md:pb-32">
        <div className="max-w-2xl text-left">
          {/* Golden badge: ACADEMIA DE FOTOGRAFÍA E ILUMINACIÓN */}
          <div className={badgeStyle}>ACADEMIA DE FOTOGRAFÍA E ILUMINACIÓN</div>

          {/* Main H1 */}
          <h1 className="mt-6 mb-6 max-w-3xl text-4xl font-800 leading-tight text-white md:text-5xl lg:text-6xl xl:text-7xl">
            Domina la luz, la cámara y la producción fotográfica profesional.
          </h1>

          {/* Description/Subtitle */}
          <p className="mb-8 max-w-xl text-base leading-relaxed text-foreground/80 md:text-lg">
            Aprende fotografía de estudio, retrato, producto y edición cinematográfica con cursos
            prácticos creados por profesionales. Empieza gratis o adquiere cursos completos con
            acceso inmediato.
          </p>

          {/* CTA Buttons */}
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <Link href="/courses" className={btnPrimaryGold}>
              <Icon name="PlayIcon" size={18} />
              Explorar Cursos
            </Link>
            <Link href="/sign-up-login?plan=free" className={btnSecondaryTranslucent}>
              <Icon name="UserPlusIcon" size={18} />
              Comenzar Gratis
            </Link>
          </div>

          {/* Value proposition */}
          <p className="text-sm text-foreground/50 tracking-wide">
            Clases gratuitas disponibles · Cursos on-demand · Acceso desde cualquier dispositivo
          </p>
        </div>
      </div>
    </section>
  );
}
