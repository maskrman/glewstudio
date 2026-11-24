/**
 * GLEW Studio — Admin Courses Types & Utilities
 * Types for the hierarchical course management system (Course → Modules → Lessons)
 */

export type CourseStatus = 'draft' | 'public' | 'presale';
export type LessonVideoProvider = 'supabase' | 'bunny' | 'vimeo';
export type ResourceFileType =
  | 'PDF'
  | 'XMP'
  | 'LRT'
  | 'ATN'
  | 'ICC'
  | 'CUBE'
  | 'NEF'
  | 'CR2'
  | 'ARW'
  | 'DNG'
  | 'ZIP'
  | 'RAW'
  | 'LUT'
  | 'OTHER';

// ─── Instructor ────────────────────────────────────────────────────────────────

export interface Instructor {
  id: string;
  name: string;
  specialty: string;
  tags: string[];
  bio: string | null;
  photo_url: string | null;
  photo_alt: string | null;
  avatar_url: string | null; // Synced with photo_url for backwards compatibility
  created_at: string;
  updated_at: string;
}

export interface InstructorFormData {
  name: string;
  specialty: string;
  tags: string; // comma-separated
  bio: string;
  photo_url: string;
  photo_alt: string;
  avatar_url: string; // Synced with photo_url for backwards compatibility
}

// ─── Course ────────────────────────────────────────────────────────────────

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  category_id: string | null;
  instructor_id: string | null; // Changed from instructor string to instructor_id
  instructor?: Instructor | null; // Populated when joined
  duration: string;
  tier: 'apertura' | 'obturador' | 'diafragma' | 'free';
  rating: number;
  lesson_count: number;
  is_published: boolean;
  status: CourseStatus;
  access_type: 'free' | 'membership' | 'premium_purchase';
  price: number | null;
  created_at: string;
  updated_at: string;
  modules?: CourseModule[];
  computedDuration?: string; // Computed from lesson durations
}

export interface CourseFormData {
  title: string;
  slug: string;
  description: string;
  thumbnail: string;
  category_id: string | null;
  instructor_id: string | null; // Changed from instructor string to instructor_id
  instructor: string; // Synced instructor name for backwards compatibility
  duration: string;
  tier: 'apertura' | 'obturador' | 'diafragma' | 'free';
  access_type: 'free' | 'membership' | 'premium_purchase';
  price: number | null;
  status: CourseStatus;
}

// ─── Module ────────────────────────────────────────────────────────────────────

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  lessons?: Lesson[];
}

export interface ModuleFormData {
  title: string;
  description: string;
  position: number;
}

// ─── Lesson ────────────────────────────────────────────────────────────────────

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  duration_seconds: number;
  position: number;
  video_provider: LessonVideoProvider;
  video_asset_id: string | null;
  is_free_preview: boolean;
  created_at: string;
  updated_at: string;
  resources?: LessonResource[];
}

export interface LessonFormData {
  title: string;
  description: string;
  duration_seconds: number;
  position: number;
  video_provider: LessonVideoProvider;
  video_asset_id: string;
  is_free_preview: boolean;
}

// ─── Lesson Resources ──────────────────────────────────────────────────────────

export interface LessonResource {
  id: string;
  course_id: string;
  lesson_id: string;
  file_name: string;
  display_name: string;
  file_type: ResourceFileType;
  file_size: string | null;
  storage_path: string;
  required_tier: 'apertura' | 'obturador' | 'diafragma' | 'free';
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ResourceFormData {
  file: File | null;
  display_name: string;
  file_type: ResourceFileType;
  required_tier: 'apertura' | 'obturador' | 'diafragma' | 'free';
  sort_order: number;
}

// ─── Utility Types ─────────────────────────────────────────────────────────────

export interface CourseWithModules extends Course {
  modules: (CourseModule & { lessons: Lesson[] })[];
}

export type CourseAction = 'create' | 'edit' | 'delete';
export type ModuleAction = 'create' | 'edit' | 'delete';
export type LessonAction = 'create' | 'edit' | 'delete';

// ─── Constants ─────────────────────────────────────────────────────────────────

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  draft: 'Borrador',
  public: 'Público',
  presale: 'Preventa / Próximamente',
};

