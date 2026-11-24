import React from 'react';
import AppImage from '@/components/ui/AppImage';

const instructors = [
  {
    id: 'inst-001',
    name: 'Carlos Mendoza',
    specialty: 'Iluminación de Estudio y Retrato',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_14144d2bd-1763299638094.png',
    imageAlt: 'Male photographer instructor with dark hair smiling in studio environment',
    tags: ['Retrato', 'Iluminación', 'Moda'],
  },
  {
    id: 'inst-002',
    name: 'Sofía Reyes',
    specialty: 'Fotografía de Producto y Gastronómica',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_15afd0b6c-1763297516522.png',
    imageAlt: 'Female photographer instructor with curly hair holding camera in bright studio',
    tags: ['Producto', 'Gastronomía', 'E-commerce'],
  },
  {
    id: 'inst-003',
    name: 'Alejandro Vega',
    specialty: 'Edición Comercial y Color Grading',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1d1457cca-1763295391616.png',
    imageAlt: 'Male photography instructor with glasses working on computer with editing software',
    tags: ['Lightroom', 'Photoshop', 'LUTs'],
  },
  {
    id: 'inst-004',
    name: 'Valentina Cruz',
    specialty: 'Dirección Creativa y BTS',
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_198bd0bfa-1763298528140.png',
    imageAlt: 'Female creative director instructor with straight hair in modern office setting',
    tags: ['Dirección', 'BTS', 'Campaña'],
  },
];

export default function LandingInstructors() {
  return (
    <section
      id="instructores"
      className="py-20 max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16"
    >
      <div className="text-center mb-12">
        <h2 className="text-hero-md font-800 text-foreground mb-4">Instructores en Activo</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Explora cursos de iluminación, retrato, producto y edición.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {instructors?.map((inst) => (
          <div
            key={inst?.id}
            className="bg-card border border-border rounded-2xl overflow-hidden group card-hover-lift"
          >
            <div className="relative h-48 overflow-hidden">
              <AppImage
                src={inst?.image}
                alt={inst?.imageAlt}
                fill
                className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
            </div>
            <div className="p-4">
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
    </section>
  );
}
