'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSubscriptionTier, hasAccess, TIER_LABELS, TIER_PRICES, type SubscriptionTier } from '@/lib/subscription';
import { updateCourseProgress } from '@/lib/courseProgress';

// Course tier requirement — this course requires at least "obturador"
const COURSE_REQUIRED_TIER: SubscriptionTier = 'obturador';

// Course metadata used for progress tracking
const COURSE_META = {
  id: 'iluminacion-rembrandt-retrato',
  title: 'Iluminación Rembrandt para Retrato',
  instructor: 'Carlos Mendoza',
  thumbnail: 'https://img.rocket.new/generatedImages/rocket_gen_img_15ec41795-1785194269875.png',
  thumbnailAlt: 'Studio photography lesson showing Rembrandt lighting technique with professional strobe setup',
  // Total duration in seconds (sum of all chapters)
  totalSeconds: 202 * 60
};

// Current lesson id and duration
const CURRENT_LESSON_ID = 'lesson-004';
const CURRENT_LESSON_SECONDS = 14 * 60 + 32;

// Token refresh interval: refresh 10 minutes before expiry (50 min)
const TOKEN_REFRESH_MS = 50 * 60 * 1000;

const chapters = [
{ id: 'ch-001', number: 1, title: 'Introducción al Esquema Rembrandt', duration: '08:42', completed: true, current: false },
{ id: 'ch-002', number: 2, title: 'Historia y Origen de la Técnica', duration: '12:15', completed: true, current: false },
{ id: 'ch-003', number: 3, title: 'Equipamiento Necesario', duration: '09:30', completed: true, current: false },
{ id: 'ch-004', number: 4, title: 'Configuración del Key Light', duration: '14:32', completed: false, current: true },
{ id: 'ch-005', number: 5, title: 'Posicionamiento del Modelo', duration: '11:18', completed: false, current: false },
{ id: 'ch-006', number: 6, title: 'Ajuste del Fill Light', duration: '16:45', completed: false, current: false },
{ id: 'ch-007', number: 7, title: 'El Triángulo de Luz en la Mejilla', duration: '13:22', completed: false, current: false },
{ id: 'ch-008', number: 8, title: 'Variantes del Esquema', duration: '18:00', completed: false, current: false },
{ id: 'ch-009', number: 9, title: 'Combinando con Luz de Borde', duration: '22:10', completed: false, current: false },
{ id: 'ch-010', number: 10, title: 'Sesión Práctica en Estudio', duration: '31:40', completed: false, current: false },
{ id: 'ch-011', number: 11, title: 'Edición Post-Producción', duration: '25:15', completed: false, current: false },
{ id: 'ch-012', number: 12, title: 'Proyecto Final y Revisión', duration: '19:08', completed: false, current: false }];


const resources = [
{ id: 'res-001', name: 'Archivo RAW — Lección 4 (Canon 5D MkIV)', size: '48.2 MB', type: 'RAW', tier: 'obturador' as SubscriptionTier, icon: 'DocumentArrowDownIcon' },
{ id: 'res-002', name: 'Esquema de Iluminación Rembrandt — PDF', size: '2.8 MB', type: 'PDF', tier: 'obturador' as SubscriptionTier, icon: 'DocumentTextIcon' },
{ id: 'res-003', name: 'Preset Lightroom — Tonos Cálidos Retrato', size: '1.1 MB', type: 'PRESET', tier: 'obturador' as SubscriptionTier, icon: 'SwatchIcon' },
{ id: 'res-004', name: 'LUT Cinematográfico — Rembrandt Gold', size: '0.8 MB', type: 'LUT', tier: 'diafragma' as SubscriptionTier, icon: 'FilmIcon' },
{ id: 'res-005', name: 'Archivo RAW — Sesión Completa (12 tomas)', size: '312 MB', type: 'RAW', tier: 'diafragma' as SubscriptionTier, icon: 'DocumentArrowDownIcon' }];