export const COURSE_STATUS_COLORS: Record<CourseStatus, string> = {
  draft: 'bg-muted text-muted-foreground border border-border',
  public: 'bg-green-500/10 text-green-400 border border-green-500/20',
  presale: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
};

export const VIDEO_PROVIDER_LABELS: Record<LessonVideoProvider, string> = {
  supabase: 'Supabase Storage',
  bunny: 'Bunny.net Stream',
  vimeo: 'Vimeo',
};

export const VIDEO_PROVIDER_PLACEHOLDERS: Record<LessonVideoProvider, string> = {
  supabase: 'Ruta en Supabase Storage (ej: courses/course-id/lesson-video.mp4)',
  bunny: 'Video ID de Bunny Stream (UUID)',
  vimeo: 'ID de video de Vimeo (numérico) o URL completa',
};

// ─── Vimeo URL Helper ──────────────────────────────────────────────────────────

/**
 * Extrae el ID numérico de Vimeo de una URL completa o devuelve el ID si ya es numérico.
 * Ejemplos:
 * - "https://vimeo.com/1246953838?share=copy" -> "1246953838"
 * - "https://player.vimeo.com/video/1246953838" -> "1246953838"
 * - "vimeo.com/1246953838/abcdef" -> "1246953838"
 * - "1246953838" -> "1246953838"
 */
export function extractVimeoId(input: string): string {
  if (!input) return '';

  // Si ya es solo números, devolverlo
  if (/^\d+$/.test(input.trim())) {
    return input.trim();
  }

  // Buscar patrón numérico en la URL
  const patterns = [/vimeo\.com\/(\d+)/, /player\.vimeo\.com\/video\/(\d+)/, /vimeo\.com\/(\d+)\//];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Si no coincide, devolver el input original (posiblemente ya limpio)
  return input.trim();
}

/**
 * Genera la URL del iframe de Vimeo para el reproductor.
 * Opcionalmente incluye el hash de privacidad si se proporciona.
 */
export function buildVimeoIframeUrl(vimeoId: string, privacyHash?: string): string {
  const base = `https://player.vimeo.com/video/${vimeoId}`;
  if (privacyHash) {
    return `${base}?h=${privacyHash}&title=0&byline=0&portrait=0`;
  }
  return `${base}?title=0&byline=0&portrait=0`;
}

export const RESOURCE_FILE_TYPES: {
  value: ResourceFileType;
  label: string;
  extensions: string[];
}[] = [
  { value: 'PDF', label: 'PDF — Guías y Documentos', extensions: ['.pdf'] },
  { value: 'XMP', label: 'XMP — Presets Lightroom', extensions: ['.xmp'] },
  { value: 'LRT', label: 'LRT — Presets Lightroom (Legacy)', extensions: ['.lrtemplate'] },
  { value: 'ATN', label: 'ATN — Acciones Photoshop', extensions: ['.atn'] },
  { value: 'ICC', label: 'ICC — Perfiles de Color', extensions: ['.icc', '.icm'] },
  { value: 'CUBE', label: 'CUBE — LUTs 3D', extensions: ['.cube', '.3dl'] },
  { value: 'NEF', label: 'NEF — RAW Nikon', extensions: ['.nef'] },
  { value: 'CR2', label: 'CR2 — RAW Canon', extensions: ['.cr2'] },
  { value: 'ARW', label: 'ARW — RAW Sony', extensions: ['.arw'] },
  { value: 'DNG', label: 'DNG — RAW Adobe', extensions: ['.dng'] },
  { value: 'ZIP', label: 'ZIP — Paquetes Comprimidos', extensions: ['.zip'] },
  {
    value: 'RAW',
    label: 'RAW — Archivos RAW Genéricos',
    extensions: ['.raw', '.rw2', '.orf', '.pef'],
  },
  { value: 'LUT', label: 'LUT — Tablas de Color', extensions: ['.lut', '.csp'] },
  { value: 'OTHER', label: 'OTRO — Otros formatos', extensions: [] },
];

export const TIER_OPTIONS = [
  { value: 'free', label: 'Gratis (Sin membresía)' },
  { value: 'apertura', label: 'Apertura' },
  { value: 'obturador', label: 'Obturador' },
  { value: 'diafragma', label: 'Diafragma' },
];

export const COURSE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'public', label: 'Público' },
  { value: 'presale', label: 'Preventa / Próximamente' },
];

