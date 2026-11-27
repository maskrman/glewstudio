'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

const steps = [
  {
    number: '01',
    icon: 'UserPlusIcon',
    title: 'Crea tu cuenta gratis',
    description:
      'Regístrate en segundos sin tarjeta de crédito. Accede al catálogo completo y trailers de todos los cursos.',
  },
  {
    number: '02',
    icon: 'CompassIcon',
    title: 'Explora cursos o elige tu membresía',
    description:
      'Navega por categorías, filtra por nivel y tema. Elige entre plan gratis, membresía o compra cursos premium individualmente.',
  },
  {
    number: '03',
    icon: 'PlayCircleIcon',
    title: 'Accede a tus clases cuando quieras',
    description:
      'Tus cursos están disponibles 24/7 en cualquier dispositivo. Tu progreso se guarda automáticamente.',
  },
];

export default function LandingHowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-label="Cómo funciona Glewstudio"
      className="relative z-10 py-20 lg:py-28"
    >
      {/* Subtle radial gradient background for depth */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,191,36,0.06)_0%,transparent_60%),radial-gradient(ellipse_at_80%_100%,rgba(217,119,6,0.04)_0%,transparent_50%)]" />

      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
        <div className="text-center mb-16">
          <h2 className="text-hero-md font-800 text-foreground mb-4 relative inline-block">
            ¿Cómo funciona Glewstudio?
            <span className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-24 h-0.5 bg-gradient-to-r from-amber-500 to-transparent" />
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Tres pasos para dominar la fotografía profesional sin complicaciones.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative group flex flex-col items-center text-center p-6 lg:p-8 rounded-2xl border border-white/5 bg-white/3 backdrop-blur-xl transition-all duration-500 hover:border-amber-500/30 hover:bg-white/5 hover:translate-y-[-6px]"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {/* Step number */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black font-800 text-xl shadow-lg shadow-amber-500/30">
                {step.number}
              </div>

              {/* Icon */}
              <div className="relative mt-10 w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/20 flex items-center justify-center mb-6 group-hover:border-amber-500/40 group-hover:bg-amber-500/20 transition-all duration-300">
                <Icon
                  name={step.icon as any}
                  size={32}
                  className="text-amber-400 w-8 h-8 lg:w-9 lg:h-9"
                />
              </div>

              <h3 className="text-xl lg:text-2xl font-700 text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
