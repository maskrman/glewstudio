'use client';

import CardDeckCarousel from '@/components/ui/card-deck-carousel';
import type { Slide } from '@/components/ui/card-deck-carousel';

const PHOTOGRAPHY_SLIDES: Slide[] = [
  {
    title: 'Iluminación Cinematográfica',
    caption: 'Domina la luz en estudio con esquemas profesionales',
    palette: 'dusk',
    seed: 101,
    alt: 'Configuración de iluminación cinematográfica en estudio profesional',
  },
  {
    title: 'Retrato con Luz Rembrandt',
    caption: 'El triángulo clásico que define la fotografía de retrato',
    palette: 'dawn',
    seed: 202,
    alt: 'Retrato con iluminación Rembrandt dramática',
  },
  {
    title: 'Fotografía de Producto Premium',
    caption: 'Composición y luz para e-commerce de alta gama',
    palette: 'alpine',
    seed: 303,
    alt: 'Fotografía de producto en mesa de luz con sombras controladas',
  },
  {
    title: 'Color Grading Cinematográfico',
    caption: 'De RAW a look de película en Lightroom y Photoshop',
    palette: 'mist',
    seed: 404,
    alt: 'Flujo de trabajo de color grading con curva de tonos',
  },
  {
    title: 'Flash de Alta Velocidad HSS',
    caption: 'Congela el movimiento con sincronización de alta velocidad',
    palette: 'dusk',
    seed: 505,
    alt: 'Gota de agua congelada con flash HSS en estudio',
  },
  {
    title: 'Dirección Creativa y BTS',
    caption: 'Detrás de cámaras de una producción editorial completa',
    palette: 'alpine',
    seed: 606,
    alt: 'Equipo de producción en set fotográfico profesional',
  },
  {
    title: 'Fotografía Gastronómica',
    caption: 'Luz natural y artificial para platos irresistibles',
    palette: 'dawn',
    seed: 707,
    alt: 'Plato gourmet iluminado con luz lateral dramática',
  },
  {
    title: 'Moda Editorial en Estudio',
    caption: 'Múltiples flashes, gels de color y dirección de modelo',
    palette: 'mist',
    seed: 808,
    alt: 'Sesión de moda editorial con iluminación creativa',
  },
];

export default function FeaturedDeck() {
  return (
    <section className="w-full" aria-labelledby="featured-deck-heading">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 py-16">
        <div className="mb-10 text-center">
          <h2
            id="featured-deck-heading"
            className="text-3xl md:text-4xl font-800 text-foreground mb-3 tracking-tight"
          >
            Cursos Destacados del Mes
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Explora nuestra selección curada de masterclasses con los mejores fotógrafos en activo.
            Arrastrá, lanzá o usá las flechas para navegar.
          </p>
        </div>

        <CardDeckCarousel
          slides={PHOTOGRAPHY_SLIDES}
          height="72vh"
          cardWidth="min(78vw, 420px)"
          aspect="16 / 10"
          scatter={7}
          autoplay={5500}
          background="#0A0A0F"
          ink="#F0EDE8"
          ariaLabel="Carrusel de cursos destacados de fotografía"
          className="w-full"
        />
      </div>
    </section>
  );
}
