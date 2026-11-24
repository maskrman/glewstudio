'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface PublicCourse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  category_id: string | null;
  instructor: string;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  rating: number;
  lesson_count: number;
  price: number | null;
  access_type: 'free' | 'membership' | 'premium_purchase';
  minimum_tier: 'free' | 'apertura' | 'obturador' | 'diafragma' | null;
  status: 'draft' | 'public' | 'presale';
  is_published: boolean;
  created_at: string;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  cover_image: string | null;
  cover_image_alt: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
}

interface CourseWithProgress {
  id: string;
  title: string;
  slug: string;
  instructor: string;
  thumbnail: string;
  thumbnailAlt: string;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  lessonCount: number;
  rating: number;
  category: string;
  price: number;
  accessType: 'free' | 'membership' | 'premium_purchase';
  isFree: boolean;
  progress?: number;
  watchedSeconds?: number;
  totalSeconds?: number;
  completed?: boolean;
  purchased?: boolean;
}

interface CoursesScreenProps {
  initialCourses: PublicCourse[];
  initialCategories: Category[];
}

// ─── Purchase Modal ───────────────────────────────────────────────────────────
interface PurchaseModalProps {
  course: CourseWithProgress;
  onClose: () => void;
  onPurchased: (courseId: string) => void;
}

function PurchaseModal({ course, onClose }: PurchaseModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Thumbnail */}
        <div className="relative h-44 overflow-hidden">
          <AppImage
            src={course.thumbnail}
            alt={course.thumbnailAlt}
            fill
            className="object-cover"
            sizes="(max-width: 448px) 100vw, 448px"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <Icon name="XMarkIcon" size={16} />
          </button>
          {/* Lock icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
              <Icon name="LockClosedIcon" size={28} className="text-white" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h2 className="text-base font-700 text-foreground leading-snug mb-1">{course.title}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {course.instructor} · {course.category}
          </p>

          {/* Course info */}
          <div className="grid grid-cols-3 gap-3 bg-muted/40 rounded-xl p-3 mb-5">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Lecciones</p>
              <p className="text-sm font-700 text-foreground">{course.lessonCount}</p>
            </div>
            <div className="text-center border-x border-border">
              <p className="text-xs text-muted-foreground mb-0.5">Duración</p>
              <p className="text-sm font-700 text-foreground">{course.duration}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Rating</p>
              <p className="text-sm font-700 text-foreground flex items-center justify-center gap-1">
                <Icon name="StarIcon" size={12} className="text-primary" variant="solid" />
                {course.rating.toFixed(1)}
              </p>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between mb-5">
            <span className="text-sm text-muted-foreground">Precio del curso</span>
            <span className="text-2xl font-800 text-foreground">
              ${course.price} <span className="text-sm font-500 text-muted-foreground">USD</span>
            </span>
          </div>

          {/* Payment not yet available */}
          <div className="bg-muted/40 border border-border rounded-xl p-4 mb-4 text-center">
            <Icon name="CreditCardIcon" size={20} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-600 text-foreground mb-1">Pagos próximamente</p>
            <p className="text-xs text-muted-foreground">
              La integración de pagos estará disponible pronto.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 text-sm font-700 border border-border rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            Cerrar
          </button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Acceso de por vida · Descarga disponible
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Progress Modal ───────────────────────────────────────────────────────────
interface CourseProgressModalProps {
  course: CourseWithProgress;
  onClose: () => void;
}

