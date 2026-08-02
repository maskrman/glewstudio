'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

export default function LandingHero() {
  const [videoError, setVideoError] = useState(false);
  const [studentCount, setStudentCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/user-count')
      .then((res) => res.json())
      .then((data) => setStudentCount(100 + (data.count ?? 0)))
      .catch(() => setStudentCount(100));
  }, []);

  const formatCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K+`;
    return `${n}+`;
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <AppImage
          src="https://img.rocket.new/generatedImages/rocket_gen_img_1a8f26ebf-1767123516881.png"
          alt="Professional studio photography setup with dramatic lighting and camera equipment"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw" />
        
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>
      {/* Decorative blobs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 blob-gold pointer-events-none" />
      {/* Content */}
      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">
        <div className="max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5 mb-6">
            <span className="w-2 h-2 bg-primary rounded-full" />
            <span className="text-xs font-700 text-primary tracking-wider uppercase">
              Nueva Temporada — Iluminación Cinematográfica
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-hero-xl font-800 text-foreground mb-6 leading-tight">
            Domina la{' '}
            <span className="gradient-gold-text">Fotografía</span>
            {' '}de Estudio
          </h1>

          <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-lg">
            Cursos profesionales de iluminación, edición comercial y dirección creativa.
            Aprende de fotógrafos activos en la industria.
          </p>

          {/* Stats */}
          <div className="flex items-center gap-6 mb-10">
            {[
            { value: '120+', label: 'Cursos' },
            { value: studentCount !== null ? formatCount(studentCount) : '100+', label: 'Estudiantes' },
            { value: '4.9', label: 'Valoración' }]?.
            map((stat) =>
            <div key={`hero-stat-${stat?.label}`} className="text-center">
                <div className="text-2xl font-800 gradient-gold-text">{stat?.value}</div>
                <div className="text-xs text-muted-foreground font-500">{stat?.label}</div>
              </div>
            )}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/sign-up-login"
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-base font-700">
              
              <Icon name="PlayIcon" size={18} />
              Comenzar Gratis
            </Link>
            <Link
              href="/dashboard"
              className="btn-ghost inline-flex items-center gap-2 px-6 py-3 text-base font-600">
              
              <Icon name="FilmIcon" size={18} />
              Ver Cursos
            </Link>
          </div>

          {/* Trust */}
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="ShieldCheckIcon" size={16} className="text-primary" />
            <span>Sin compromiso · Cancela cuando quieras · Acceso inmediato</span>
          </div>
        </div>

      </div>
      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted-foreground animate-bounce">
        <span className="text-xs font-500">Explorar</span>
        <Icon name="ChevronDownIcon" size={18} />
      </div>
    </section>);

}