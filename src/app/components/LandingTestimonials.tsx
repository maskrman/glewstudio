'use client';

import React, { useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const testimonials = [
{
  id: 'test-001',
  name: 'Mariana López',
  role: 'Fotógrafa de Moda, CDMX',
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1741dbb43-1767714188948.png",
  avatarAlt: 'Young woman with brown hair smiling in natural light portrait',
  rating: 5,
  text: 'El curso de iluminación Rembrandt de Carlos cambió completamente mi manera de trabajar en estudio. En 3 semanas pude cobrar el doble por mis sesiones.',
  plan: 'Obturador'
},
{
  id: 'test-002',
  name: 'Ricardo Fuentes',
  role: 'Fotógrafo Comercial, Monterrey',
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_15ebdb31b-1763300068284.png",
  avatarAlt: 'Middle-aged man with short dark hair in professional headshot',
  rating: 5,
  text: 'Los archivos RAW de práctica son oro puro. Poder editar el mismo material que el instructor hace que el aprendizaje sea real y aplicable de inmediato.',
  plan: 'Diafragma'
},
{
  id: 'test-003',
  name: 'Camila Herrera',
  role: 'Estudiante de Diseño, Bogotá',
  avatar: "https://images.unsplash.com/photo-1548094775-79e5a4171f9f",
  avatarAlt: 'Young woman with long dark hair in casual portrait with blurred background',
  rating: 5,
  text: 'Empecé con el Plan Apertura y en 2 meses ya tenía clientes. La calidad de los cursos de producto de Sofía es increíble. Vale cada centavo.',
  plan: 'Apertura'
}];


export default function LandingTestimonials() {
  const [active, setActive] = useState(0);
  const t = testimonials?.[active];

  return (
    <section className="py-20 bg-secondary/20">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
        <div className="text-center mb-12">
          <p className="text-xs font-700 text-primary tracking-widest uppercase mb-2">Testimonios</p>
          <h2 className="text-hero-md font-800 text-foreground">
            Lo que Dicen Nuestros Estudiantes
          </h2>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="glass-card rounded-2xl p-8 text-center animate-fade-in" key={t?.id}>
            <div className="flex justify-center mb-4">
              {Array.from({ length: t?.rating })?.map((_, i) =>
              <Icon key={`testimonial-star-${i}`} name="StarIcon" size={20} className="text-primary" variant="solid" />
              )}
            </div>
            <p className="text-lg text-foreground leading-relaxed mb-6 font-500">
              &ldquo;{t?.text}&rdquo;
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <AppImage
                  src={t?.avatar}
                  alt={t?.avatarAlt}
                  fill
                  className="object-cover"
                  sizes="48px" />
                
              </div>
              <div className="text-left">
                <p className="font-700 text-foreground text-sm">{t?.name}</p>
                <p className="text-xs text-muted-foreground">{t?.role}</p>
              </div>
              <span className={`ml-2 text-xs font-700 px-2 py-0.5 rounded-full ${
              t?.plan === 'Diafragma' ? 'tier-badge-diafragma' :
              t?.plan === 'Obturador' ? 'tier-badge-obturador' : 'tier-badge-apertura'}`
              }>
                {t?.plan}
              </span>
            </div>
          </div>

          <div className="flex justify-center gap-2 mt-6">
            {testimonials?.map((_, i) =>
            <button
              key={`dot-${i}`}
              onClick={() => setActive(i)}
              className={`w-2 h-2 rounded-full transition-all ${
              i === active ? 'bg-primary w-6' : 'bg-muted-foreground/30'}`
              }
              aria-label={`Testimonial ${i + 1}`} />

            )}
          </div>
        </div>
      </div>
    </section>);

}