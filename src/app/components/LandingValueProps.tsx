'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

const valueProps = [
  {
    icon: 'CameraIcon',
    title: 'Producción en Estudio Real',
    description: 'Aprende con sets reales, esquemas de luz profesionales y equipos de cine.',
  },
  {
    icon: 'FilmIcon',
    title: 'Clases Bajo Demanda',
    description: 'Acceso ilimitado a todas las lecciones cuando quieras, sin horarios fijos.',
  },
  {
    icon: 'ClockIcon',
    title: 'Aprende a tu Ritmo',
    description: 'Pausa, rebobina y repite las lecciones las veces que necesites.',
  },
  {
    icon: 'MonitorIcon',
    title: 'Acceso desde Cualquier Dispositivo',
    description: 'Tu progreso se sincroniza en móvil, tablet, escritorio y Smart TV.',
  },
];

export default function LandingValueProps() {
  return (
    <section
      aria-label="Propuesta de valor"
      className="relative z-10 border-b border-white/10 bg-white/5 backdrop-blur-xl"
    >
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {valueProps.map((prop, index) => (
            <div
              key={prop.title}
              className="flex flex-col items-center text-center gap-3 p-4 lg:p-6 transition-all duration-500 hover:translate-y-[-4px]"
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <div className="relative w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center mb-4">
                <Icon
                  name={prop.icon as any}
                  size={28}
                  className="text-amber-400 w-7 h-7 lg:w-8 lg:h-8"
                />
              </div>
              <h3 className="text-lg lg:text-xl font-700 text-foreground tracking-tight">
                {prop.title}
              </h3>
              <p className="text-sm lg:text-base text-muted-foreground leading-relaxed max-w-xs">
                {prop.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
