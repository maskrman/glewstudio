import React from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const instructor = {
  id: 'inst-001',
  name: 'Carlos Mendoza',
  specialty: 'Iluminación de Estudio y Retrato',
  courses: 14,
  students: 4820,
  rating: 4.9,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_14144d2bd-1763299638094.png",
  imageAlt: 'Male photographer instructor with dark hair smiling in studio environment',
  tags: ['Retrato', 'Iluminación', 'Moda'],
  bio: 'Fotógrafo profesional con más de 10 años de experiencia en campañas comerciales, editoriales de moda y producciones publicitarias. Ha trabajado con marcas internacionales y forma parte activa de la industria fotográfica.'
};

export default function LandingInstructors() {
  return (
    <section id="instructores" className="py-20 max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
      <div className="text-center mb-12">
        <p className="text-xs font-700 text-primary tracking-widest uppercase mb-2">Tu Instructor</p>
        <h2 className="text-hero-md font-800 text-foreground mb-4">Aprende del Mejor</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Profesional activo en campañas reales, editoriales y producciones comerciales.
        </p>
      </div>
      <div className="max-w-3xl mx-auto">
        <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col md:flex-row group card-hover-lift">
          {/* Photo */}
          <div className="relative w-full md:w-72 shrink-0 h-64 md:h-auto overflow-hidden">
            <AppImage
              src={instructor?.image}
              alt={instructor?.imageAlt}
              fill
              className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 288px" />
            
            <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent md:bg-gradient-to-r md:from-transparent md:to-card/20" />
          </div>

          {/* Info */}
          <div className="p-6 md:p-8 flex flex-col justify-center flex-1">
            <h3 className="text-2xl font-800 text-foreground mb-1">{instructor?.name}</h3>
            <p className="text-sm text-primary font-600 mb-3">{instructor?.specialty}</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">{instructor?.bio}</p>

            {/* Stats */}
            <div className="flex items-center gap-6 mb-5">
              <div className="text-center">
                <div className="flex items-center gap-1 justify-center mb-0.5">
                  <Icon name="StarIcon" size={14} className="text-primary" variant="solid" />
                  <span className="text-lg font-800 gradient-gold-text">{instructor?.rating}</span>
                </div>
                <p className="text-xs text-muted-foreground">Valoración</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-800 gradient-gold-text mb-0.5">{instructor?.courses}</div>
                <p className="text-xs text-muted-foreground">Cursos</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-800 gradient-gold-text mb-0.5">
                  {(instructor?.students / 1000)?.toFixed(1)}K
                </div>
                <p className="text-xs text-muted-foreground">Alumnos</p>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {instructor?.tags?.map((tag) =>
              <span
                key={`inst-tag-${tag}`}
                className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full">
                
                  {tag}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>);

}