import React from 'react';
import CourseCarousel from '@/components/ui/CourseCarousel';

const trendingCourses = [
  {
    id: 'landing-trend-001',
    title: 'Iluminación Rembrandt para Retrato',
    instructor: 'Carlos Mendoza',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1d731ee8d-1779952599495.png',
    thumbnailAlt: 'Retrato de estudio con iluminación Rembrandt',
    duration: '14:32',
    tier: 'obturador' as const,
  },
  {
    id: 'landing-trend-002',
    title: 'Retoque de Piel en Photoshop CC',
    instructor: 'Sofía Reyes',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1aa26c31d-1785844143724.png',
    thumbnailAlt: 'Edición profesional de un retrato en Photoshop',
    duration: '22:15',
    tier: 'apertura' as const,
  },
  {
    id: 'landing-trend-003',
    title: 'Fotografía de Producto en Mesa de Luz',
    instructor: 'Sofía Reyes',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_18c3fcab2-1772196420648.png',
    thumbnailAlt: 'Producto fotografiado sobre una mesa de luz',
    duration: '18:44',
    tier: 'apertura' as const,
  },
  {
    id: 'landing-trend-004',
    title: 'Color Grading Cinematográfico',
    instructor: 'Alejandro Vega',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1e45302fc-1783851831373.png',
    thumbnailAlt: 'Flujo de trabajo de color grading cinematográfico',
    duration: '31:20',
    tier: 'obturador' as const,
  },
  {
    id: 'landing-trend-005',
    title: 'Esquemas de Tres Puntos de Luz',
    instructor: 'Carlos Mendoza',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_113c48f0e-1772615974348.png',
    thumbnailAlt: 'Esquema de iluminación de tres puntos en un estudio',
    duration: '26:10',
    tier: 'obturador' as const,
  },
];

const lightingCourses = [
  {
    id: 'landing-light-001',
    title: 'Luz Natural vs Luz Artificial en Estudio',
    instructor: 'Carlos Mendoza',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1708fe872-1787083078550.png',
    thumbnailAlt: 'Comparación de luz natural y luz de estudio',
    duration: '45:00',
    tier: 'apertura' as const,
  },
  {
    id: 'landing-light-002',
    title: 'Softboxes, Paraguas y Modificadores',
    instructor: 'Carlos Mendoza',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_129426577-1785194268625.png',
    thumbnailAlt: 'Modificadores de luz dispuestos en un estudio fotográfico',
    duration: '38:00',
    tier: 'obturador' as const,
  },
  {
    id: 'landing-light-003',
    title: 'Luz de Borde y Contraluz Dramático',
    instructor: 'Valentina Cruz',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_18bddf107-1779534745026.png',
    thumbnailAlt: 'Retrato con iluminación de borde y contraluz',
    duration: '29:30',
    tier: 'obturador' as const,
  },
  {
    id: 'landing-light-004',
    title: 'Flash de Alta Velocidad HSS',
    instructor: 'Carlos Mendoza',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_19c438e56-1772196420060.png',
    thumbnailAlt: 'Gota de agua congelada con flash de alta velocidad',
    duration: '52:15',
    tier: 'diafragma' as const,
  },
  {
    id: 'landing-light-005',
    title: 'Iluminación para Moda Editorial',
    instructor: 'Carlos Mendoza',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1c7111102-1785194268846.png',
    thumbnailAlt: 'Montaje de iluminación para una sesión editorial de moda',
    duration: '1h 10min',
    tier: 'diafragma' as const,
  },
];

const recentCourses = [
  {
    id: 'landing-recent-001',
    title: 'Flujo de Trabajo RAW en Lightroom',
    instructor: 'Alejandro Vega',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1ed65725a-1787083076883.png',
    thumbnailAlt: 'Interfaz de edición RAW en Lightroom',
    duration: '1h 05min',
    tier: 'apertura' as const,
  },
  {
    id: 'landing-recent-002',
    title: 'Dodge & Burn Profesional',
    instructor: 'Alejandro Vega',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_17fc5741d-1787083076097.png',
    thumbnailAlt: 'Retoque de retrato con técnica Dodge and Burn',
    duration: '48:20',
    tier: 'obturador' as const,
  },
  {
    id: 'landing-recent-003',
    title: 'Fotografía de Joyería y Relojes',
    instructor: 'Sofía Reyes',
    thumbnail: 'https://images.unsplash.com/photo-1642697601641-142b68190a91',
    thumbnailAlt: 'Fotografía macro de un reloj sobre una superficie oscura',
    duration: '42:00',
    tier: 'obturador' as const,
  },
  {
    id: 'landing-recent-004',
    title: 'BTS: Sesión Editorial para Vogue MX',
    instructor: 'Valentina Cruz',
    thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_19b1925a8-1769680916668.png',
    thumbnailAlt: 'Equipo preparando una sesión editorial de fotografía',
    duration: '1h 20min',
    tier: 'obturador' as const,
  },
  {
    id: 'landing-recent-005',
    title: 'Gastronomía: Platos Calientes',
    instructor: 'Sofía Reyes',
    thumbnail: 'https://images.unsplash.com/photo-1528267696449-7205ebc11414',
    thumbnailAlt: 'Fotografía gastronómica con iluminación de estudio',
    duration: '37:15',
    tier: 'apertura' as const,
  },
];

export default function LandingCategories() {
  return (
    <section id="cursos" aria-label="Cursos" className="relative z-10 space-y-12 pb-16 pt-4">
      <CourseCarousel title="Tendencias" courses={trendingCourses} />
      <CourseCarousel title="Iluminación Pro" courses={lightingCourses} />
      <CourseCarousel title="Recientes" courses={recentCourses} />
    </section>
  );
}