export const ACCESS_TYPE_OPTIONS = [
  { value: 'free', label: 'Gratis' },
  { value: 'membership', label: 'Membresía' },
  { value: 'premium_purchase', label: 'Compra Premium' },
];

// ─── Instructor Validation ───────────────────────────────────────────────────

export function validateInstructorForm(data: Partial<InstructorFormData>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.name?.trim()) errors.name = 'El nombre es obligatorio';
  return errors;
}

// ─── Validation ────────────────────────────────────────────────────────────────

export function validateCourseForm(data: Partial<CourseFormData>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.title?.trim()) errors.title = 'El título es obligatorio';
  if (!data.slug?.trim()) errors.slug = 'El slug es obligatorio';
  if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
    errors.slug = 'El slug solo puede contener letras minúsculas, números y guiones';
  }
  if (data.access_type === 'premium_purchase' && (!data.price || data.price <= 0)) {
    errors.price = 'El precio es obligatorio para cursos premium';
  }
  return errors;
}

export function validateModuleForm(data: Partial<ModuleFormData>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.title?.trim()) errors.title = 'El título del módulo es obligatorio';
  return errors;
}

export function validateLessonForm(data: Partial<LessonFormData>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.title?.trim()) errors.title = 'El título de la lección es obligatorio';
  if (data.duration_seconds !== undefined && data.duration_seconds < 0)
    errors.duration = 'La duración no puede ser negativa';
  if (data.video_provider === 'bunny' && !data.video_asset_id?.trim()) {
    errors.video_asset_id = 'El Video ID de Bunny es obligatorio';
  }
  if (data.video_provider === 'vimeo' && !data.video_asset_id?.trim()) {
    errors.video_asset_id = 'El ID de Vimeo es obligatorio';
  }
  if (data.video_provider === 'supabase' && !data.video_asset_id?.trim()) {
    errors.video_asset_id = 'La ruta en Supabase Storage es obligatoria';
  }
  return errors;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function parseDuration(input: string | number): number {
  // If input is already a number (seconds), return it directly
  if (typeof input === 'number') {
    return input;
  }
  // Accept formats like "1h 30m", "90m", "5400s", "1:30:00", "90:00"
  const hmsMatch = input.match(/^(\d+):(\d{2}):(\d{2})$/);
  if (hmsMatch) {
    return parseInt(hmsMatch[1]) * 3600 + parseInt(hmsMatch[2]) * 60 + parseInt(hmsMatch[3]);
  }
  const msMatch = input.match(/^(\d+):(\d{2})$/);
  if (msMatch) {
    return parseInt(msMatch[1]) * 60 + parseInt(msMatch[2]);
  }
  const hourMatch = input.match(/(\d+)h/);
  const minMatch = input.match(/(\d+)m/);
  const secMatch = input.match(/(\d+)s/);
  let total = 0;
  if (hourMatch) total += parseInt(hourMatch[1]) * 3600;
  if (minMatch) total += parseInt(minMatch[1]) * 60;
  if (secMatch) total += parseInt(secMatch[1]);
  return total || parseInt(input) * 60; // Default to minutes if just a number
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
