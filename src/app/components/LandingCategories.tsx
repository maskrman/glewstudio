'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

interface Category {
  id: string;
  name: string;
  slug: string;
  coverImage: string | null;
  coverImageAlt: string;
  icon: string;
  color: string;
  courseCount: number;
}

export default function LandingCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        setCategories(data.categories ?? []);
      })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

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

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="rounded-2xl aspect-[4/3] bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Icon name="PhotoIcon" size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay categorías disponibles aún.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-5">
          {categories.map((cat) => (
            <Link key={cat.id} href="/dashboard">
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3] group cursor-pointer card-hover-lift">
                {cat.coverImage ? (
                  <AppImage
                    src={cat.coverImage}
                    alt={cat.coverImageAlt || cat.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="absolute inset-0 bg-muted" />
                )}

                <div className={`absolute inset-0 bg-gradient-to-t ${cat.color} via-black/40 to-transparent`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                      <Icon name={cat.icon as any} size={16} className="text-primary" />
                    </div>
                  </div>
                  <h3 className="text-base font-700 text-foreground mb-1">{cat.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {cat.courseCount} {cat.courseCount === 1 ? 'curso disponible' : 'cursos disponibles'}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}