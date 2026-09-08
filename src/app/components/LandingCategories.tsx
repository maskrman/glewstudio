import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

const categories = [
{
  id: 'cat-iluminacion',
  title: 'Iluminación de Estudio',
  count: 28,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1408ce8e4-1767456938177.png",
  imageAlt: 'Professional studio lighting setup with softboxes and reflectors arranged around a white backdrop',
  icon: 'LightBulbIcon',
  color: 'from-amber-500/30'
},
{
  id: 'cat-edicion',
  title: 'Edición y Retoque',
  count: 34,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1b1bced12-1772090748084.png",
  imageAlt: 'Photographer editing photos on dual monitor setup with Lightroom color grading interface',
  icon: 'PhotoIcon',
  color: 'from-blue-500/30'
},
{
  id: 'cat-producto',
  title: 'Fotografía de Producto',
  count: 22,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_12cc6a154-1772130537457.png",
  imageAlt: 'Elegant watch product photography on black marble surface with dramatic side lighting',
  icon: 'CubeIcon',
  color: 'from-emerald-500/30'
},
{
  id: 'cat-retrato',
  title: 'Retrato Comercial',
  count: 19,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1d4eb9c08-1783533378529.png",
  imageAlt: 'Professional commercial portrait of a model with dramatic studio lighting and dark background',
  icon: 'UserIcon',
  color: 'from-rose-500/30'
},
{
  id: 'cat-gastronomia',
  title: 'Fotografía Gastronómica',
  count: 15,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1acd6bae0-1778766509157.png",
  imageAlt: 'Overhead flat lay food photography of colorful dishes arranged on rustic wooden table',
  icon: 'BeakerIcon',
  color: 'from-orange-500/30'
},
{
  id: 'cat-bts',
  title: 'Detrás de Cámaras',
  count: 12,
  image: "https://img.rocket.new/generatedImages/rocket_gen_img_1e1f7fbc5-1772733210834.png",
  imageAlt: 'Behind the scenes of a professional photo shoot showing photographer, assistants, and lighting crew',
  icon: 'FilmIcon',
  color: 'from-purple-500/30'
}];


export default function LandingCategories() {
  return (
    <section id="cursos" className="py-20 max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-700 text-primary tracking-widest uppercase mb-2">Explora</p>
          <h2 className="text-hero-md font-800 text-foreground">
            Categorías de Cursos
          </h2>
        </div>
        <Link
          href="/dashboard"
          className="hidden md:flex items-center gap-2 text-sm font-600 text-primary hover:text-accent transition-colors">
          
          Ver todos <Icon name="ArrowRightIcon" size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-5">
        {categories.map((cat) =>
        <Link key={cat.id} href="/dashboard">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3] group cursor-pointer card-hover-lift">
              <AppImage
              src={cat.image}
              alt={cat.imageAlt}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
            
              <div className={`absolute inset-0 bg-gradient-to-t ${cat.color} via-black/40 to-transparent`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <Icon name={cat.icon as any} size={16} className="text-primary" />
                  </div>
                </div>
                <h3 className="text-base font-700 text-foreground mb-1">{cat.title}</h3>
                <p className="text-sm text-muted-foreground">{cat.count} cursos disponibles</p>
              </div>
            </div>
          </Link>
        )}
      </div>
    </section>);

}