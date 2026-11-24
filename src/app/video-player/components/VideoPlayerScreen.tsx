'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserSubscriptionTier,
  hasAccess,
  canAccessCourse as checkCanAccessCourse,
  TIER_LABELS,
  TIER_PRICES,
  type SubscriptionTier,
  type CourseAccessType,
} from '@/lib/subscription';
import { updateCourseProgress } from '@/lib/courseProgress';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ─── Video Provider Types ──────────────────────────────────────────────────────
type VideoProvider = 'supabase' | 'bunny' | 'vimeo';

interface LessonVideoData {
  provider: VideoProvider;
  videoAssetId: string;
  isFreePreview: boolean;
  courseId?: string;
  lessonId?: string;
}

// ─── Types for Supabase Data ───────────────────────────────────────────────────
interface CourseLesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  duration_seconds: number;
  position: number;
  video_provider: VideoProvider;
  video_asset_id: string | null;
  is_free_preview: boolean;
}

interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  lessons: CourseLesson[];
}

interface LessonResource {
  id: string;
  course_id: string;
  lesson_id: string;
  file_name: string;
  display_name: string;
  file_type: string;
  file_size: string | null;
  storage_path: string;
  required_tier: string;
  sort_order: number;
}

// Instructor can be either a string (legacy) or an object from the API
interface InstructorObject {
  id: string;
  name: string;
  specialty: string | null;
  tags: string[] | null;
  bio: string | null;
  photo_url: string | null;
  photo_alt: string | null;
  created_at: string;
  updated_at: string;
}

interface CourseData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructor: string | InstructorObject;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  access_type: CourseAccessType;
  minimum_tier: 'free' | 'apertura' | 'obturador' | 'diafragma' | null;
  price: number | null;
  rating: number | null;
  category: { id: string; name: string; slug: string } | null;
  modules: CourseModule[];
  resources: LessonResource[];
}

// ─── Chapter type for UI (flattened lessons with module info) ──────────────────
interface Chapter {
  id: string;
  moduleId: string;
  moduleTitle: string;
  number: number;
  title: string;
  description: string | null;
  duration: string;
  duration_seconds: number;
  completed: boolean;
  current: boolean;
  isFreePreview: boolean;
  videoProvider: VideoProvider;
  videoAssetId: string | null;
}

// ─── Resource type for UI ──────────────────────────────────────────────────────
interface ResourceItem {
  id: string;
  lessonId: string;
  name: string;
  size: string;
  type: string;
  tier: SubscriptionTier;
  icon: string;
  storagePath?: string;
}

// ─── Vimeo URL Helper ──────────────────────────────────────────────────────────
function extractVimeoId(input: string): string {
  if (!input) return '';
  if (/^\d+$/.test(input.trim())) return input.trim();
  const patterns = [/vimeo\.com\/(\d+)/, /player\.vimeo\.com\/video\/(\d+)/, /vimeo\.com\/(\d+)\//];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) return match[1];
  }
  return input.trim();
}

function buildVimeoIframeUrl(vimeoId: string): string {
  // Add api=1 for postMessage communication to get duration
  // Ocultar elementos de la interfaz de Vimeo: título, autor, retrato, barra lateral, insignia y fondo transparente
  return `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0&sidedock=0&badge=0&transparent=0&api=1`;
}

