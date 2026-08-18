'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { createClient } from '@/lib/supabase/client';

interface CourseWithProgress {
  id: string;
  title: string;
  instructor: string;
  thumbnail: string;
  thumbnailAlt: string;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  lessonCount: number;
  rating: number;
  category: string;
  price: number;
  progress?: number;
  watchedSeconds?: number;
  totalSeconds?: number;
  completed?: boolean;
  purchased?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  PROVISIONAL DATA SOURCE — NOT AUTHORITATIVE
//
// ALL_COURSES is a static, hardcoded list used exclusively for UI rendering
// (displaying the course catalog, filtering, sorting).
//
// THIS ARRAY MUST NOT BE USED AS AUTHORITY FOR:
//   - Authorization decisions (who can access a course)
//   - Real pricing (prices here are display-only estimates)
//   - Permission checks (tier requirements)
//   - Membership entitlements
//   - Purchase validation
//
// The authoritative source for all of the above is the DATABASE:
//   - Table: public.courses          → real course metadata, tier requirements
//   - Table: public.course_purchases → paid purchases (purchase_status = 'paid')
//   - Table: public.subscriptions    → active memberships (status = 'active')
//
// Migration to DB-driven catalog is planned for a future phase.
// Until then, ALL authorization and access control is enforced server-side
// via RLS policies and the /api/video-token endpoint — never via this array.
// ─────────────────────────────────────────────────────────────────────────────
const ALL_COURSES: CourseWithProgress[] = [
{ id: 'cw-001', title: 'Iluminación Rembrandt para Retrato', instructor: 'Carlos Mendoza', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1d731ee8d-1779952599495.png', thumbnailAlt: 'Studio lighting setup with Rembrandt pattern creating dramatic shadows on portrait subject', duration: '14:32', tier: 'obturador', lessonCount: 12, rating: 4.9, category: 'Iluminación de Estudio', price: 349 },
{ id: 'cw-002', title: 'Retoque de Piel en Photoshop CC', instructor: 'Sofía Reyes', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1aa26c31d-1785844143724.png", thumbnailAlt: 'Professional photo retouching workflow showing skin smoothing techniques in Photoshop', duration: '22:15', tier: 'apertura', lessonCount: 8, rating: 4.8, category: 'Edición y Retoque', price: 319 },
{ id: 'cw-003', title: 'Fotografía de Producto en Mesa de Luz', instructor: 'Sofía Reyes', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_18c3fcab2-1772196420648.png', thumbnailAlt: 'Elegant product photography on light table with minimalist composition', duration: '18:44', tier: 'apertura', lessonCount: 10, rating: 4.7, category: 'Fotografía de Producto', price: 329 },
{ id: 'cw-004', title: 'Color Grading Cinematográfico', instructor: 'Alejandro Vega', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1e45302fc-1783851831373.png', thumbnailAlt: 'Color grading workflow in Lightroom with cinematic teal and orange look applied', duration: '31:20', tier: 'obturador', lessonCount: 16, rating: 4.9, category: 'Edición y Retoque', price: 379 },
{ id: 'cw-005', title: 'Esquemas de Tres Puntos de Luz', instructor: 'Carlos Mendoza', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_113c48f0e-1772615974348.png', thumbnailAlt: 'Three-point lighting diagram with key light, fill light, and back light setup in studio', duration: '26:10', tier: 'obturador', lessonCount: 14, rating: 4.8, category: 'Iluminación de Estudio', price: 359 },
{ id: 'sl-001', title: 'Luz Natural vs Luz Artificial en Estudio', instructor: 'Carlos Mendoza', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_154854948-1787082103072.png", thumbnailAlt: 'Comparison of natural window light and artificial strobe light in photography studio', duration: '45:00', tier: 'apertura', lessonCount: 18, rating: 4.8, category: 'Iluminación de Estudio', price: 309 },
{ id: 'sl-002', title: 'Softboxes, Paraguas y Modificadores', instructor: 'Carlos Mendoza', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_129426577-1785194268625.png', thumbnailAlt: 'Array of photography light modifiers including softboxes and octaboxes on studio floor', duration: '38:00', tier: 'obturador', lessonCount: 14, rating: 4.9, category: 'Iluminación de Estudio', price: 349 },
{ id: 'sl-003', title: 'Luz de Borde y Contraluz Dramático', instructor: 'Valentina Cruz', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_18bddf107-1779534745027.png', thumbnailAlt: 'Dramatic back lighting creating rim light silhouette effect on model in studio', duration: '29:30', tier: 'obturador', lessonCount: 10, rating: 4.7, category: 'Iluminación de Estudio', price: 339 },
{ id: 'sl-004', title: 'Flash de Alta Velocidad HSS', instructor: 'Carlos Mendoza', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_19c438e56-1772196420060.png', thumbnailAlt: 'High speed sync flash freezing motion of water droplet in professional studio setting', duration: '52:15', tier: 'diafragma', lessonCount: 22, rating: 4.9, category: 'Iluminación de Estudio', price: 449 },
{ id: 'sl-005', title: 'Iluminación para Moda Editorial', instructor: 'Carlos Mendoza', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1c7111102-1785194268846.png', thumbnailAlt: 'Fashion editorial lighting setup with multiple strobe heads and colored gels', duration: '1h 10min', tier: 'diafragma', lessonCount: 28, rating: 5.0, category: 'Iluminación de Estudio', price: 499 },
{ id: 'sl-006', title: 'Medición de Luz con Fotómetro', instructor: 'Alejandro Vega', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1fa242636-1772528160793.png', thumbnailAlt: 'Photographer using handheld light meter in studio to measure exposure readings', duration: '22:00', tier: 'apertura', lessonCount: 8, rating: 4.6, category: 'Iluminación de Estudio', price: 319 },
{ id: 'ed-001', title: 'Flujo de Trabajo RAW en Lightroom', instructor: 'Alejandro Vega', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_10244334a-1787082101641.png", thumbnailAlt: 'Lightroom RAW workflow showing catalog organization and basic develop panel', duration: '1h 05min', tier: 'apertura', lessonCount: 20, rating: 4.9, category: 'Edición y Retoque', price: 329 },
{ id: 'ed-002', title: 'Dodge & Burn Profesional', instructor: 'Alejandro Vega', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1e40a5b45-1787082100684.png", thumbnailAlt: 'Photoshop dodge and burn technique showing luminosity masking on portrait retouching', duration: '48:20', tier: 'obturador', lessonCount: 14, rating: 4.8, category: 'Edición y Retoque', price: 369 },
{ id: 'ed-003', title: 'Mascaras de Luminosidad Avanzadas', instructor: 'Alejandro Vega', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1e8b96243-1787082100359.png", thumbnailAlt: 'Advanced luminosity masking technique in Photoshop for selective color and tone control', duration: '55:00', tier: 'diafragma', lessonCount: 18, rating: 4.9, category: 'Edición y Retoque', price: 429 },
{ id: 'ed-004', title: 'Presets de Lightroom desde Cero', instructor: 'Alejandro Vega', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1b566eb3f-1774179779705.png', thumbnailAlt: 'Creating custom Lightroom presets from scratch showing develop module settings', duration: '35:45', tier: 'obturador', lessonCount: 12, rating: 4.7, category: 'Edición y Retoque', price: 349 },
{ id: 'ed-005', title: 'Eliminación de Fondos con IA', instructor: 'Sofía Reyes', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_1f0c2aa2a-1787082100312.png", thumbnailAlt: 'AI-powered background removal tool in Photoshop removing complex hair strands', duration: '28:30', tier: 'apertura', lessonCount: 8, rating: 4.6, category: 'Edición y Retoque', price: 309 },
{ id: 'pp-001', title: 'Fotografía de Joyería y Relojes', instructor: 'Sofía Reyes', thumbnail: 'https://images.unsplash.com/photo-1642697601641-142b68190a91', thumbnailAlt: 'Macro product photography of luxury watch on reflective black surface', duration: '42:00', tier: 'obturador', lessonCount: 16, rating: 4.9, category: 'Fotografía de Producto', price: 389 },
{ id: 'pp-002', title: 'Gastronomía: Platos Calientes', instructor: 'Sofía Reyes', thumbnail: 'https://images.unsplash.com/photo-1528267696449-7205ebc11414', thumbnailAlt: 'Food photography of steaming hot dishes with dramatic side lighting on dark background', duration: '37:15', tier: 'apertura', lessonCount: 12, rating: 4.8, category: 'Fotografía de Producto', price: 319 },
{ id: 'pp-003', title: 'Flat Lay para E-commerce', instructor: 'Sofía Reyes', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1f7ed4286-1774319801004.png', thumbnailAlt: 'Overhead flat lay arrangement of fashion accessories on white background for e-commerce', duration: '31:00', tier: 'apertura', lessonCount: 10, rating: 4.7, category: 'Fotografía de Producto', price: 329 },
{ id: 'pp-004', title: 'Fotografía de Botellas y Líquidos', instructor: 'Sofía Reyes', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1a124e3ab-1772147627773.png', thumbnailAlt: 'Professional bottle photography with backlit liquid creating translucent amber glow', duration: '55:20', tier: 'diafragma', lessonCount: 20, rating: 4.9, category: 'Fotografía de Producto', price: 459 },
{ id: 'bts-001', title: 'BTS: Sesión Editorial para Vogue MX', instructor: 'Valentina Cruz', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_19b1925a8-1769680916668.png', thumbnailAlt: 'Behind the scenes of high-fashion editorial shoot with full crew and lighting team', duration: '1h 20min', tier: 'obturador', lessonCount: 6, rating: 4.9, category: 'Detrás de Cámaras', price: 379 },
{ id: 'bts-002', title: 'BTS: Campaña de Perfume Luxury', instructor: 'Carlos Mendoza', thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_1aa57d80d-1772990049840.png', thumbnailAlt: 'Behind the scenes production of luxury perfume campaign with multiple light setups', duration: '58:00', tier: 'diafragma', lessonCount: 5, rating: 4.8, category: 'Detrás de Cámaras', price: 449 },
{ id: 'bts-003', title: 'BTS: Retrato Corporativo para Banco', instructor: 'Alejandro Vega', thumbnail: "https://img.rocket.new/generatedImages/rocket_gen_img_15f7f420d-1787082102198.png", thumbnailAlt: 'Behind the scenes of corporate portrait photography for banking client in office setting', duration: '44:30', tier: 'obturador', lessonCount: 4, rating: 4.7, category: 'Detrás de Cámaras', price: 359 }];


const CATEGORIES = ['Todos', 'Iluminación de Estudio', 'Edición y Retoque', 'Fotografía de Producto', 'Detrás de Cámaras'];

// ─── Purchase Modal ───────────────────────────────────────────────────────────
interface PurchaseModalProps {
  course: CourseWithProgress;
  onClose: () => void;
  onPurchased: (courseId: string) => void;
}

function PurchaseModal({ course, onClose }: PurchaseModalProps) {
  // ✅ SECURITY: course_purchases CANNOT be inserted from the browser.
  // RLS blocks all client-side INSERT on course_purchases.
  // Real purchases must go through a payment provider webhook (server-side).
  // This modal is intentionally disabled until payment integration (Phase 9).

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
            sizes="(max-width: 448px) 100vw, 448px" />
          
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors">
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
          <p className="text-sm text-muted-foreground mb-4">{course.instructor} · {course.category}</p>

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
            <span className="text-2xl font-800 text-foreground">${course.price} <span className="text-sm font-500 text-muted-foreground">USD</span></span>
          </div>

          {/* Payment not yet available */}
          <div className="bg-muted/40 border border-border rounded-xl p-4 mb-4 text-center">
            <Icon name="CreditCardIcon" size={20} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-600 text-foreground mb-1">Pagos próximamente</p>
            <p className="text-xs text-muted-foreground">La integración de pagos estará disponible pronto.</p>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 text-sm font-700 border border-border rounded-xl text-muted-foreground hover:text-foreground transition-colors">
            Cerrar
          </button>
          <p className="text-xs text-muted-foreground text-center mt-3">Acceso de por vida · Descarga disponible</p>
        </div>
      </div>
    </div>);

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
            sizes="(max-width: 512px) 100vw, 512px" />
          
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors">
            
            <Icon name="XMarkIcon" size={16} />
          </button>
          {course.completed &&
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-primary/90 text-primary-foreground text-xs font-700 px-2.5 py-1 rounded-full">
              <Icon name="CheckCircleIcon" size={14} />
              Completado
            </div>
          }
        </div>

        {/* Content */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="text-base font-700 text-foreground leading-snug">{course.title}</h2>
            <TierBadge tier={course.tier} size="sm" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">{course.instructor} · {course.category}</p>

          {/* Progress Section */}
          <div className="bg-muted/40 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-600 text-foreground">Tu progreso</span>
              <span className="text-sm font-700 text-primary">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
              <div
                className="h-full progress-bar rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }} />
              
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Visto</p>
                <p className="text-sm font-700 text-foreground">{watchedMin > 0 ? `${watchedMin}min` : '0min'}</p>
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
              className="btn-primary flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm font-700">
              
              <Icon name="PlayIcon" size={16} />
              {progressPercent > 0 ? 'Continuar' : 'Comenzar'}
            </Link>
            <Link
              href="/course-detail"
              className="btn-ghost px-4 py-2.5 text-sm font-600 inline-flex items-center gap-2">
              
              <Icon name="InformationCircleIcon" size={16} />
              Detalles
            </Link>
          </div>
        </div>
      </div>
    </div>);

}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CoursesScreen() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [courses, setCourses] = useState<CourseWithProgress[]>(ALL_COURSES);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithProgress | null>(null);
  const [purchaseCourse, setPurchaseCourse] = useState<CourseWithProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(true);

  const loadData = useCallback(async () => {
    setLoadingProgress(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingProgress(false);
        return;
      }

      // Load progress and purchases in parallel
      const [progressResult, purchasesResult] = await Promise.all([
      supabase.
      from('course_progress').
      select('course_id, watched_seconds, total_seconds, completed').
      eq('user_id', user.id),
      supabase.
      from('course_purchases').
      select('course_id').
      eq('user_id', user.id)]
      );

      const purchasedIds = new Set<string>(
        (purchasesResult.data ?? []).map((r: {course_id: string;}) => r.course_id)
      );

      const progressMap: Record<string, {watchedSeconds: number;totalSeconds: number;completed: boolean;}> = {};
      (progressResult.data ?? []).forEach((row: {course_id: string;watched_seconds: number | null;total_seconds: number | null;completed: boolean | null;}) => {
        progressMap[row.course_id] = {
          watchedSeconds: row.watched_seconds ?? 0,
          totalSeconds: row.total_seconds ?? 0,
          completed: row.completed ?? false
        };
      });

      setCourses(ALL_COURSES.map((c) => {
        const p = progressMap[c.id];
        const pct = p && p.totalSeconds > 0 ?
        Math.round(p.watchedSeconds / p.totalSeconds * 100) :
        p?.completed ? 100 : 0;
        return {
          ...c,
          purchased: purchasedIds.has(c.id),
          progress: p ? pct : undefined,
          watchedSeconds: p?.watchedSeconds,
          totalSeconds: p?.totalSeconds,
          completed: p?.completed
        };
      }));
    } catch {


      // silently fail
    } finally {setLoadingProgress(false);}
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePurchased = (courseId: string) => {
    setCourses((prev) =>
    prev.map((c) => c.id === courseId ? { ...c, purchased: true } : c)
    );
  };

  const handleCourseClick = (course: CourseWithProgress) => {
    if (course.purchased) {
      setSelectedCourse(course);
    } else {
      setPurchaseCourse(course);
    }
  };

  const filtered = courses.filter((c) => {
    const matchesSearch =
    search.trim() === '' ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.instructor.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'Todos' || c.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const purchased = filtered.filter((c) => c.purchased);
  const locked = filtered.filter((c) => !c.purchased);

  const inProgress = purchased.filter((c) => (c.progress ?? 0) > 0 && !c.completed);
  const completed = purchased.filter((c) => c.completed);
  const notStarted = purchased.filter((c) => !c.progress && !c.completed);

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-800 text-foreground mb-1">Cursos Disponibles</h1>
          <p className="text-sm text-muted-foreground">{ALL_COURSES.length} cursos · Compra un curso para desbloquearlo</p>
        </div>

        {/* Search + Filter row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Icon name="MagnifyingGlassIcon" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar cursos o instructores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all" />
            
            {search &&
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              
                <Icon name="XMarkIcon" size={16} />
              </button>
            }
          </div>

          {/* Category pills */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORIES.map((cat) =>
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-3 py-2 rounded-lg text-xs font-600 transition-all ${
              activeCategory === cat ?
              'bg-primary text-primary-foreground' :
              'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'}`
              }>
              
                {cat}
              </button>
            )}
          </div>
        </div>

        {/* Results count */}
        {search &&
        <p className="text-xs text-muted-foreground mb-5">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para &quot;{search}&quot;
          </p>
        }

        {loadingProgress ?
        <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div> :
        filtered.length === 0 ?
        <div className="flex flex-col items-center justify-center py-24 text-center">
            <Icon name="MagnifyingGlassIcon" size={40} className="text-muted-foreground mb-3" />
            <p className="text-base font-600 text-foreground mb-1">Sin resultados</p>
            <p className="text-sm text-muted-foreground">Intenta con otro término o categoría</p>
          </div> :

        <div className="space-y-10">
            {/* In Progress */}
            {inProgress.length > 0 &&
          <section>
                <h2 className="text-base font-700 text-foreground mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                  Continuar Viendo
                  <span className="text-xs font-500 text-muted-foreground">({inProgress.length})</span>
                </h2>
                <CourseGrid courses={inProgress} onSelect={handleCourseClick} />
              </section>
          }

            {/* Completed */}
            {completed.length > 0 &&
          <section>
                <h2 className="text-base font-700 text-foreground mb-4 flex items-center gap-2">
                  <Icon name="CheckCircleIcon" size={16} className="text-primary" />
                  Completados
                  <span className="text-xs font-500 text-muted-foreground">({completed.length})</span>
                </h2>
                <CourseGrid courses={completed} onSelect={handleCourseClick} />
              </section>
          }

            {/* Purchased not started */}
            {notStarted.length > 0 &&
          <section>
                <h2 className="text-base font-700 text-foreground mb-4 flex items-center gap-2">
                  <Icon name="PlayCircleIcon" size={16} className="text-muted-foreground" />
                  Mis Cursos
                  <span className="text-xs font-500 text-muted-foreground">({notStarted.length})</span>
                </h2>
                <CourseGrid courses={notStarted} onSelect={handleCourseClick} />
              </section>
          }

            {/* Locked courses */}
            {locked.length > 0 &&
          <section>
                <h2 className="text-base font-700 text-foreground mb-4 flex items-center gap-2">
                  <Icon name="LockClosedIcon" size={16} className="text-muted-foreground" />
                  Cursos Disponibles
                  <span className="text-xs font-500 text-muted-foreground">({locked.length})</span>
                </h2>
                <CourseGrid courses={locked} onSelect={handleCourseClick} />
              </section>
          }
          </div>
        }
      </div>

      {/* Progress Modal (purchased courses) */}
      {selectedCourse &&
      <CourseProgressModal
        course={selectedCourse}
        onClose={() => setSelectedCourse(null)} />

      }

      {/* Purchase Modal (locked courses) */}
      {purchaseCourse &&
      <PurchaseModal
        course={purchaseCourse}
        onClose={() => setPurchaseCourse(null)}
        onPurchased={handlePurchased} />

      }
    </div>);

}

// ─── Course Grid ──────────────────────────────────────────────────────────────
interface CourseGridProps {
  courses: CourseWithProgress[];
  onSelect: (course: CourseWithProgress) => void;
}

function CourseGrid({ courses, onSelect }: CourseGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {courses.map((course) =>
      <button
        key={course.id}
        onClick={() => onSelect(course)}
        className="text-left group focus:outline-none">
        
          <div className="relative rounded-xl overflow-hidden bg-card border border-border/50 hover:border-primary/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30">
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden">
              <AppImage
              src={course.thumbnail}
              alt={course.thumbnailAlt}
              fill
              className={`object-cover transition-transform duration-300 ${course.purchased ? 'group-hover:scale-105' : 'brightness-50'}`}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" />
            
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

              {course.purchased ? (
            /* Play overlay for purchased */
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                    <Icon name="PlayIcon" size={18} className="text-primary-foreground ml-0.5" />
                  </div>
                </div>) : (

            /* Lock overlay for unpurchased */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <div className="w-9 h-9 rounded-full bg-black/70 flex items-center justify-center">
                    <Icon name="LockClosedIcon" size={18} className="text-white" />
                  </div>
                  <span className="text-white font-800 text-sm drop-shadow">${course.price}</span>
                </div>)
            }

              {/* Completed badge */}
              {course.completed &&
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-primary/90 text-primary-foreground text-xs font-700 px-2 py-0.5 rounded-full">
                  <Icon name="CheckIcon" size={10} />
                  100%
                </div>
            }

              {/* Duration */}
              <span className="absolute bottom-2 right-2 text-xs font-600 text-white bg-black/60 px-1.5 py-0.5 rounded">
                {course.duration}
              </span>
            </div>

            {/* Info */}
            <div className="p-3">
              <h3 className="text-xs font-600 text-foreground line-clamp-2 leading-snug mb-1">{course.title}</h3>
              <p className="text-xs text-muted-foreground mb-2">{course.instructor}</p>

              {course.purchased ?
            <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Icon name="StarIcon" size={11} className="text-primary" variant="solid" />
                    <span className="text-xs text-muted-foreground">{course.rating.toFixed(1)}</span>
                  </div>
                  <TierBadge tier={course.tier} size="sm" />
                </div> :

            <div className="flex items-center justify-between">
                  <span className="text-sm font-800 text-foreground">${course.price} <span className="text-xs font-500 text-muted-foreground">USD</span></span>
                  <span className="text-xs font-600 text-primary bg-primary/10 px-2 py-0.5 rounded-full">Comprar</span>
                </div>
            }

              {/* Progress bar for purchased courses */}
              {course.purchased && (course.progress ?? 0) > 0 &&
            <div className="mt-2">
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                  className="h-full progress-bar rounded-full"
                  style={{ width: `${course.progress}%` }} />
                
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{course.progress}% completado</p>
                </div>
            }
            </div>
          </div>
        </button>
      )}
    </div>);

}