'use client';

import React from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import { useLandingData } from './LandingContext';
import type { LandingInstructor } from '@/app/actions/landing';

export default function LandingInstructors() {
  const { data } = useLandingData();
  const instructors = data?.instructors ?? [];

  if (instructors.length === 0) {
    return null;
  }

  // Subtle radial gradient for depth
  const gradientBg = (
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_0%,rgba(251,191,36,0.05)_0%,transparent_50%),radial-gradient(ellipse_at_80%_100%,rgba(217,119,6,0.04)_0%,transparent_50%)]" />
  );

  // Single instructor: spotlight horizontal card
  if (instructors.length === 1) {
    const inst = instructors[0];
    return (
      <section id="instructores" className="relative z-10 py-20 lg:py-28">
        {gradientBg}
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
          <div className="text-center mb-12">
            <h2 className="text-hero-md font-800 text-foreground mb-4 relative inline-block">
              Instructor en Activo
              <span className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-24 h-0.5 bg-gradient-to-r from-amber-500 to-transparent" />
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Explora sus cursos de iluminación, retrato, producto y edición.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="bg-card border border-border rounded-2xl overflow-hidden group card-hover-lift">
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-0">
                {/* Large photo on left */}
                <div className="relative h-64 lg:h-auto min-h-[320px] overflow-hidden">
                  <AppImage
                    src={inst?.photo_url || ''}
                    alt={inst?.photo_alt || inst?.name}
                    fill
                    className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-card via-card/80 to-transparent lg:bg-gradient-to-r lg:from-card lg:via-card/60 lg:to-transparent" />
                </div>

                {/* Info on right */}
                <div className="p-8 lg:p-12 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-700 mb-4 w-fit">
                    <Icon name="StarIcon" size={12} />
                    Instructor Destacado
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-800 text-foreground mb-2">
                    {inst?.name}
                  </h3>
                  <p className="text-lg text-primary font-600 mb-6">
                    {inst?.specialty || 'Fotógrafo Profesional'}
                  </p>

                  {inst?.bio && (
                    <p className="text-muted-foreground leading-relaxed mb-6 text-base lg:text-lg max-w-xl">
                      {inst?.bio}
                    </p>
                  )}

                  {inst?.tags && inst?.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {inst?.tags?.map((tag) => (
                        <span
                          key={`${inst?.id}-tag-${tag}`}
                          className="text-sm bg-muted text-foreground px-4 py-1.5 rounded-full border border-border"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // 2+ instructors: balanced grid
  return (
    <section id="instructores" className="relative z-10 py-20 lg:py-28">
      {gradientBg}
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
        <div className="text-center mb-12">
          <h2 className="text-hero-md font-800 text-foreground mb-4 relative inline-block">
            Instructores en Activo
            <span className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-24 h-0.5 bg-gradient-to-r from-amber-500 to-transparent" />
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Explora cursos de iluminación, retrato, producto y edición.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {instructors?.map((inst) => (
            <div
              key={inst?.id}
              className="bg-card border border-border rounded-2xl overflow-hidden group card-hover-lift"
            >
              <div className="relative h-48 overflow-hidden">
                <AppImage
                  src={inst?.photo_url || ''}
                  alt={inst?.photo_alt || inst?.name}
                  fill
                  className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
              </div>
              <div className="p-5">
                <h3 className="font-700 text-foreground mb-0.5">{inst?.name}</h3>
                <p className="text-xs text-muted-foreground mb-3">{inst?.specialty}</p>

                <div className="flex flex-wrap gap-1.5">
                  {inst?.tags?.map((tag) => (
                    <span
                      key={`${inst?.id}-tag-${tag}`}
                      className="text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
