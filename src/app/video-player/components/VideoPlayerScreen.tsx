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

import { createClient } from '@/lib/supabase/client';
import { generateSignedVideoUrl, saveVideoProgress } from '@/app/actions/video';
import LessonResources from '@/components/LessonResources';

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

// Token refresh interval: refresh 10 minutes before expiry (110 min for 2-hour tokens)
const TOKEN_REFRESH_MS = 110 * 60 * 1000;

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


// Resources are now loaded dynamically from Supabase via LessonResources component


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

  // Native video element ref for real playback tracking
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
  // Ref to suppress real-time echo when this device is the one writing
  const isLocalWriteRef = useRef(false);
  // Track whether 90% auto-complete has already been triggered
  const autoCompleteTriggeredRef = useRef(false);

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
   * Fetch a signed video URL using the Server Action.
   * The URL expires in 2 hours; we schedule a refresh every 110 minutes.
   */
  const fetchSecureVideoUrl = useCallback(async () => {
    if (!user || !canAccessCourse) return;
    setVideoUrlLoading(true);
    try {
      const result = await generateSignedVideoUrl(COURSE_META.id, CURRENT_LESSON_ID);
      if (result.url) {
        setSecureVideoUrl(result.url);
        // Schedule next refresh before the 2-hour token expires
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

  // Track accumulated watch time while playing (for simulated progress fallback)
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

  // Simulate video progress when playing (only when no real video URL is available)
  useEffect(() => {
    if (!playing || !canAccessCourse || secureVideoUrl) return;
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
  }, [playing, canAccessCourse, secureVideoUrl]);

  /**
   * Handle real video timeupdate events.
   * - Updates progress bar from actual currentTime / duration
   * - Auto-marks lesson complete when 90% of the video has been watched
   */
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !canAccessCourse || !user) return;

    const { currentTime, duration } = video;
    if (!duration || duration === 0) return;

    const pct = Math.min(100, Math.round((currentTime / duration) * 100));
    setProgress(pct);

    // Auto-mark complete at 90%
    if (pct >= 90 && !autoCompleteTriggeredRef.current && !progressFiredRef.current) {
      autoCompleteTriggeredRef.current = true;
      progressFiredRef.current = true;
      setLessonCompleted(true);

      // Flush accumulated seconds from real playback
      const additionalSeconds = Math.floor(currentTime);
      accumulatedSecondsRef.current = 0;

      isLocalWriteRef.current = true;
      saveVideoProgress({
        courseId: COURSE_META.id,
        courseTitle: COURSE_META.title,
        courseInstructor: COURSE_META.instructor,
        courseThumbnail: COURSE_META.thumbnail,
        courseThumbnailAlt: COURSE_META.thumbnailAlt,
        additionalSeconds,
        totalSeconds: COURSE_META.totalSeconds,
        markComplete: true,
      }).then(() => {
        setTimeout(() => { isLocalWriteRef.current = false; }, 1500);
      });

      toast.success('¡Lección completada! Tu progreso ha sido guardado.');
    }
  }, [canAccessCourse, user]);

  const fireProgressUpdate = useCallback(async (markComplete: boolean) => {
    if (!user) return;

    // Flush any remaining play time
    if (playStartTimeRef.current !== null) {
      const elapsed = Math.floor((Date.now() - playStartTimeRef.current) / 1000);
      accumulatedSecondsRef.current += elapsed;
      playStartTimeRef.current = null;
    }

    // If real video is available, use its currentTime instead
    const videoEl = videoRef.current;
    const additionalSeconds = videoEl
      ? Math.floor(videoEl.currentTime)
      : accumulatedSecondsRef.current > 0
      ? accumulatedSecondsRef.current
      : markComplete
      ? CURRENT_LESSON_SECONDS
      : 0;

    if (additionalSeconds === 0 && !markComplete) return;

    try {
      isLocalWriteRef.current = true;
      await saveVideoProgress({
        courseId: COURSE_META.id,
        courseTitle: COURSE_META.title,
        courseInstructor: COURSE_META.instructor,
        courseThumbnail: COURSE_META.thumbnail,
        courseThumbnailAlt: COURSE_META.thumbnailAlt,
        additionalSeconds,
        totalSeconds: COURSE_META.totalSeconds,
        markComplete,
      });
      accumulatedSecondsRef.current = 0;
    } catch {
      // silently fail — don't interrupt the user experience
    } finally {
      setTimeout(() => { isLocalWriteRef.current = false; }, 1500);
    }
  }, [user]);

  const handleVideoEnd = useCallback(async () => {
    if (progressFiredRef.current) return;
    progressFiredRef.current = true;
    setPlaying(false);
    setLessonCompleted(true);
    await fireProgressUpdate(true);
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

  // Sync playback rate when speed changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const rate = parseFloat(speed.replace('x', ''));
    if (!isNaN(rate)) video.playbackRate = rate;
  }, [speed]);

  // Sync play/pause state with native video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !secureVideoUrl) return;
    if (playing) {
      video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }, [playing, secureVideoUrl]);

  const handleChapterClick = (ch: typeof chapters[0]) => {
    if (!canAccessCourse) {
      setLockedResource({ name: ch.title, tier: COURSE_REQUIRED_TIER });
      setShowLockModal(true);
      return;
    }
    toast.info(`Saltando a: ${ch.title}`);
  };

  // Real-time subscription: sync progress from other devices
  useEffect(() => {
    if (!user || !canAccessCourse) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`course_progress_${user.id}_${COURSE_META.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'course_progress',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (isLocalWriteRef.current) return;

          const row = payload.new as {
            course_id?: string;
            watched_seconds?: number;
            total_seconds?: number;
            completed?: boolean;
          } | null;

          if (!row || row.course_id !== COURSE_META.id) return;

          const watchedSec = row.watched_seconds ?? 0;
          const totalSec = row.total_seconds ?? COURSE_META.totalSeconds;
          const remoteCompleted = row.completed ?? false;

          if (totalSec > 0) {
            const pct = Math.min(100, Math.round((watchedSec / totalSec) * 100));
            setProgress(pct);
          }

          if (remoteCompleted && !progressFiredRef.current) {
            progressFiredRef.current = true;
            setLessonCompleted(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, canAccessCourse]);

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

            {/* Native video element — shown when signed URL is available */}
            {secureVideoUrl && canAccessCourse && (
              <video
                ref={videoRef}
                src={secureVideoUrl}
                className="absolute inset-0 w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleVideoEnd}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                controlsList="nodownload"
                disablePictureInPicture={false}
                playsInline
              />
            )}

            {/* Thumbnail fallback — shown when no signed URL yet */}
            {!secureVideoUrl && (
              <AppImage
                src="https://img.rocket.new/generatedImages/rocket_gen_img_15ec41795-1785194269875.png"
                alt="Studio photography lesson showing Rembrandt lighting technique with professional strobe setup"
                fill
                priority
                className="object-cover"
                sizes="100vw" />
            )}

            {/* Loading state */}
            {(isLoading || videoUrlLoading) &&
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
            {!isLoading && canAccessCourse && lessonCompleted && progress >= 90 &&
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
            <LessonResources
                  courseId={COURSE_META.id}
                  lessonId={CURRENT_LESSON_ID}
                  userTier={userTier}
                  isAuthenticated={isAuthenticated}
                  isLoading={isLoading}
                />
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