interface LockOverlayProps {
  requiredTier: SubscriptionTier;
  userTier: SubscriptionTier;
  isAuthenticated: boolean;
  onClose: () => void;
  resourceName?: string;
}

function LockOverlay({ requiredTier, userTier, isAuthenticated, onClose, resourceName }: LockOverlayProps) {
  const tierLabel = requiredTier ? TIER_LABELS[requiredTier] : '';
  const tierPrice = requiredTier ? TIER_PRICES[requiredTier] : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
        requiredTier === 'diafragma' ? 'tier-badge-diafragma' : 'tier-badge-obturador'}`
        }>
          <Icon name="LockClosedIcon" size={22} className={requiredTier === 'diafragma' ? 'text-purple-400' : 'text-amber-400'} />
        </div>
        <h3 className="text-lg font-700 text-foreground text-center mb-2">Contenido Exclusivo</h3>
        {resourceName &&
        <p className="text-sm text-muted-foreground text-center mb-1">
            <span className="text-foreground font-500">{resourceName}</span>
          </p>
        }
        {!isAuthenticated ?
        <>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Inicia sesión para acceder a este contenido.
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/sign-up-login" className="btn-primary py-2.5 text-sm text-center font-700" onClick={onClose}>
                Iniciar Sesión
              </Link>
              <button onClick={onClose} className="btn-ghost py-2.5 text-sm font-600">Cancelar</button>
            </div>
          </> :

        <>
            <p className="text-sm text-muted-foreground text-center mb-1">
              {userTier ?
            `Tu plan actual es ${TIER_LABELS[userTier]}.` :
            'No tienes una suscripción activa.'}
            </p>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Este recurso requiere el{' '}
              <span className={requiredTier === 'diafragma' ? 'text-purple-400 font-600' : 'text-amber-400 font-600'}>
                {tierLabel}
              </span>{' '}
              ({tierPrice}).
            </p>
            <div className="flex flex-col gap-2">
              <Link
              href="/account-subscription-management"
              className="btn-primary py-2.5 text-sm text-center font-700"
              onClick={onClose}>
              
                Actualizar a {tierLabel}
              </Link>
              <button onClick={onClose} className="btn-ghost py-2.5 text-sm font-600">Cancelar</button>
            </div>
          </>
        }
      </div>
    </div>);

}

interface CourseAccessBlockProps {
  isAuthenticated: boolean;
  userTier: SubscriptionTier;
  requiredTier: SubscriptionTier;
}

function CourseAccessBlock({ isAuthenticated, userTier, requiredTier }: CourseAccessBlockProps) {
  const tierLabel = requiredTier ? TIER_LABELS[requiredTier] : '';
  const tierPrice = requiredTier ? TIER_PRICES[requiredTier] : '';

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="text-center px-6 max-w-md">
        <div className="w-16 h-16 rounded-full tier-badge-obturador flex items-center justify-center mx-auto mb-4">
          <Icon name="LockClosedIcon" size={28} className="text-amber-400" />
        </div>
        <h2 className="text-xl font-700 text-white mb-2">Acceso Restringido</h2>
        {!isAuthenticated ?
        <>
            <p className="text-sm text-white/70 mb-6">
              Inicia sesión para ver este curso.
            </p>
            <Link href="/sign-up-login" className="btn-primary px-6 py-3 text-sm font-700 inline-block">
              Iniciar Sesión
            </Link>
          </> :

        <>
            <p className="text-sm text-white/70 mb-2">
              {userTier ?
            `Tu plan actual es ${TIER_LABELS[userTier]}.` :
            'No tienes una suscripción activa.'}
            </p>
            <p className="text-sm text-white/70 mb-6">
              Este curso requiere el{' '}
              <span className="text-amber-400 font-600">{tierLabel}</span>{' '}
              ({tierPrice}) o superior.
            </p>
            <Link
            href="/account-subscription-management"
            className="btn-primary px-6 py-3 text-sm font-700 inline-block">
            
              Actualizar a {tierLabel}
            </Link>
          </>
        }
      </div>
    </div>);

}

export default function VideoPlayerScreen() {
  const { user, loading: authLoading } = useAuth();
  const [userTier, setUserTier] = useState<SubscriptionTier>(null);
  const [tierLoading, setTierLoading] = useState(true);

  // Secure video URL state
  const [secureVideoUrl, setSecureVideoUrl] = useState<string | null>(null);
  const [videoUrlLoading, setVideoUrlLoading] = useState(false);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chapters' | 'resources'>('chapters');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [speed, setSpeed] = useState('1x');
  const [quality, setQuality] = useState('1080p');
  const [progress, setProgress] = useState(38);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockedResource, setLockedResource] = useState<{name: string;tier: SubscriptionTier;}>({ name: '', tier: null });

  // Progress tracking state
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const progressFiredRef = useRef(false);
  const playStartTimeRef = useRef<number | null>(null);
  const accumulatedSecondsRef = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTierLoading(false);
      return;
    }
    getUserSubscriptionTier().then((tier) => {
      setUserTier(tier);
      setTierLoading(false);
    });
  }, [user, authLoading]);

  const canAccessCourse = hasAccess(userTier, COURSE_REQUIRED_TIER);
  const isAuthenticated = !!user;
  const isLoading = authLoading || tierLoading;

  /**
   * Fetch a signed video URL from the server-side API.
   * The URL expires in 1 hour; we schedule a refresh every 50 minutes.
   */
  const fetchSecureVideoUrl = useCallback(async () => {
    if (!user || !canAccessCourse) return;
    setVideoUrlLoading(true);
    try {
      const res = await fetch(
        `/api/video-token?courseId=${COURSE_META.id}&lessonId=${CURRENT_LESSON_ID}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.url) {
        setSecureVideoUrl(data.url);
        // Schedule next refresh before the token expires
        if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = setTimeout(fetchSecureVideoUrl, TOKEN_REFRESH_MS);
      }
    } catch {
      // Silently fail — video will fall back to thumbnail placeholder
    } finally {
      setVideoUrlLoading(false);
    }
  }, [user, canAccessCourse]);

  // Fetch secure URL once user has access
  useEffect(() => {
    if (!isLoading && canAccessCourse && user) {
      fetchSecureVideoUrl();
    }
    return () => {
      if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);
    };
  }, [isLoading, canAccessCourse, user, fetchSecureVideoUrl]);

  // Track accumulated watch time while playing
  useEffect(() => {
    if (!canAccessCourse || !user) return;

    if (playing) {
      playStartTimeRef.current = Date.now();
    } else {
      if (playStartTimeRef.current !== null) {
        const elapsed = Math.floor((Date.now() - playStartTimeRef.current) / 1000);
        accumulatedSecondsRef.current += elapsed;
        playStartTimeRef.current = null;
      }
    }
  }, [playing, canAccessCourse, user]);

  // Simulate video progress when playing
  useEffect(() => {
    if (!playing || !canAccessCourse) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 0.5;
        if (next >= 100) {
          clearInterval(interval);
          handleVideoEnd();
          return 100;
        }
        return next;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [playing, canAccessCourse]);

  const fireProgressUpdate = useCallback(async (markComplete: boolean) => {
    if (!user) return;

    // Flush any remaining play time
    if (playStartTimeRef.current !== null) {
      const elapsed = Math.floor((Date.now() - playStartTimeRef.current) / 1000);
      accumulatedSecondsRef.current += elapsed;
      playStartTimeRef.current = null;
    }

    const additionalSeconds = accumulatedSecondsRef.current > 0 ?
    accumulatedSecondsRef.current :
    markComplete ?
    CURRENT_LESSON_SECONDS :
    0;

    if (additionalSeconds === 0 && !markComplete) return;

    try {
      await updateCourseProgress({
        userId: user.id,
        courseId: COURSE_META.id,
        courseTitle: COURSE_META.title,
        courseInstructor: COURSE_META.instructor,
        courseThumbnail: COURSE_META.thumbnail,
        courseThumbnailAlt: COURSE_META.thumbnailAlt,
        additionalSeconds,
        totalSeconds: COURSE_META.totalSeconds,
        completed: markComplete
      });
      accumulatedSecondsRef.current = 0;
    } catch {

      // silently fail — don't interrupt the user experience
    }}, [user]);

  const handleVideoEnd = useCallback(async () => {
    if (progressFiredRef.current) return;
    progressFiredRef.current = true;
    setPlaying(false);
    setLessonCompleted(true);
    await fireProgressUpdate(false);
    toast.success('¡Lección completada! Tu progreso ha sido guardado.');
  }, [fireProgressUpdate]);

  const handleMarkLessonComplete = async () => {
    if (lessonCompleted || markingComplete || !user) return;
    setMarkingComplete(true);
    setLessonCompleted(true);
    progressFiredRef.current = true;
    await fireProgressUpdate(true);
    setMarkingComplete(false);
    toast.success('¡Lección marcada como completada!');
  };

  const handleDownload = (res: typeof resources[0]) => {
    const resourceLocked = !hasAccess(userTier, res.tier);
    if (!isAuthenticated || resourceLocked) {
      setLockedResource({ name: res.name, tier: res.tier });
      setShowLockModal(true);
      return;
    }
    toast.success(`Descargando ${res.name}…`);
  };

  const handleChapterClick = (ch: typeof chapters[0]) => {
    if (!canAccessCourse) {
      setLockedResource({ name: ch.title, tier: COURSE_REQUIRED_TIER });
      setShowLockModal(true);
      return;
    }
    toast.info(`Saltando a: ${ch.title}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mini topbar */}
      <header className="h-14 glass-nav flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="ArrowLeftIcon" size={18} />
            <span className="text-sm font-500 hidden sm:block">Volver al Dashboard</span>
          </Link>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <span>/</span>
            <Link href="/course-detail" className="hover:text-foreground transition-colors">
              Iluminación Rembrandt para Retrato
            </Link>
            <span>/</span>
            <span className="text-foreground font-500">Lección 4</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AppLogo size={24} />
          <span className="font-700 text-sm text-foreground hidden sm:block">Glewstudio</span>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300`}>
          {/* Player */}
          <div className="relative bg-black w-full" style={{ aspectRatio: '16/9' }}>
            <AppImage
              src="https://img.rocket.new/generatedImages/rocket_gen_img_15ec41795-1785194269875.png"
              alt="Studio photography lesson showing Rembrandt lighting technique with professional strobe setup"
              fill
              priority
              className="object-cover"
              sizes="100vw" />
            

            {/* Loading state */}
            {isLoading &&
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            }

            {/* Course access block overlay */}
            {!isLoading && !canAccessCourse &&
            <CourseAccessBlock
              isAuthenticated={isAuthenticated}
              userTier={userTier}
              requiredTier={COURSE_REQUIRED_TIER} />

            }

            {/* Lesson completed overlay */}
            {!isLoading && canAccessCourse && lessonCompleted && progress >= 100 &&
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mb-4">
                  <Icon name="CheckIcon" size={32} className="text-primary" />
                </div>
                <p className="text-white font-700 text-lg mb-1">¡Lección Completada!</p>
                <p className="text-white/60 text-sm mb-6">Tu progreso ha sido guardado</p>
                <Link href="/video-player" className="btn-primary px-6 py-2.5 text-sm font-700 flex items-center gap-2">
                  <Icon name="ForwardIcon" size={16} />
                  Siguiente Lección
                </Link>
              </div>
            }

            {/* Play/Pause overlay — only when user has access */}
            {!isLoading && canAccessCourse && !lessonCompleted &&
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer group"
              onClick={() => setPlaying(!playing)}>
              
                <div className={`w-16 h-16 rounded-full bg-black/50 border-2 border-white/30 flex items-center justify-center transition-opacity ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                  <Icon name={playing ? 'PauseIcon' : 'PlayIcon'} size={28} className="text-white ml-1" />
                </div>
              </div>
            }

            {/* Controls bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-8">
              {/* Progress */}
              <div className="mb-3 group cursor-pointer">
                <div className="h-1 bg-white/20 rounded-full overflow-hidden group-hover:h-1.5 transition-all">
                  <div className="h-full progress-bar" style={{ width: `${canAccessCourse ? progress : 0}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => canAccessCourse && !lessonCompleted && setPlaying(!playing)}
                    className="text-white hover:text-primary transition-colors"
                    aria-label={playing ? 'Pausar' : 'Reproducir'}>
                    
                    <Icon name={playing ? 'PauseIcon' : 'PlayIcon'} size={22} />
                  </button>
                  <button className="text-white/70 hover:text-white transition-colors" aria-label="Anterior">
                    <Icon name="BackwardIcon" size={18} />
                  </button>
                  <button className="text-white/70 hover:text-white transition-colors" aria-label="Siguiente">
                    <Icon name="ForwardIcon" size={18} />
                  </button>
                  <button className="text-white/70 hover:text-white transition-colors" aria-label="Silenciar">
                    <Icon name="SpeakerWaveIcon" size={18} />
                  </button>
                  <span className="text-white/70 text-xs font-mono">
                    {canAccessCourse ? '05:32 / 14:32' : '00:00 / 14:32'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Speed selector */}
                  <div className="relative">
                    <button
                      onClick={() => {setShowSpeedMenu(!showSpeedMenu);setShowQualityMenu(false);}}
                      className="text-white/70 hover:text-white text-xs font-600 px-2 py-1 rounded border border-white/20 hover:border-white/40 transition-colors">
                      
                      {speed}
                    </button>
                    {showSpeedMenu &&
                    <div className="absolute bottom-8 right-0 bg-card border border-border rounded-lg overflow-hidden shadow-xl z-20">
                        {['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'].map((s) =>
                      <button
                        key={`speed-${s}`}
                        onClick={() => {setSpeed(s);setShowSpeedMenu(false);}}
                        className={`block w-full px-4 py-2 text-xs text-left hover:bg-muted transition-colors ${s === speed ? 'text-primary font-700' : 'text-foreground'}`}>
                        
                            {s}
                          </button>
                      )}
                      </div>
                    }
                  </div>

                  {/* Quality selector */}
                  <div className="relative">
                    <button
                      onClick={() => {setShowQualityMenu(!showQualityMenu);setShowSpeedMenu(false);}}
                      className="text-white/70 hover:text-white text-xs font-600 px-2 py-1 rounded border border-white/20 hover:border-white/40 transition-colors">
                      
                      {quality}
                    </button>
                    {showQualityMenu &&
                    <div className="absolute bottom-8 right-0 bg-card border border-border rounded-lg overflow-hidden shadow-xl z-20">
                        {['720p', '1080p', '4K'].map((q) =>
                      <button
                        key={`quality-${q}`}
                        onClick={() => {setQuality(q);setShowQualityMenu(false);}}
                        className={`block w-full px-4 py-2 text-xs text-left hover:bg-muted transition-colors ${q === quality ? 'text-primary font-700' : 'text-foreground'}`}>
                        
                            {q}
                            {q === '4K' && <span className="ml-2 text-xs tier-badge-diafragma px-1 rounded">Master</span>}
                          </button>
                      )}
                      </div>
                    }
                  </div>

                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="text-white/70 hover:text-white transition-colors"
                    aria-label="Mostrar/ocultar sidebar">
                    
                    <Icon name="QueueListIcon" size={18} />
                  </button>
                  <button className="text-white/70 hover:text-white transition-colors" aria-label="Pantalla completa">
                    <Icon name="ArrowsPointingOutIcon" size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Below player */}
          <div className="flex-1 overflow-y-auto p-6 max-w-screen-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TierBadge tier="obturador" size="sm" />
                  <span className="text-xs text-muted-foreground">Lección 4 de 12</span>
                  {/* Show user's current tier badge */}
                  {!isLoading && userTier &&
                  <span className="text-xs text-muted-foreground">
                      · Tu plan: <span className="text-foreground font-600">{TIER_LABELS[userTier]}</span>
                    </span>
                  }
                </div>
                <h1 className="text-xl font-700 text-foreground mb-1">Configuración del Key Light</h1>
                <p className="text-sm text-muted-foreground">
                  Curso: Iluminación Rembrandt para Retrato · Carlos Mendoza
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Mark as complete button */}
                {canAccessCourse && user &&
                <button
                  onClick={handleMarkLessonComplete}
                  disabled={lessonCompleted || markingComplete}
                  className={`px-3 py-1.5 text-xs flex items-center gap-1.5 rounded-lg border font-600 transition-all duration-200 ${
                  lessonCompleted ?
                  'bg-green-500/10 text-green-400 border-green-500/30 cursor-default' : 'btn-ghost hover:border-primary/40 hover:text-primary'}`
                  }>
                  
                    {markingComplete ?
                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> :

                  <Icon name={lessonCompleted ? 'CheckCircleIcon' : 'CheckIcon'} size={14} />
                  }
                    {lessonCompleted ? 'Completada' : 'Marcar como completada'}
                  </button>
                }
                <button className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5">
                  <Icon name="BookmarkIcon" size={14} />
                  Guardar
                </button>
                <button className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5">
                  <Icon name="ShareIcon" size={14} />
                  Compartir
                </button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-2xl">
              En esta lección aprenderás a posicionar correctamente el Key Light para lograr el triángulo de Rembrandt en la mejilla del modelo. Veremos ángulos, distancias y el uso de modificadores para suavizar o endurecer la luz según el resultado deseado.
            </p>

            {/* Next lesson */}
            <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl max-w-lg">
              <div className="relative w-20 h-12 rounded-lg overflow-hidden shrink-0">
                <AppImage
                  src="https://img.rocket.new/generatedImages/rocket_gen_img_15ec41795-1785194269875.png"
                  alt="Next lesson preview showing model positioning technique for Rembrandt lighting"
                  fill
                  className="object-cover"
                  sizes="80px" />
                
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Siguiente lección</p>
                <p className="text-sm font-600 text-foreground truncate">Posicionamiento del Modelo</p>
                <p className="text-xs text-muted-foreground">11:18 min</p>
              </div>
              <Link href="/video-player" className="btn-primary px-3 py-1.5 text-xs shrink-0">
                Siguiente
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {sidebarOpen &&
        <aside className="w-80 xl:w-96 shrink-0 border-l border-border flex flex-col bg-card overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border">
              {(['chapters', 'resources'] as const).map((tab) =>
            <button
              key={`player-tab-${tab}`}
              onClick={() => setSidebarTab(tab)}
              className={`flex-1 py-3.5 text-sm font-600 transition-colors ${
              sidebarTab === tab ?
              'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`
              }>
              
                  {tab === 'chapters' ? 'Capítulos' : 'Recursos'}
                </button>
            )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {sidebarTab === 'chapters' &&
            <div className="p-2">
                  {chapters.map((ch) => {
                const chLocked = !canAccessCourse;
                const isCurrentCompleted = ch.current && lessonCompleted;
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleChapterClick(ch)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg mb-1 text-left transition-colors ${
                    ch.current && canAccessCourse ?
                    'bg-primary/10 border border-primary/20' : 'hover:bg-muted'}`
                    }>
                    
                        <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
                    chLocked ?
                    'border border-border' :
                    ch.completed || isCurrentCompleted ?
                    'bg-primary text-primary-foreground' :
                    ch.current ?
                    'border-2 border-primary' : 'border border-border'}`
                    }>
                          {chLocked ?
                      <Icon name="LockClosedIcon" size={10} className="text-muted-foreground" /> :
                      ch.completed || isCurrentCompleted ?
                      <Icon name="CheckIcon" size={12} /> :
                      ch.current ?
                      <div className="w-2 h-2 bg-primary rounded-full" /> :

                      <span className="text-xs text-muted-foreground">{ch.number}</span>
                      }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-500 truncate ${
                      chLocked ?
                      'text-muted-foreground' :
                      ch.current ?
                      'text-primary' :
                      ch.completed || isCurrentCompleted ?
                      'text-muted-foreground' :
                      'text-foreground'}`
                      }>
                            {ch.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{ch.duration}</p>
                        </div>
                        {ch.current && canAccessCourse && !lessonCompleted &&
                    <div className="shrink-0 w-1.5 h-8 bg-primary rounded-full mt-0.5" />
                    }
                      </button>);

              })}
                </div>
            }

              {sidebarTab === 'resources' &&
            <div className="p-4">
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    Archivos descargables para esta lección. Los recursos marcados requieren Plan Diafragma.
                  </p>
                  {/* Subscription status indicator */}
                  {!isLoading &&
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-xs ${
              canAccessCourse ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`
              }>
                      <Icon name={canAccessCourse ? 'CheckCircleIcon' : 'LockClosedIcon'} size={13} />
                      <span>
                        {isAuthenticated ?
                  userTier ?
                  `Plan activo: ${TIER_LABELS[userTier]}` :
                  'Sin suscripción activa' : 'Inicia sesión para descargar'}
                      </span>
                    </div>
              }
                  <div className="flex flex-col gap-3">
                    {resources.map((res) => {
                  const resLocked = !hasAccess(userTier, res.tier);
                  return (
                    <div
                      key={res.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                      resLocked ?
                      'border-border opacity-60' : 'border-border hover:border-primary/30 hover:bg-primary/5'}`
                      }>
                      
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      resLocked ? 'bg-muted' : 'bg-primary/10'}`
                      }>
                            <Icon
                          name={res.icon as any}
                          size={18}
                          className={resLocked ? 'text-muted-foreground' : 'text-primary'} />
                        
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-600 text-foreground truncate">{res.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">{res.size}</span>
                              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-600">
                                {res.type}
                              </span>
                              {res.tier &&
                          <span className={`text-xs px-1.5 py-0.5 rounded font-600 ${
                          res.tier === 'diafragma' ? 'tier-badge-diafragma' : 'tier-badge-obturador'}`
                          }>
                                  {res.tier === 'diafragma' ? 'Master' : 'Pro'}
                                </span>
                          }
                            </div>
                          </div>
                          <button
                        onClick={() => handleDownload(res)}
                        className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        resLocked ?
                        'bg-muted cursor-not-allowed' : 'bg-primary/10 hover:bg-primary/20 text-primary'}`
                        }
                        aria-label={resLocked ? 'Contenido bloqueado' : `Descargar ${res.name}`}>
                        
                            <Icon
                          name={resLocked ? 'LockClosedIcon' : 'ArrowDownTrayIcon'}
                          size={14}
                          className={resLocked ? 'text-muted-foreground' : 'text-primary'} />
                        
                          </button>
                        </div>);

                })}
                  </div>
                </div>
            }
            </div>
          </aside>
        }
      </div>

      {/* Lock Modal */}
      {showLockModal &&
      <LockOverlay
        requiredTier={lockedResource.tier}
        userTier={userTier}
        isAuthenticated={isAuthenticated}
        onClose={() => setShowLockModal(false)}
        resourceName={lockedResource.name} />

      }
    </div>);

}