// ─── Vimeo Duration Helper ───────────────────────────────────────────────────────
async function fetchVimeoDuration(vimeoId: string): Promise<number | null> {
  try {
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoId}`);
    if (res.ok) {
      const data = await res.json();
      // duration is in seconds
      return data.duration ? Math.round(data.duration) : null;
    }
  } catch {
    // Ignore errors, return null
  }
  return null;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getResourceIcon(fileType: string): string {
  switch (fileType.toUpperCase()) {
    case 'PDF':
      return 'DocumentTextIcon';
    case 'XMP':
    case 'LRT':
    case 'PRESET':
      return 'SwatchIcon';
    case 'RAW':
    case 'NEF':
    case 'CR2':
    case 'ARW':
    case 'DNG':
    case 'RW2':
    case 'ORF':
    case 'PEF':
      return 'DocumentArrowDownIcon';
    case 'LUT':
    case 'CUBE':
    case '3DL':
    case 'CSP':
      return 'FilmIcon';
    case 'ZIP':
      return 'ArchiveBoxIcon';
    case 'ATN':
      return 'SparklesIcon';
    case 'ICC':
    case 'ICM':
      return 'ColorSwatchIcon';
    default:
      return 'DocumentIcon';
  }
}

// ─── Video Player Component ────────────────────────────────────────────────────
function VideoPlayer({
  videoData,
  playing,
  canAccessCourse,
  lessonCompleted,
  isLoading,
  onVideoEnd,
  currentLesson,
}: {
  videoData: LessonVideoData;
  playing: boolean;
  canAccessCourse: boolean;
  lessonCompleted: boolean;
  isLoading: boolean;
  onVideoEnd: () => void;
  currentLesson: Chapter | null;
}) {
  if (!canAccessCourse || isLoading) {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        {isLoading && (
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>
    );
  }

  const { provider, videoAssetId, isFreePreview, courseId, lessonId } = videoData;

  // Vimeo postMessage handler for auto-completion
  useEffect(() => {
    if (provider !== 'vimeo') return;
    const vimeoId = extractVimeoId(videoAssetId);
    if (!vimeoId) return;

    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // Vimeo player sends events like { event: 'finish' } or { event: 'ended' }
        if (data.event === 'finish' || data.event === 'ended') {
          onVideoEnd();
        }
        // Also handle timeupdate for progress near end
        if (data.event === 'timeupdate' && data.data && data.data.percent >= 0.98) {
          onVideoEnd();
        }
      } catch {
        // Ignore parsing errors
      }
    };

    window.addEventListener('message', handleMessage);

    // Give iframe time to load, then add event listener
    const iframe = document.querySelector(`iframe[src*="${vimeoId}"]`) as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      // Send command to Vimeo player to listen for 'ended' event
      iframe.contentWindow.postMessage(
        JSON.stringify({ method: 'addEventListener', value: 'ended' }),
        '*'
      );
      // Also listen for timeupdate to catch near-end
      iframe.contentWindow.postMessage(
        JSON.stringify({ method: 'addEventListener', value: 'timeupdate' }),
        '*'
      );
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [provider, videoAssetId, onVideoEnd]);

  if (provider === 'vimeo') {
    const vimeoId = extractVimeoId(videoAssetId);
    if (!vimeoId) {
      return (
        <div className="absolute inset-0 bg-black flex items-center justify-center text-white/70">
          <p>Video de Vimeo no configurado</p>
        </div>
      );
    }
    const iframeUrl = buildVimeoIframeUrl(vimeoId);
    return (
      <div className="relative absolute inset-0 w-full h-full" style={{ touchAction: 'none' }}>
        {/* Capa protectora transparente sobre el iframe de Vimeo.
             pointer-events="none" para no interferir con los controles
             de reproducción (play/pausa, tiempo, volumen, pantalla
             completa), mientras impide interacciones accidentales con
             cualquier elemento flotante residual de Vimeo. */}
        <div className="absolute inset-0 z-10" style={{ pointerEvents: 'none' }} />
        {/* Máscara visual en la esquina superior derecha para ocultar
             cualquier botón flotante residual de Vimeo (me gusta, compartir,
             código, logo). Degradado fundido desde el borde derecho hacia
             la izquierda para no parecer un bloque estático. */}
        <div className="absolute top-0 right-0 z-20 w-16 h-48 bg-gradient-to-l from-black/90 via-black/40 to-transparent" />
        <iframe
          src={iframeUrl}
          className="absolute inset-0 w-full h-full pointer-events-auto"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          title="Video de Vimeo"
        />
      </div>
    );
  }

  if (provider === 'bunny') {
    // Bunny.net uses iframe embed similar to Vimeo
    const bunnyVideoId = videoAssetId;
    if (!bunnyVideoId) {
      return (
        <div className="absolute inset-0 bg-black flex items-center justify-center text-white/70">
          <p>Video de Bunny no configurado</p>
        </div>
      );
    }
    const iframeUrl = `https://iframe.mediadelivery.net/embed/${bunnyVideoId}`;
    return (
      <iframe
        src={iframeUrl}
        className="absolute inset-0 w-full h-full pointer-events-auto"
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title="Video de Bunny"
      />
    );
  }

  // For Supabase - use the video token API
  return (
    <video
      className="absolute inset-0 w-full h-full object-cover"
      playsInline
      muted={!playing}
      onEnded={onVideoEnd}
      onPlay={() => {}}
      onPause={() => {}}
    >
      <source src={`/api/video-token?courseId=${courseId}&lessonId=${lessonId}`} type="video/mp4" />
    </video>
  );
}