function CourseProgressModal({ course, onClose }: CourseProgressModalProps) {
  const progressPercent = course.progress ?? 0;
  const watchedMin = Math.floor((course.watchedSeconds ?? 0) / 60);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Thumbnail */}
        <div className="relative h-48 overflow-hidden">
          <AppImage
            src={course.thumbnail}
            alt={course.thumbnailAlt}
            fill
            className="object-cover"
            sizes="(max-width: 512px) 100vw, 512px"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            <Icon name="XMarkIcon" size={16} />
          </button>
          {course.completed && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-primary/90 text-primary-foreground text-xs font-700 px-2.5 py-1 rounded-full">
              <Icon name="CheckCircleIcon" size={14} />
              Completado
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-base font-700 text-foreground leading-snug">{course.title}</h2>
            <TierBadge tier={course.tier} size="sm" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {course.instructor} · {course.category}
          </p>

          {/* Progress Section */}
          <div className="bg-muted/40 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-600 text-foreground">Tu progreso</span>
              <span className="text-sm font-700 text-primary">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
              <div
                className="h-full progress-bar rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Visto</p>
                <p className="text-sm font-700 text-foreground">
                  {watchedMin > 0 ? `${watchedMin}min` : '0min'}
                </p>
              </div>
              <div className="text-center border-x border-border">
                <p className="text-xs text-muted-foreground mb-0.5">Lecciones</p>
                <p className="text-sm font-700 text-foreground">{course.lessonCount}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Duración</p>
                <p className="text-sm font-700 text-foreground">{course.duration}</p>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mb-5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Icon name="StarIcon" size={12} className="text-primary" variant="solid" />
              <span className="font-600 text-foreground">{course.rating.toFixed(1)}</span>
            </div>
            <span>·</span>
            <span>{course.category}</span>
          </div>

          <div className="flex gap-3">
            <Link
              href="/video-player"
              className="btn-primary flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm font-700"
            >
              <Icon name="PlayIcon" size={16} />
              {progressPercent > 0 ? 'Continuar' : 'Comenzar'}
            </Link>
            <Link
              href="/course-detail"
              className="btn-ghost px-4 py-2.5 text-sm font-600 inline-flex items-center gap-2"
            >
              <Icon name="InformationCircleIcon" size={16} />
              Detalles
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CoursesScreen({ initialCourses, initialCategories }: CoursesScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('Todos');
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithProgress | null>(null);
  const [purchaseCourse, setPurchaseCourse] = useState<CourseWithProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(true);

  // Fixed filter pills - exactly 6 in a single row
  const FILTER_PILLS: FilterType[] = [
    'Todos',
    'Apertura',
    'Obturador',
    'Diafragma',
    'Gratis',
    'Compra Premium',
  ];

  type FilterType = 'Todos' | 'Apertura' | 'Obturador' | 'Diafragma' | 'Gratis' | 'Compra Premium';

  // Transform database courses to UI format
  const transformCourses = (dbCourses: PublicCourse[]): CourseWithProgress[] => {
    return dbCourses.map((c) => {
      const isFree =
        c.access_type === 'free' ||
        c.minimum_tier === 'free' ||
        (c.price !== null && c.price === 0);
      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        instructor: c.instructor || 'Instructor',
        thumbnail: c.thumbnail || '',
        thumbnailAlt: c.thumbnail_alt || c.title,
        duration: c.duration || '0:00',
        tier: c.minimum_tier || c.tier,
        lessonCount: c.lesson_count || 0,
        rating: c.rating || 0,
        category: c.category?.name || 'Sin categoría',
        price: c.price || 0,
        accessType: c.access_type,
        isFree,
      };
    });
  };

  // Initialize courses from server data
  useEffect(() => {
    const transformed = transformCourses(initialCourses);
    setCourses(transformed);
  }, [initialCourses]);

  const loadData = useCallback(async () => {
    setLoadingProgress(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoadingProgress(false);
        return;
      }

      // Load progress and purchases in parallel
      const [progressResult, purchasesResult] = await Promise.all([
        supabase
          .from('course_progress')
          .select('course_id, watched_seconds, total_seconds, completed')
          .eq('user_id', user.id),
        supabase.from('course_purchases').select('course_id').eq('user_id', user.id),
      ]);

      const purchasedIds = new Set<string>(
        (purchasesResult.data ?? []).map((r: { course_id: string }) => r.course_id)
      );

      const progressMap: Record<
        string,
        { watchedSeconds: number; totalSeconds: number; completed: boolean }
      > = {};
      (progressResult.data ?? []).forEach(
        (row: {
          course_id: string;
          watched_seconds: number | null;
          total_seconds: number | null;
          completed: boolean | null;
        }) => {
          progressMap[row.course_id] = {
            watchedSeconds: row.watched_seconds ?? 0,
            totalSeconds: row.total_seconds ?? 0,
            completed: row.completed ?? false,
          };
        }
      );

      setCourses((prev) =>
        prev.map((c) => {
          const p = progressMap[c.id];
          const pct =
            p && p.totalSeconds > 0
              ? Math.round((p.watchedSeconds / p.totalSeconds) * 100)
              : p?.completed
                ? 100
                : 0;
          return {
            ...c,
            purchased: purchasedIds.has(c.id),
            progress: p ? pct : undefined,
            watchedSeconds: p?.watchedSeconds,
            totalSeconds: p?.totalSeconds,
            completed: p?.completed,
          };
        })
      );
    } catch {
      // silently fail
    } finally {
      setLoadingProgress(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  const handlePurchased = (courseId: string) => {
    setCourses((prev) => prev.map((c) => (c.id === courseId ? { ...c, purchased: true } : c)));
  };

  const handleCourseClick = (course: CourseWithProgress) => {
    // Free courses and admin users can access directly
    if (course.purchased || course.isFree) {
      // Navigate to video player with course slug
      router.push(`/video-player?course=${course.slug}`);
    } else {
      setPurchaseCourse(course);
    }
  };

  const filtered = courses.filter((c) => {
    const matchesSearch =
      search.trim() === '' ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.instructor.toLowerCase().includes(search.toLowerCase());

    let matchesFilter = true;
    switch (activeFilter) {
      case 'Todos':
        matchesFilter = true;
        break;
      case 'Apertura':
        matchesFilter = c.tier === 'apertura';
        break;
      case 'Obturador':
        matchesFilter = c.tier === 'obturador';
        break;
      case 'Diafragma':
        matchesFilter = c.tier === 'diafragma';
        break;
      case 'Gratis':
        matchesFilter = c.isFree;
        break;
      case 'Compra Premium':
        matchesFilter = c.accessType === 'premium_purchase';
        break;
      default:
        matchesFilter = true;
    }

    return matchesSearch && matchesFilter;
  });

  const purchased = filtered.filter((c) => c.purchased);
  const freeNotPurchased = filtered.filter((c) => !c.purchased && c.isFree);
  const locked = filtered.filter((c) => !c.purchased && !c.isFree);

  const inProgress = purchased.filter((c) => (c.progress ?? 0) > 0 && !c.completed);
  const completed = purchased.filter((c) => c.completed);
  const notStarted = purchased.filter((c) => !c.progress && !c.completed);

  // Empty state for no courses in database
  const totalCourses = initialCourses.length;

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-800 text-foreground mb-1">Cursos Disponibles</h1>
          <p className="text-sm text-muted-foreground">
            {totalCourses} cursos · Compra un curso para desbloquearlo
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative w-full max-w-md">
            <Icon
              name="MagnifyingGlassIcon"
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              placeholder="Buscar cursos o instructores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
            />

            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  router.replace('/courses', { scroll: false });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <Icon name="XMarkIcon" size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Filter pills - exactly 6 in a single row */}
        <nav aria-label="Filtrar cursos" className="mb-7">
          <div className="flex items-center gap-2 flex-wrap">
            {FILTER_PILLS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                aria-pressed={activeFilter === filter}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-600 transition-colors focus-ring whitespace-nowrap ${
                  activeFilter === filter
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:bg-white/[0.07] hover:text-foreground'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </nav>

        {/* Results count */}
        {(search || activeFilter !== 'Todos') && (
          <p aria-live="polite" className="text-xs text-muted-foreground mb-5">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            {search ? ` para "${search}"` : ''}
            {activeFilter !== 'Todos' ? ` en ${activeFilter}` : ''}
          </p>
        )}

        {loadingProgress ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : totalCourses === 0 ? (
          /* Empty state - no courses in database */
          <div className="flex flex-col items-center justify-center py-24 text-center bg-zinc-950/50 border border-zinc-800 rounded-2xl">
            <Icon name="FilmIcon" size={48} className="text-zinc-600 mb-4" variant="solid" />
            <h2 className="text-xl font-700 text-foreground mb-2">Proximamente nuevos cursos</h2>
            <p className="text-zinc-400 max-w-md mx-auto leading-relaxed">
              Estamos preparando una seleccion exclusiva de cursos de fotografia profesional. Vuelve
              pronto para descubrir contenido de iluminacion, edicion, retrato y mas.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state - no results for filter */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Icon name="MagnifyingGlassIcon" size={40} className="text-muted-foreground mb-3" />
            <p className="text-base font-600 text-foreground mb-1">Sin resultados</p>
            <p className="text-sm text-muted-foreground">Intenta con otro termino o categoria</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* In Progress */}
            {inProgress.length > 0 && (
              <section>
                <h2 className="text-base font-700 text-foreground mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                  Continuar Viendo
                  <span className="text-xs font-500 text-muted-foreground">
                    ({inProgress.length})
                  </span>
                </h2>
                <CourseGrid courses={inProgress} onSelect={handleCourseClick} />
              </section>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <section>
                <h2 className="text-base font-700 text-foreground mb-4 flex items-center gap-2">
                  <Icon name="CheckCircleIcon" size={16} className="text-primary" />
                  Completados
                  <span className="text-xs font-500 text-muted-foreground">
                    ({completed.length})
                  </span>
                </h2>
                <CourseGrid courses={completed} onSelect={handleCourseClick} />
              </section>
            )}

            {/* Purchased not started */}
            {notStarted.length > 0 && (
              <section>
                <h2 className="text-base font-700 text-foreground mb-4 flex items-center gap-2">
                  <Icon name="PlayCircleIcon" size={16} className="text-muted-foreground" />
                  Mis Cursos
                  <span className="text-xs font-500 text-muted-foreground">
                    ({notStarted.length})
                  </span>
                </h2>
                <CourseGrid courses={notStarted} onSelect={handleCourseClick} />
              </section>
            )}

            {/* Free courses (not purchased) */}
            {freeNotPurchased.length > 0 && (
              <section>
                <h2 className="text-base font-700 text-foreground mb-4 flex items-center gap-2">
                  <Icon name="GiftIcon" size={16} className="text-green-400" />
                  Cursos Gratis
                  <span className="text-xs font-500 text-muted-foreground">
                    ({freeNotPurchased.length})
                  </span>
                </h2>
                <CourseGrid courses={freeNotPurchased} onSelect={handleCourseClick} />
              </section>
            )}

            {/* Locked courses */}
            {locked.length > 0 && (
              <section>
                <h2 className="text-base font-700 text-foreground mb-4 flex items-center gap-2">
                  <Icon name="LockClosedIcon" size={16} className="text-muted-foreground" />
                  Cursos Disponibles
                  <span className="text-xs font-500 text-muted-foreground">({locked.length})</span>
                </h2>
                <CourseGrid courses={locked} onSelect={handleCourseClick} />
              </section>
            )}
          </div>
        )}
      </div>

      {/* Progress Modal (purchased courses) */}
      {selectedCourse && (
        <CourseProgressModal course={selectedCourse} onClose={() => setSelectedCourse(null)} />
      )}

      {/* Purchase Modal (locked courses) */}
      {purchaseCourse && (
        <PurchaseModal
          course={purchaseCourse}
          onClose={() => setPurchaseCourse(null)}
          onPurchased={handlePurchased}
        />
      )}
    </div>
  );
}

// ─── Course Grid ──────────────────────────────────────────────────────────────
interface CourseGridProps {
  courses: CourseWithProgress[];
  onSelect: (course: CourseWithProgress) => void;
}

function CourseGrid({ courses, onSelect }: CourseGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {courses.map((course) => (
        <div
          key={course.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(course)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(course);
            }
          }}
          className="text-left group focus:outline-none cursor-pointer"
        >
          <div className="relative rounded-xl overflow-hidden bg-card border border-border/50 hover:border-primary/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30">
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden">
              <AppImage
                src={course.thumbnail}
                alt={course.thumbnailAlt}
                fill
                className={`object-cover transition-transform duration-300 ${course.purchased ? 'group-hover:scale-105' : 'brightness-50'}`}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

              {course.purchased || course.isFree ? (
                /* Play overlay for purchased or free */
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                    <Icon name="PlayIcon" size={18} className="text-primary-foreground ml-0.5" />
                  </div>
                </div>
              ) : (
                /* Lock overlay for unpurchased */
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <div className="w-9 h-9 rounded-full bg-black/70 flex items-center justify-center">
                    <Icon name="LockClosedIcon" size={18} className="text-white" />
                  </div>
                  <span className="text-white font-800 text-sm drop-shadow">${course.price}</span>
                </div>
              )}

              {/* Completed badge */}
              {course.completed && (
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-primary/90 text-primary-foreground text-xs font-700 px-2 py-0.5 rounded-full">
                  <Icon name="CheckIcon" size={10} />
                  100%
                </div>
              )}

              {/* Duration */}
              <span className="absolute bottom-2 right-2 text-xs font-600 text-white bg-black/60 px-1.5 py-0.5 rounded">
                {course.duration}
              </span>

              {/* Bookmark/Save button */}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const { addToWatchlist, removeFromWatchlist, isInWatchlist } =
                      await import('@/lib/watchlist');
                    const inList = await isInWatchlist(course.id);
                    if (inList) {
                      await removeFromWatchlist(course.id);
                      toast.success('Eliminado de Mi Lista');
                    } else {
                      await addToWatchlist({
                        courseId: course.id,
                        courseSlug: course.slug,
                        courseTitle: course.title,
                        courseInstructor: course.instructor,
                        courseThumbnail: course.thumbnail,
                        courseThumbnailAlt: course.thumbnailAlt,
                        courseDuration: course.duration,
                        courseTier: course.tier,
                        courseRating: course.rating,
                        courseLessonCount: course.lessonCount,
                      });
                      toast.success('Añadido a Mi Lista');
                    }
                  } catch (error) {
                    toast.error(
                      error instanceof Error && error.message === 'Not authenticated'
                        ? 'Inicia sesión para guardar cursos en Mi Lista.'
                        : 'No se pudo actualizar Mi Lista. Inténtalo de nuevo.'
                    );
                  }
                }}
                className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-colors z-10 opacity-0 group-hover:opacity-100"
                aria-label="Guardar en Mi Lista"
                title="Guardar en Mi Lista"
              >
                <Icon name="BookmarkIcon" size={16} />
              </button>
            </div>

            {/* Info */}
            <div className="p-3">
              <h3 className="text-xs font-600 text-foreground line-clamp-2 leading-snug mb-1">
                {course.title}
              </h3>
              <p className="text-xs text-muted-foreground mb-2">{course.instructor}</p>

              {course.purchased ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Icon name="StarIcon" size={11} className="text-primary" variant="solid" />
                    <span className="text-xs text-muted-foreground">
                      {course.rating.toFixed(1)}
                    </span>
                  </div>
                  <TierBadge tier={course.tier} size="sm" />
                </div>
              ) : course.isFree ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-800 text-green-400">Gratis</span>
                  <TierBadge tier={course.tier} size="sm" />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-800 text-foreground">
                    ${course.price}{' '}
                    <span className="text-xs font-500 text-muted-foreground">USD</span>
                  </span>
                  <span className="text-xs font-600 text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    Comprar
                  </span>
                </div>
              )}

              {/* Progress bar for purchased courses */}
              {course.purchased && (course.progress ?? 0) > 0 && (
                <div className="mt-2">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full progress-bar rounded-full"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {course.progress}% completado
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
