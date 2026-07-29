'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { getWatchlist, removeFromWatchlist, WatchlistCourse } from '@/lib/watchlist';
import { useAuth } from '@/contexts/AuthContext';

type SortOption = 'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'rating';
type FilterTier = 'all' | 'apertura' | 'obturador' | 'diafragma';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Más reciente',
  oldest: 'Más antiguo',
  title_asc: 'Título A–Z',
  title_desc: 'Título Z–A',
  rating: 'Mejor valorado',
};

const TIER_LABELS: Record<FilterTier, string> = {
  all: 'Todos los niveles',
  apertura: 'Plan Apertura',
  obturador: 'Plan Obturador',
  diafragma: 'Plan Diafragma',
};

export default function WatchlistScreen() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<WatchlistCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>('newest');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [search, setSearch] = useState('');

  const fetchWatchlist = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const data = await getWatchlist();
      setCourses(data);
    } catch (err: any) {
      setError(err.message ?? 'Error al cargar la lista');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchWatchlist(); }, [fetchWatchlist]);

  const handleRemove = async (courseId: string) => {
    setRemoving(courseId);
    try {
      await removeFromWatchlist(courseId);
      setCourses(prev => prev.filter(c => c.courseId !== courseId));
    } catch (err: any) {
      setError(err.message ?? 'Error al eliminar');
    } finally {
      setRemoving(null);
    }
  };

  const filtered = courses
    .filter(c => filterTier === 'all' || c.courseTier === filterTier)
    .filter(c =>
      search.trim() === '' ||
      c.courseTitle.toLowerCase().includes(search.toLowerCase()) ||
      c.courseInstructor.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      switch (sort) {
        case 'newest': return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        case 'oldest': return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
        case 'title_asc': return a.courseTitle.localeCompare(b.courseTitle);
        case 'title_desc': return b.courseTitle.localeCompare(a.courseTitle);
        case 'rating': return (b.courseRating ?? 0) - (a.courseRating ?? 0);
        default: return 0;
      }
    });

  return (
    <div className="min-h-screen bg-background text-foreground pt-20 pb-16">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-800 text-foreground mb-1">Mi Lista</h1>
          <p className="text-muted-foreground text-sm">
            {courses.length > 0
              ? `${courses.length} curso${courses.length !== 1 ? 's' : ''} guardado${courses.length !== 1 ? 's' : ''}`
              : 'Tu lista de cursos guardados'}
          </p>
        </div>

        {/* Not logged in */}
        {!user && (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Icon name="BookmarkIcon" size={28} className="text-muted-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-700 text-foreground mb-2">Inicia sesión para ver tu lista</h2>
              <p className="text-muted-foreground text-sm mb-6">Guarda cursos y accede a ellos desde cualquier dispositivo.</p>
              <Link href="/sign-up-login" className="btn-primary px-6 py-2.5 text-sm font-600">
                Iniciar Sesión
              </Link>
            </div>
          </div>
        )}

        {/* Logged in */}
        {user && (
          <>
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar en mi lista..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {/* Filter by tier */}
              <select
                value={filterTier}
                onChange={e => setFilterTier(e.target.value as FilterTier)}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
              >
                {(Object.keys(TIER_LABELS) as FilterTier[]).map(t => (
                  <option key={t} value={t}>{TIER_LABELS[t]}</option>
                ))}
              </select>

              {/* Sort */}
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortOption)}
                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map(s => (
                  <option key={s} value={s}>{SORT_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-xl overflow-hidden bg-card animate-pulse">
                    <div className="aspect-video bg-muted" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-2.5 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-5">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Icon name="BookmarkIcon" size={28} className="text-muted-foreground" />
                </div>
                <div className="text-center">
                  {courses.length === 0 ? (
                    <>
                      <h2 className="text-lg font-700 text-foreground mb-2">Tu lista está vacía</h2>
                      <p className="text-muted-foreground text-sm mb-6">
                        Añade cursos desde el dashboard usando el botón <span className="text-foreground font-500">"Añadir a Mi Lista"</span>.
                      </p>
                      <Link href="/dashboard" className="btn-primary px-6 py-2.5 text-sm font-600">
                        Explorar Cursos
                      </Link>
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg font-700 text-foreground mb-2">Sin resultados</h2>
                      <p className="text-muted-foreground text-sm">Prueba con otros filtros o términos de búsqueda.</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Course grid */}
            {!loading && filtered.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filtered.map(course => (
                  <WatchlistCard
                    key={course.courseId}
                    course={course}
                    removing={removing === course.courseId}
                    onRemove={() => handleRemove(course.courseId)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function WatchlistCard({
  course,
  removing,
  onRemove,
}: {
  course: WatchlistCourse;
  removing: boolean;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-card group cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <Link href="/course-detail">
        <div className="relative aspect-video overflow-hidden">
          <AppImage
            src={course.courseThumbnail}
            alt={course.courseThumbnailAlt || course.courseTitle}
            width={400}
            height={225}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
          <div className="absolute inset-0 gradient-card-hover" />

          {/* Play on hover */}
          {hovered && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                <Icon name="PlayIcon" size={20} className="text-primary-foreground ml-0.5" />
              </div>
            </div>
          )}

          {/* Duration */}
          <div className="absolute bottom-2 right-2 bg-black/70 text-foreground text-xs px-1.5 py-0.5 rounded font-500">
            {course.courseDuration}
          </div>
        </div>
      </Link>

      {/* Remove button */}
      <button
        onClick={onRemove}
        disabled={removing}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-red-600/80 transition-colors z-10 opacity-0 group-hover:opacity-100"
        aria-label="Eliminar de Mi Lista"
        title="Eliminar de Mi Lista"
      >
        {removing ? (
          <div className="w-3 h-3 border border-white/60 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Icon name="XMarkIcon" size={14} />
        )}
      </button>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-600 text-foreground line-clamp-2 leading-snug mb-1">
          {course.courseTitle}
        </h3>
        <p className="text-xs text-muted-foreground mb-2">{course.courseInstructor}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {course.courseRating && (
              <div className="flex items-center gap-1">
                <Icon name="StarIcon" size={12} className="text-primary" />
                <span className="text-xs text-muted-foreground">{course.courseRating.toFixed(1)}</span>
              </div>
            )}
            {course.courseLessonCount && (
              <span className="text-xs text-muted-foreground">{course.courseLessonCount} lecciones</span>
            )}
          </div>
          <TierBadge tier={course.courseTier as any} size="sm" />
        </div>
      </div>
    </div>
  );
}