export default function VideoPlayerScreen() {
  const searchParams = useSearchParams();
  const courseSlug = searchParams.get('course');
  const lessonId = searchParams.get('lesson'); // lesson id from DB

  const { user, loading: authLoading } = useAuth();
  const [userTier, setUserTier] = useState<SubscriptionTier>(null);
  const [tierLoading, setTierLoading] = useState(true);

  // Course data state
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [courseError, setCourseError] = useState<string | null>(null);

  // Player state
  const [playing, setPlaying] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chapters' | 'resources'>('chapters');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [speed, setSpeed] = useState('1x');
  const [quality, setQuality] = useState('1080p');
  const [progress, setProgress] = useState(0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockedResource, setLockedResource] = useState<{ name: string; tier: SubscriptionTier }>({
    name: '',
    tier: null,
  });

  // Current lesson state
  const [currentLesson, setCurrentLesson] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);

  // Vimeo duration fetching state
  const [vimeoDurations, setVimeoDurations] = useState<Record<string, number>>({});

  // Progress tracking state
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);
  const progressFiredRef = useRef(false);
  const playStartTimeRef = useRef<number | null>(null);
  const accumulatedSecondsRef = useRef(0);

  // Fetch user tier
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

  // Fetch course data
  useEffect(() => {
    if (!courseSlug) {
      setCourseError('Curso no especificado');
      setCourseLoading(false);
      return;
    }

    async function fetchCourse() {
      if (!courseSlug) return;
      setCourseLoading(true);
      setCourseError(null);
      try {
        const res = await fetch(`/api/course-player?slug=${encodeURIComponent(courseSlug)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Error al cargar el curso' }));
          throw new Error(err.message || 'Error al cargar el curso');
        }
        const data = await res.json();
        setCourseData(data);
      } catch (err) {
        setCourseError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setCourseLoading(false);
      }
    }

    fetchCourse();
  }, [courseSlug]);

  // Process course data when loaded
  useEffect(() => {
    if (!courseData) return;

    // Flatten all lessons into chapters array with module info
    const allChapters: Chapter[] = [];
    let globalLessonNumber = 1;

    courseData.modules.forEach((module) => {
      module.lessons.forEach((lesson) => {
        allChapters.push({
          id: lesson.id,
          moduleId: module.id,
          moduleTitle: module.title,
          number: globalLessonNumber++,
          title: lesson.title,
          description: lesson.description,
          duration: formatDuration(lesson.duration_seconds),
          duration_seconds: lesson.duration_seconds,
          completed: false, // TODO: fetch from user progress
          current: false,
          isFreePreview: lesson.is_free_preview,
          videoProvider: lesson.video_provider,
          videoAssetId: lesson.video_asset_id,
        });
      });
    });

    setChapters(allChapters);

    // Fetch Vimeo durations for chapters with 0/null duration_seconds
    const vimeoChapters = allChapters.filter(
      (ch) =>
        ch.videoProvider === 'vimeo' &&
        ch.videoAssetId &&
        (!ch.duration_seconds || ch.duration_seconds === 0)
    );
    if (vimeoChapters.length > 0) {
      vimeoChapters.forEach(async (ch) => {
        const vimeoId = extractVimeoId(ch.videoAssetId || '');
        if (vimeoId) {
          const duration = await fetchVimeoDuration(vimeoId);
          if (duration) {
            setVimeoDurations((prev) => ({ ...prev, [ch.id]: duration }));
            // Also update chapters state to reflect new duration
            setChapters((prev) =>
              prev.map((c) =>
                c.id === ch.id
                  ? { ...c, duration_seconds: duration, duration: formatDuration(duration) }
                  : c
              )
            );
          }
        }
      });
    }

    // Find current lesson
    let current: Chapter | null = null;
    if (lessonId) {
      current = allChapters.find((ch) => ch.id === lessonId) || null;
    }
    if (!current && allChapters.length > 0) {
      current = allChapters[0];
    }

    if (current) {
      setCurrentLesson(current);
      // Mark current lesson
      setChapters((prev) => prev.map((ch) => ({ ...ch, current: ch.id === current.id })));
    }

    // Process resources for current lesson
    const lessonResources = courseData.resources.filter((r) => r.lesson_id === current?.id);
    const resourceItems: ResourceItem[] = lessonResources.map((r) => ({
      id: r.id,
      lessonId: r.lesson_id,
      name: r.display_name,
      size: r.file_size || '—',
      type: r.file_type,
      tier: r.required_tier as SubscriptionTier,
      icon: getResourceIcon(r.file_type),
      storagePath: r.storage_path,
    }));
    setResources(resourceItems);
  }, [courseData, lessonId]);

  // Check course access
  const isAuthenticated = !!user;
  const isLoading = authLoading || tierLoading || courseLoading;

  // Normalize instructor to string (handles both string and Instructor object from API)
  const instructorName =
    typeof courseData?.instructor === 'string'
      ? courseData.instructor
      : courseData?.instructor?.name || '';

  const canAccessCourse = courseData
    ? checkCanAccessCourse({
        accessType: courseData.access_type,
        minimumTier: courseData.minimum_tier === 'free' ? null : courseData.minimum_tier,
        userTier,
        isAuthenticated,
        hasPurchased: false, // TODO: check course_purchases
      })
    : false;

  // Track accumulated watch time while playing
  useEffect(() => {
    if (!canAccessCourse || !user || !currentLesson) return;

    if (playing) {
      playStartTimeRef.current = Date.now();
    } else {
      if (playStartTimeRef.current !== null) {
        const elapsed = Math.floor((Date.now() - playStartTimeRef.current) / 1000);
        accumulatedSecondsRef.current += elapsed;
        playStartTimeRef.current = null;
      }
    }
  }, [playing, canAccessCourse, user, currentLesson]);

  // Simulate video progress when playing
  useEffect(() => {
    if (!playing || !canAccessCourse || !currentLesson) return;
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
  }, [playing, canAccessCourse, currentLesson]);

  const fireProgressUpdate = useCallback(
    async (markComplete: boolean) => {
      if (!user || !currentLesson || !courseData) return;

      // Flush any remaining play time
      if (playStartTimeRef.current !== null) {
        const elapsed = Math.floor((Date.now() - playStartTimeRef.current) / 1000);
        accumulatedSecondsRef.current += elapsed;
        playStartTimeRef.current = null;
      }

      const additionalSeconds =
        accumulatedSecondsRef.current > 0
          ? accumulatedSecondsRef.current
          : markComplete
            ? currentLesson.duration_seconds
            : 0;

      if (additionalSeconds === 0 && !markComplete) return;

      try {
        await updateCourseProgress({
          userId: user.id,
          courseId: courseData.id,
          courseTitle: courseData.title,
          courseInstructor: instructorName,
          courseThumbnail: courseData.thumbnail || '',
          courseThumbnailAlt: courseData.thumbnail_alt || '',
          additionalSeconds,
          totalSeconds: courseData.modules.reduce(
            (sum, m) => sum + m.lessons.reduce((s, l) => s + l.duration_seconds, 0),
            0
          ),
          completed: markComplete,
        });
        accumulatedSecondsRef.current = 0;
      } catch {
        // silently fail — don't interrupt the user experience
      }
    },
    [user, currentLesson, courseData]
  );

  const handleVideoEnd = useCallback(async () => {
    if (progressFiredRef.current) return;
    progressFiredRef.current = true;
    setPlaying(false);
    setLessonCompleted(true);
    await fireProgressUpdate(false);
    toast.success('¡Lección completada! Tu progreso ha sido guardado.');
  }, [fireProgressUpdate]);

  const handleMarkLessonComplete = async () => {
    if (lessonCompleted || markingComplete || !user || !currentLesson) return;
    setMarkingComplete(true);
    setLessonCompleted(true);
    progressFiredRef.current = true;
    await fireProgressUpdate(true);
    setMarkingComplete(false);
    toast.success('¡Lección marcada como completada!');
  };

  const handleDownload = async (res: ResourceItem) => {
    const resourceLocked = !hasAccess(userTier, res.tier);
    if (!isAuthenticated || resourceLocked) {
      setLockedResource({ name: res.name, tier: res.tier });
      setShowLockModal(true);
      return;
    }

    // If we have a storage path, generate a signed URL and download
    if (res.storagePath) {
      try {
        const supabase = createClient();

        // Generate a signed URL (valid for 1 hour)
        const { data, error } = await supabase.storage
          .from('resources')
          .createSignedUrl(res.storagePath, 3600);

        if (error) {
          throw new Error(`Error generando URL: ${error.message}`);
        }

        if (data?.signedUrl) {
          // Create a temporary link and trigger download
          const link = document.createElement('a');
          link.href = data.signedUrl;
          link.download = res.name;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          toast.success(`Descargando ${res.name}…`);
        }
      } catch (err) {
        console.error('Error downloading resource:', err);
        toast.error('Error al descargar el recurso');
      }
    } else {
      toast.success(`Descargando ${res.name}…`);
    }
  };

  const handleChapterClick = (ch: Chapter) => {
    if (!canAccessCourse && !ch.isFreePreview) {
      const requiredTier = courseData?.minimum_tier || 'obturador';
      setLockedResource({ name: ch.title, tier: requiredTier as SubscriptionTier });
      setShowLockModal(true);
      return;
    }
    // Navigate to the lesson
    const params = new URLSearchParams();
    params.set('course', courseSlug || '');
    params.set('lesson', ch.id);
    window.location.href = `/video-player?${params.toString()}`;
  };

  // Build video data for current lesson
  const videoData: LessonVideoData = currentLesson
    ? {
        provider: currentLesson.videoProvider,
        videoAssetId: currentLesson.videoAssetId || '',
        isFreePreview: currentLesson.isFreePreview,
        courseId: courseData?.id || '',
        lessonId: currentLesson.id,
      }
    : {
        provider: 'supabase',
        videoAssetId: '',
        isFreePreview: false,
        courseId: '',
        lessonId: '',
      };

  // Check if we should show custom controls (only for supabase provider)
  const showCustomControls = videoData.provider === 'supabase';

  // Check if provider uses iframe (Vimeo, Bunny) - hide all overlays
  const isIframeProvider = videoData.provider === 'vimeo' || videoData.provider === 'bunny';

  // Render loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Render error state
  if (courseError || !courseData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-6">
          <Icon name="ExclamationTriangleIcon" size={48} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-700 text-foreground mb-2">No se pudo cargar el curso</h2>
          <p className="text-muted-foreground mb-6">{courseError || 'Curso no encontrado'}</p>
          <Link href="/courses" className="btn-primary inline-block">
            Volver a Cursos
          </Link>
        </div>
      </div>
    );
  }

  // Render empty state (no lessons)
  if (chapters.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-6">
          <Icon name="FilmIcon" size={48} className="text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-700 text-foreground mb-2">Este curso no tiene lecciones</h2>
          <p className="text-muted-foreground">El instructor aún no ha agregado contenido.</p>
        </div>
      </div>
    );
  }

  // Render player
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mini topbar */}
      <header className="h-14 glass-nav flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/courses"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name="ArrowLeftIcon" size={18} />
            <span className="text-sm font-500 hidden sm:block">Volver a Cursos</span>
          </Link>
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <span>/</span>
            <Link href="/courses" className="hover:text-foreground transition-colors">
              Cursos
            </Link>
            <span>/</span>
            <Link
              href={`/course-detail?course=${courseData.slug}`}
              className="hover:text-foreground transition-colors"
            >
              {courseData.title}
            </Link>
            <span>/</span>
            <span className="text-foreground font-500">Lección {currentLesson?.number || 1}</span>
          </div>
        </div>
        <Link href="/dashboard" className="flex items-center gap-2">
          <AppLogo size={24} />
          <span className="font-700 text-sm text-foreground hidden sm:block">Glewstudio</span>
        </Link>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300`}>
          {/* Player */}
          <div className="relative bg-black w-full" style={{ aspectRatio: '16/9' }}>
            <VideoPlayer
              videoData={videoData}
              playing={playing}
              canAccessCourse={canAccessCourse}
              lessonCompleted={lessonCompleted}
              isLoading={isLoading}
              onVideoEnd={handleVideoEnd}
              currentLesson={currentLesson}
            />

            {/* Course access block overlay */}
            {!isLoading && !canAccessCourse && (
              <CourseAccessBlock
                isAuthenticated={isAuthenticated}
                userTier={userTier}
                requiredTier={courseData.minimum_tier || 'obturador'}
                courseTitle={courseData.title}
              />
            )}

            {/* Lesson completed overlay - only show briefly as toast, don't block video */}
            {false && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mb-4">
                  <Icon name="CheckIcon" size={32} className="text-primary" />
                </div>
                <p className="text-white font-700 text-lg mb-1">¡Lección Completada!</p>
                <p className="text-white/60 text-sm mb-6">Tu progreso ha sido guardado</p>
                <Link
                  href="/video-player"
                  className="btn-primary px-6 py-2.5 text-sm font-700 flex items-center gap-2"
                >
                  <Icon name="ForwardIcon" size={16} />
                  Siguiente Lección
                </Link>
              </div>
            )}

            {/* Play/Pause overlay — only for supabase provider when user has access */}
            {!isLoading && canAccessCourse && showCustomControls && (
              <div
                className="absolute inset-0 flex items-center justify-center cursor-pointer group"
                onClick={() => setPlaying(!playing)}
              >
                <div
                  className={`w-16 h-16 rounded-full bg-black/50 border-2 border-white/30 flex items-center justify-center transition-opacity ${playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
                >
                  <Icon
                    name={playing ? 'PauseIcon' : 'PlayIcon'}
                    size={28}
                    className="text-white ml-1"
                  />
                </div>
              </div>
            )}

            {/* Controls bar - only for supabase provider */}
            {showCustomControls && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-8">
                {/* Progress */}
                <div className="mb-3 group cursor-pointer">
                  <div className="h-1 bg-white/20 rounded-full overflow-hidden group-hover:h-1.5 transition-all">
                    <div
                      className="h-full progress-bar"
                      style={{ width: `${canAccessCourse ? progress : 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => canAccessCourse && !lessonCompleted && setPlaying(!playing)}
                      className="text-white hover:text-primary transition-colors"
                      aria-label={playing ? 'Pausar' : 'Reproducir'}
                    >
                      <Icon name={playing ? 'PauseIcon' : 'PlayIcon'} size={22} />
                    </button>
                    <button
                      className="text-white/70 hover:text-white transition-colors"
                      aria-label="Anterior"
                    >
                      <Icon name="BackwardIcon" size={18} />
                    </button>
                    <button
                      className="text-white/70 hover:text-white transition-colors"
                      aria-label="Siguiente"
                    >
                      <Icon name="ForwardIcon" size={18} />
                    </button>
                    <button
                      className="text-white/70 hover:text-white transition-colors"
                      aria-label="Silenciar"
                    >
                      <Icon name="SpeakerWaveIcon" size={18} />
                    </button>
                    <span className="text-white/70 text-xs font-mono">
                      {canAccessCourse && currentLesson
                        ? `${formatDuration(Math.floor((currentLesson.duration_seconds || 0) * (progress / 100)))} / ${currentLesson.duration}`
                        : `00:00 / ${currentLesson?.duration || '00:00'}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Speed selector */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowSpeedMenu(!showSpeedMenu);
                          setShowQualityMenu(false);
                        }}
                        className="text-white/70 hover:text-white text-xs font-600 px-2 py-1 rounded border border-white/20 hover:border-white/40 transition-colors"
                      >
                        {speed}
                      </button>
                      {showSpeedMenu && (
                        <div className="absolute bottom-8 right-0 bg-card border border-border rounded-lg overflow-hidden shadow-xl z-20">
                          {['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'].map((s) => (
                            <button
                              key={`speed-${s}`}
                              onClick={() => {
                                setSpeed(s);
                                setShowSpeedMenu(false);
                              }}
                              className={`block w-full px-4 py-2 text-xs text-left hover:bg-muted transition-colors ${s === speed ? 'text-primary font-700' : 'text-foreground'}`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quality selector */}
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowQualityMenu(!showQualityMenu);
                          setShowSpeedMenu(false);
                        }}
                        className="text-white/70 hover:text-white text-xs font-600 px-2 py-1 rounded border border-white/20 hover:border-white/40 transition-colors"
                      >
                        {quality}
                      </button>
                      {showQualityMenu && (
                        <div className="absolute bottom-8 right-0 bg-card border border-border rounded-lg overflow-hidden shadow-xl z-20">
                          {['720p', '1080p', '4K'].map((q) => (
                            <button
                              key={`quality-${q}`}
                              onClick={() => {
                                setQuality(q);
                                setShowQualityMenu(false);
                              }}
                              className={`block w-full px-4 py-2 text-xs text-left hover:bg-muted transition-colors ${q === quality ? 'text-primary font-700' : 'text-foreground'}`}
                            >
                              {q}
                              {q === '4K' && (
                                <span className="ml-2 text-xs tier-badge-diafragma px-1 rounded">
                                  Master
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setSidebarOpen(!sidebarOpen)}
                      className="text-white/70 hover:text-white transition-colors"
                      aria-label="Mostrar/ocultar sidebar"
                    >
                      <Icon name="QueueListIcon" size={18} />
                    </button>
                    <button
                      className="text-white/70 hover:text-white transition-colors"
                      aria-label="Pantalla completa"
                    >
                      <Icon name="ArrowsPointingOutIcon" size={18} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Below player */}
          <div className="flex-1 overflow-y-auto p-6 max-w-screen-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TierBadge tier={courseData.tier} size="sm" />
                  <span className="text-xs text-muted-foreground">
                    Lección {currentLesson?.number || 1} de {chapters.length}
                  </span>
                  {/* Show user's current tier badge */}
                  {!isLoading && userTier && (
                    <span className="text-xs text-muted-foreground">
                      · Tu plan:{' '}
                      <span className="text-foreground font-600">{TIER_LABELS[userTier]}</span>
                    </span>
                  )}
                </div>
                <h1 className="text-xl font-700 text-foreground mb-1">
                  {currentLesson?.title || 'Cargando...'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Curso: {courseData.title} · {instructorName}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Mark as complete button */}
                {canAccessCourse && user && currentLesson && (
                  <button
                    onClick={handleMarkLessonComplete}
                    disabled={lessonCompleted || markingComplete}
                    className={`px-3 py-1.5 text-xs flex items-center gap-1.5 rounded-lg border font-600 transition-all duration-200 ${
                      lessonCompleted
                        ? 'bg-green-500/10 text-green-400 border-green-500/30 cursor-default'
                        : 'btn-ghost hover:border-primary/40 hover:text-primary'
                    }`}
                  >
                    {markingComplete ? (
                      <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Icon name={lessonCompleted ? 'CheckCircleIcon' : 'CheckIcon'} size={14} />
                    )}
                    {lessonCompleted ? 'Completada' : 'Marcar como completada'}
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (!user) {
                      toast.error('Inicia sesión para guardar cursos en Mi Lista.');
                      return;
                    }
                    try {
                      const { addToWatchlist, removeFromWatchlist, isInWatchlist } =
                        await import('@/lib/watchlist');
                      const inList = await isInWatchlist(courseData.id);
                      if (inList) {
                        await removeFromWatchlist(courseData.id);
                        toast.success('Eliminado de Mi Lista');
                      } else {
                        await addToWatchlist({
                          courseId: courseData.id,
                          courseSlug: courseData.slug,
                          courseTitle: courseData.title,
                          courseInstructor: instructorName,
                          courseThumbnail: courseData.thumbnail || '',
                          courseThumbnailAlt: courseData.thumbnail_alt || '',
                          courseDuration: courseData.duration,
                          courseTier: courseData.tier,
                          courseRating: courseData.rating ?? undefined,
                          courseLessonCount:
                            courseData.modules?.reduce((sum, m) => sum + m.lessons.length, 0) || 0,
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
                  className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5"
                >
                  <Icon name="BookmarkIcon" size={14} />
                  Guardar
                </button>
              </div>
            </div>

            {currentLesson?.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-2xl">
                {currentLesson.description}
              </p>
            )}

            {/* Next lesson */}
            {(() => {
              const currentIndex = chapters.findIndex((ch) => ch.id === currentLesson?.id);
              const nextLesson =
                currentIndex >= 0 && currentIndex < chapters.length - 1
                  ? chapters[currentIndex + 1]
                  : null;

              if (!nextLesson) return null;

              return (
                <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl max-w-lg">
                  <div className="relative w-20 h-12 rounded-lg overflow-hidden shrink-0">
                    {courseData.thumbnail && (
                      <AppImage
                        src={courseData.thumbnail}
                        alt={courseData.thumbnail_alt || `Next lesson: ${nextLesson.title}`}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">Siguiente lección</p>
                    <p className="text-sm font-600 text-foreground truncate">{nextLesson.title}</p>
                    <p className="text-xs text-muted-foreground">{nextLesson.duration} min</p>
                  </div>
                  <Link
                    href={`/video-player?course=${courseSlug}&lesson=${nextLesson.id}`}
                    className="btn-primary px-3 py-1.5 text-xs shrink-0"
                  >
                    Siguiente
                  </Link>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-80 xl:w-96 shrink-0 border-l border-border flex flex-col bg-card overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border">
              {(['chapters', 'resources'] as const).map((tab) => (
                <button
                  key={`player-tab-${tab}`}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 py-3.5 text-sm font-600 transition-colors ${
                    sidebarTab === tab
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'chapters' ? 'Capítulos' : 'Recursos'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {sidebarTab === 'chapters' && (
                <div className="p-2">
                  {chapters.map((ch, index) => {
                    const chLocked = !canAccessCourse && !ch.isFreePreview;
                    const isCurrentCompleted = ch.current && lessonCompleted;
                    return (
                      <button
                        key={ch.id}
                        onClick={() => handleChapterClick(ch)}
                        className={`w-full flex items-start gap-3 p-3 rounded-lg mb-1 text-left transition-colors ${
                          ch.current && canAccessCourse
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
                            chLocked
                              ? 'border border-border'
                              : ch.completed || isCurrentCompleted
                                ? 'bg-primary text-primary-foreground'
                                : ch.current
                                  ? 'border-2 border-primary'
                                  : 'border border-border'
                          }`}
                        >
                          {chLocked ? (
                            <Icon
                              name="LockClosedIcon"
                              size={10}
                              className="text-muted-foreground"
                            />
                          ) : ch.completed || isCurrentCompleted ? (
                            <Icon name="CheckIcon" size={12} />
                          ) : ch.current ? (
                            <div className="w-2 h-2 bg-primary rounded-full" />
                          ) : (
                            <span className="text-xs text-muted-foreground">{ch.number}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-500 truncate ${
                              chLocked
                                ? 'text-muted-foreground'
                                : ch.current
                                  ? 'text-primary'
                                  : ch.completed || isCurrentCompleted
                                    ? 'text-muted-foreground'
                                    : 'text-foreground'
                            }`}
                          >
                            {ch.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{ch.duration}</p>
                        </div>
                        {ch.current && canAccessCourse && !lessonCompleted && (
                          <div className="shrink-0 w-1.5 h-8 bg-primary rounded-full mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {sidebarTab === 'resources' &&
                (() => {
                  // Check if resources should be freely accessible
                  const isCourseFree =
                    courseData?.access_type === 'free' || courseData?.minimum_tier === 'free';
                  const isAdmin = userTier === 'diafragma'; // Assuming diafragma is admin/master tier
                  const resourcesUnlocked = isCourseFree || isAdmin || canAccessCourse;

                  if (resources.length === 0) {
                    return (
                      <div className="p-4 text-center py-12">
                        <Icon
                          name="ArchiveBoxIcon"
                          size={48}
                          className="text-muted-foreground/50 mx-auto mb-4"
                        />
                        <p className="text-sm text-muted-foreground">
                          Esta lección no incluye recursos descargables
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="p-4">
                      {/* Subscription status indicator - only show if not freely accessible */}
                      {!isLoading && !resourcesUnlocked && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-xs bg-muted text-muted-foreground">
                          <Icon name="LockClosedIcon" size={13} />
                          <span>
                            {isAuthenticated
                              ? userTier
                                ? `Plan activo: ${TIER_LABELS[userTier]}`
                                : 'Sin suscripción activa'
                              : 'Inicia sesión para descargar'}
                          </span>
                        </div>
                      )}

                      {/* Success indicator for free/unlocked access */}
                      {!isLoading && resourcesUnlocked && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-xs bg-green-500/10 text-green-400">
                          <Icon name="CheckCircleIcon" size={13} />
                          <span>
                            {isCourseFree
                              ? 'Curso gratuito - descarga libre'
                              : isAdmin
                                ? 'Acceso administrador - descarga libre'
                                : 'Acceso concedido - descarga disponible'}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col gap-3">
                        {resources.map((res) => {
                          const resLocked = !resourcesUnlocked && !hasAccess(userTier, res.tier);
                          const tierBadgeClass =
                            res.tier === 'diafragma'
                              ? 'tier-badge-diafragma'
                              : 'tier-badge-obturador';
                          return (
                            <div
                              key={res.id}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                                resLocked
                                  ? 'border-border opacity-60'
                                  : 'border-border hover:border-primary/30 hover:bg-primary/5'
                              }`}
                            >
                              <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                  resLocked ? 'bg-muted' : 'bg-primary/10'
                                }`}
                              >
                                <Icon
                                  name={res.icon as any}
                                  size={18}
                                  className={resLocked ? 'text-muted-foreground' : 'text-primary'}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-600 text-foreground truncate">
                                  {res.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{res.size}</span>
                                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-600">
                                    {res.type}
                                  </span>
                                  {res.tier && !resourcesUnlocked && (
                                    <span
                                      className={`text-xs px-1.5 py-0.5 rounded font-600 ${tierBadgeClass}`}
                                    >
                                      {res.tier === 'diafragma' ? 'Master' : 'Pro'}
                                    </span>
                                  )}
                                  {resourcesUnlocked && res.tier && (
                                    <span className="text-xs px-1.5 py-0.5 rounded font-600 bg-green-500/10 text-green-400">
                                      Disponible
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleDownload(res)}
                                disabled={resLocked}
                                className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                  resLocked
                                    ? 'bg-muted cursor-not-allowed'
                                    : 'bg-primary/10 hover:bg-primary/20 text-primary'
                                }`}
                                aria-label={
                                  resLocked ? 'Contenido bloqueado' : `Descargar ${res.name}`
                                }
                              >
                                <Icon
                                  name={resLocked ? 'LockClosedIcon' : 'ArrowDownTrayIcon'}
                                  size={14}
                                  className={resLocked ? 'text-muted-foreground' : 'text-primary'}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
            </div>
          </aside>
        )}

        {/* Lock Modal */}
      </div>
      {showLockModal && (
        <LockOverlay
          requiredTier={lockedResource.tier}
          userTier={userTier}
          isAuthenticated={isAuthenticated}
          onClose={() => setShowLockModal(false)}
          resourceName={lockedResource.name}
        />
      )}
    </div>
  );
}

// ─── Lock Overlay Component ────────────────────────────────────────────────────
interface LockOverlayProps {
  requiredTier: SubscriptionTier;
  userTier: SubscriptionTier;
  isAuthenticated: boolean;
  onClose: () => void;
  resourceName?: string;
}

function LockOverlay({
  requiredTier,
  userTier,
  isAuthenticated,
  onClose,
  resourceName,
}: LockOverlayProps) {
  const tierLabel = requiredTier ? TIER_LABELS[requiredTier] : '';
  const tierPrice = requiredTier ? TIER_PRICES[requiredTier] : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
            requiredTier === 'diafragma' ? 'tier-badge-diafragma' : 'tier-badge-obturador'
          }`}
        >
          <Icon
            name="LockClosedIcon"
            size={22}
            className={requiredTier === 'diafragma' ? 'text-purple-400' : 'text-amber-400'}
          />
        </div>
        <h3 className="text-lg font-700 text-foreground text-center mb-2">Contenido Exclusivo</h3>
        {resourceName && (
          <p className="text-sm text-muted-foreground text-center mb-1">
            <span className="text-foreground font-500">{resourceName}</span>
          </p>
        )}
        {!isAuthenticated ? (
          <>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Inicia sesión para acceder a este contenido.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/sign-up-login"
                className="btn-primary py-2.5 text-sm text-center font-700"
                onClick={onClose}
              >
                Iniciar Sesión
              </Link>
              <button onClick={onClose} className="btn-ghost py-2.5 text-sm font-600">
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground text-center mb-1">
              {userTier
                ? `Tu plan actual es ${TIER_LABELS[userTier]}.`
                : 'No tienes una suscripción activa.'}
            </p>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Este recurso requiere el{' '}
              <span
                className={
                  requiredTier === 'diafragma'
                    ? 'text-purple-400 font-600'
                    : 'text-amber-400 font-600'
                }
              >
                {tierLabel}
              </span>{' '}
              ({tierPrice}).
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/account-subscription-management"
                className="btn-primary py-2.5 text-sm text-center font-700"
                onClick={onClose}
              >
                Actualizar a {tierLabel}
              </Link>
              <button onClick={onClose} className="btn-ghost py-2.5 text-sm font-600">
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Course Access Block Component ─────────────────────────────────────────────
interface CourseAccessBlockProps {
  isAuthenticated: boolean;
  userTier: SubscriptionTier;
  requiredTier: 'free' | 'apertura' | 'obturador' | 'diafragma' | null;
  courseTitle: string;
}

function CourseAccessBlock({
  isAuthenticated,
  userTier,
  requiredTier,
  courseTitle,
}: CourseAccessBlockProps) {
  const tierLabel = requiredTier ? TIER_LABELS[requiredTier] : '';
  const tierPrice = requiredTier ? TIER_PRICES[requiredTier] : '';

  // For free courses, don't show lock
  if (!requiredTier || requiredTier === 'free') return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="text-center px-6 max-w-md">
        <div className="w-16 h-16 rounded-full tier-badge-obturador flex items-center justify-center mx-auto mb-4">
          <Icon name="LockClosedIcon" size={28} className="text-amber-400" />
        </div>
        <h2 className="text-xl font-700 text-white mb-2">Acceso Restringido</h2>
        <p className="text-sm text-white/70 mb-2">{courseTitle}</p>
        {!isAuthenticated ? (
          <>
            <p className="text-sm text-white/70 mb-6">Inicia sesión para ver este curso.</p>
            <Link
              href="/sign-up-login"
              className="btn-primary px-6 py-3 text-sm font-700 inline-block"
            >
              Iniciar Sesión
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-white/70 mb-2">
              {userTier
                ? `Tu plan actual es ${TIER_LABELS[userTier]}.`
                : 'No tienes una suscripción activa.'}
            </p>
            <p className="text-sm text-white/70 mb-6">
              Este curso requiere el <span className="text-amber-400 font-600">{tierLabel}</span> (
              {tierPrice}) o superior.
            </p>
            <Link
              href="/account-subscription-management"
              className="btn-primary px-6 py-3 text-sm font-700 inline-block"
            >
              Actualizar a {tierLabel}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
