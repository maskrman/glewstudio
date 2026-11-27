'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  extractVimeoId,
  buildVimeoIframeUrl,
  formatFileSize,
  RESOURCE_FILE_TYPES,
} from '@/lib/admin-courses';

import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import TierBadge from '@/components/ui/TierBadge';
import { toast } from 'sonner';
import {
  createCourse,
  updateCourse,
  deleteCourse,
  getCourses,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  uploadLessonResource,
  updateLessonResource,
  deleteLessonResource,
  reorderLessonResources,
  getCategories,
  createLessonResourceRecord,
  createInstructor,
  updateInstructor,
  deleteInstructor,
  getInstructors,
} from '@/app/admin/actions/courses';
import type {
  Course,
  CourseModule,
  Lesson,
  LessonResource,
  CourseFormData,
  ModuleFormData,
  LessonFormData,
  ResourceFormData,
  CourseStatus,
  LessonVideoProvider,
  ResourceFileType,
  Instructor,
  InstructorFormData,
} from '@/lib/admin-courses';
import {
  COURSE_STATUS_LABELS,
  COURSE_STATUS_COLORS,
  VIDEO_PROVIDER_LABELS,
  VIDEO_PROVIDER_PLACEHOLDERS,
  TIER_OPTIONS,
  COURSE_STATUS_OPTIONS,
  ACCESS_TYPE_OPTIONS,
  validateCourseForm,
  validateModuleForm,
  validateLessonForm,
  validateInstructorForm,
  formatDuration,
  parseDuration,
} from '@/lib/admin-courses';

// ─── Types ────────────────────────────────────────────────────────────────────

// Storage bucket names - MUST match exactly the bucket names in Supabase Storage panel
// (case-sensitive, hyphenated). Create manually in Supabase > Storage if auto-create fails.
export const STORAGE_BUCKETS = {
  COURSE_THUMBNAILS: 'course-thumbnails',
  RESOURCES: 'resources',
} as const;

interface AdminCoursesProps {
  initialCourses?: Course[];
}

// ─── Utility Components ───────────────────────────────────────────────────────

type ConfirmDialogVariant = 'danger' | 'primary';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
}

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md glass-card rounded-xl p-6 border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-700 text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={loading} className="btn-ghost px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-600 rounded-lg transition-colors ${
              variant === 'danger'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : 'btn-primary'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FormField({
  label,
  error,
  required = false,
  helpText,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-500 text-foreground flex items-center gap-1">
        {label}
        {required && <span className="text-primary">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
      {helpText && !error && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

function Input({
  className = '',
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <input
      className={`input-dark w-full px-4 py-2.5 text-sm ${
        error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : ''
      } ${className}`}
      {...props}
      aria-invalid={error ? 'true' : 'false'}
      aria-describedby={error ? `${props.id}-error` : undefined}
    />
  );
}

function Textarea({
  className = '',
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <textarea
      className={`input-dark w-full px-4 py-2.5 text-sm resize-none ${
        error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : ''
      } ${className}`}
      {...props}
      aria-invalid={error ? 'true' : 'false'}
    />
  );
}

function Select({
  className = '',
  error,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      className={`input-dark w-full px-4 py-2.5 text-sm appearance-none ${
        error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : ''
      } ${className}`}
      {...props}
      aria-invalid={error ? 'true' : 'false'}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function FileInput({
  className = '',
  error,
  accept,
  onChange,
  selectedFile,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  accept?: string;
  selectedFile?: File | null;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] || null;
    if (!file) return;
    if (!onChange) return;
    const syntheticEvent = {
      target: { files: e.dataTransfer.files },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
  };

  return (
    <div className="space-y-2">
      <label
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        className={`relative flex flex-col items-center justify-center px-6 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
          error
            ? 'border-red-500/50 bg-red-500/5'
            : isDragging
              ? 'border-primary/50 bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-primary/5'
        } ${className}`}
      >
        <Icon name="ArrowUpTrayIcon" size={28} className="text-muted-foreground mb-2" />
        <p className="text-sm text-foreground font-500">Arrastra o haz clic para subir</p>
        <p className="text-xs text-muted-foreground mt-1">Máx. 500 MB</p>
        <input
          type="file"
          accept={accept}
          onChange={onChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label="Subir archivo"
          {...props}
        />
      </label>
      {selectedFile && (
        <div className="flex items-center justify-between px-2 text-sm">
          <span className="text-foreground truncate max-w-xs">{selectedFile.name}</span>
          <span className="text-muted-foreground ml-2">
            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
          </span>
        </div>
      )}
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Instructor Modal ──────────────────────────────────────────────────────────

function InstructorModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  errors,
  setForm,
  setErrors,
  editing,
  saving,
  uploadingPhoto,
  photoPreview,
  photoFile,
  onPhotoChange,
  onPhotoDrop,
  onRemovePhoto,
  onUploadPhoto,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: InstructorFormData;
  errors: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<InstructorFormData>>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editing: Instructor | null;
  saving: boolean;
  uploadingPhoto: boolean;
  photoPreview: string | null;
  photoFile: File | null;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhotoDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onRemovePhoto: () => void;
  onUploadPhoto: () => void;
}) {
  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    if (errors[name])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
  };

  const revokeObjectUrl = (url: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl glass-card rounded-xl p-6 border-white/10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-700 text-foreground">
            {editing ? 'Editar Instructor' : 'Nuevo Instructor'}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="Cerrar" disabled={saving}>
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <FormField label="Nombre *" error={errors.name} required>
            <Input
              id="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Nombre del instructor"
              autoFocus
            />
          </FormField>

          <FormField
            label="Especialidad"
            error={errors.specialty}
            helpText="Ej: Iluminación de Estudio, Retrato, Moda"
          >
            <Input
              id="specialty"
              name="specialty"
              value={form.specialty}
              onChange={handleChange}
              placeholder="Iluminación de Estudio y Retrato"
            />
          </FormField>

          <FormField
            label="Etiquetas / Especialidades"
            error={errors.tags}
            helpText="Separadas por comas: Retrato, Iluminación, Moda, Producto"
          >
            <Input
              id="tags"
              name="tags"
              value={form.tags}
              onChange={handleChange}
              placeholder="Retrato, Iluminación, Moda, Producto"
            />
          </FormField>

          <FormField
            label="Biografía"
            error={errors.bio}
            helpText="Descripción corta para mostrar en la pestaña Instructor"
          >
            <Textarea
              id="bio"
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={3}
              placeholder="Experto en fotografía comercial con años de experiencia..."
            />
          </FormField>

          {/* Photo Upload Dropzone */}
          <FormField label="Foto del instructor" error={errors.photo_url}>
            <div className="space-y-3">
              {/* Dropzone area */}
              <div
                onDrop={(e) => {
                  e.preventDefault();
                  onPhotoDrop(e);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                }}
                onPaste={(e) => {
                  const file = e.clipboardData?.files?.[0] || null;
                  if (file) {
                    const inputEvent = {
                      target: { files: e.clipboardData.files },
                    } as unknown as React.ChangeEvent<HTMLInputElement>;
                    onPhotoChange(inputEvent);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label="Foto del instructor"
                className={`relative flex flex-col items-center justify-center px-6 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  form.photo_url && !photoPreview && !uploadingPhoto
                    ? 'border-border hover:border-primary/50 hover:bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-primary/5'
                }`}
              >
                {/* Hidden file input */}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onPhotoChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Seleccionar imagen de portada"
                />

                {!photoPreview && !uploadingPhoto ? (
                  <>
                    <Icon name="ArrowUpTrayIcon" size={28} className="text-muted-foreground mb-2" />
                    <p className="text-sm text-foreground font-500">
                      Hacer clic, arrastrar o pegar (Ctrl+V)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP (máx. 5 MB)</p>
                  </>
                ) : (
                  <>
                    {photoPreview && (
                      <img
                        src={photoPreview}
                        alt="Vista previa de la foto"
                        className="w-32 h-32 object-cover rounded-lg shadow-xl mb-2"
                      />
                    )}
                    {uploadingPhoto && (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-primary/30 rounded-full border-t-primary animate-spin" />
                        <p className="text-xs text-primary font-600">Subiendo foto...</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Action buttons */}
              {photoPreview && !uploadingPhoto && (
                <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onUploadPhoto();
                    }}
                    disabled={!photoFile || uploadingPhoto}
                    className="btn-primary text-xs px-4 py-2 rounded-md w-full sm:w-auto"
                  >
                    {form.photo_url && !uploadingPhoto ? 'Actualizar foto' : 'Confirmar foto'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemovePhoto();
                    }}
                    className="btn-ghost text-xs px-3 py-1.5 rounded-md w-full sm:w-auto"
                  >
                    Cambiar foto
                  </button>
                </div>
              )}
              {uploadingPhoto && (
                <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-8 h-8 border-2 border-primary/30 rounded-full border-t-primary animate-spin" />
                    <p className="text-xs text-primary font-600">Subiendo foto...</p>
                  </div>
                </div>
              )}
              {form.photo_url && !photoPreview && !uploadingPhoto && (
                <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-green-400 font-600 flex items-center gap-1">
                    <Icon name="CheckCircleIcon" size={12} />
                    Foto subida y lista
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemovePhoto();
                    }}
                    className="btn-ghost text-xs px-3 py-1.5 rounded-md w-full sm:w-auto"
                  >
                    Cambiar foto
                  </button>
                </div>
              )}
            </div>

            {form.photo_url && !photoPreview && (
              <p className="text-xs text-muted-foreground mt-1">
                Actual: {form.photo_url.split('/').pop()}
              </p>
            )}
          </FormField>

          <FormField
            label="Foto Alt"
            error={errors.photo_alt}
            helpText="Texto alternativo para accesibilidad"
          >
            <Input
              id="photo_alt"
              name="photo_alt"
              value={form.photo_alt}
              onChange={handleChange}
              placeholder="Descripción de la imagen"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-4 py-2"
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary px-6 py-2" disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function AdminCourses({ initialCourses = [] }: AdminCoursesProps) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Course modal state
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState<CourseFormData>({
    title: '',
    slug: '',
    description: '',
    thumbnail: '',
    category_id: null,
    instructor_id: null,
    instructor: '',
    duration: '',
    tier: 'apertura',
    access_type: 'membership',
    price: null,
    status: 'draft',
  });
  const [courseErrors, setCourseErrors] = useState<Record<string, string>>({});

  // Module modal state
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [moduleCourseId, setModuleCourseId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState<ModuleFormData>({
    title: '',
    description: '',
    position: 0,
  });
  const [moduleErrors, setModuleErrors] = useState<Record<string, string>>({});

  // Lesson modal state
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonModuleId, setLessonModuleId] = useState<string | null>(null);
  const [lessonCourseId, setLessonCourseId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonFormData>({
    title: '',
    description: '',
    duration_seconds: 0,
    position: 0,
    video_provider: 'supabase',
    video_asset_id: '',
    is_free_preview: false,
  });
  const [lessonErrors, setLessonErrors] = useState<Record<string, string>>({});
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Resource modal state
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<LessonResource | null>(null);
  const [resourceLessonId, setResourceLessonId] = useState<string | null>(null);
  const [resourceCourseId, setResourceCourseId] = useState<string | null>(null);
  const [resourceForm, setResourceForm] = useState<Omit<ResourceFormData, 'file'>>({
    display_name: '',
    file_type: 'PDF',
    required_tier: 'obturador',
    sort_order: 0,
  });
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [resourceErrors, setResourceErrors] = useState<Record<string, string>>({});

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'primary';
    loading?: boolean;
  } | null>(null);

  // Instructor modal state
  const [instructorModalOpen, setInstructorModalOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [instructorForm, setInstructorForm] = useState<InstructorFormData>({
    name: '',
    specialty: '',
    tags: '',
    bio: '',
    photo_url: '',
    photo_alt: '',
    avatar_url: '',
  });
  const [instructorErrors, setInstructorErrors] = useState<Record<string, string>>({});
  const [instructorPhotoFile, setInstructorPhotoFile] = useState<File | null>(null);
  const [instructorPhotoPreview, setInstructorPhotoPreview] = useState<string | null>(null);
  const [uploadingInstructorPhoto, setUploadingInstructorPhoto] = useState(false);

  // Expanded states
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Categories
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Instructors
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [activeTab, setActiveTab] = useState<'courses' | 'instructors'>('courses');
  const searchParams = useSearchParams();

  // Load categories on mount
  useEffect(() => {
    loadCategories();
    loadInstructors();
  }, []);

  // Read initial tab from URL parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'instructors' || tab === 'courses') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadInstructors = async () => {
    try {
      const data = await getInstructors();
      setInstructors(data);
    } catch (err) {
      console.error('Error loading instructors:', err);
    }
  };

  // Refresh courses
  const refreshCourses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCourses();
      setCourses(data);
    } catch (err) {
      console.error('Error loading courses:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Course Handlers ────────────────────────────────────────────────────────

  const handleNewCourse = () => {
    setEditingCourse(null);
    setCourseForm({
      title: '',
      slug: '',
      description: '',
      thumbnail: '',
      category_id: null,
      instructor_id: null,
      instructor: '',
      duration: '',
      tier: 'apertura',
      access_type: 'membership',
      price: null,
      status: 'draft',
    });
    setCourseErrors({});
    setCourseModalOpen(true);
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    const instructorName =
      typeof course.instructor === 'object' && course.instructor
        ? course.instructor.name
        : typeof course.instructor === 'string'
          ? course.instructor
          : '';
    setCourseForm({
      title: course.title,
      slug: course.slug,
      description: course.description || '',
      thumbnail: course.thumbnail || '',
      category_id: course.category_id,
      instructor_id: course.instructor_id || null,
      instructor: instructorName,
      duration: course.duration,
      tier: course.tier,
      access_type: course.access_type,
      price: course.price,
      status: course.status,
    });
    setCourseErrors({});
    setCourseModalOpen(true);
  };

  const handleCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateCourseForm(courseForm);
    if (Object.keys(errors).length > 0) {
      setCourseErrors(errors);
      return;
    }

    // Validación obligatoria: debe haber una publicUrl válida de Supabase antes de permitir submit
    // Esto bloquea envíos con objetos File, rutas locales (C:\...), strings vacíos o URLs inválidas
    const isValidPublicUrl =
      courseForm.thumbnail &&
      typeof courseForm.thumbnail === 'string' &&
      courseForm.thumbnail.startsWith('https://') &&
      courseForm.thumbnail.includes('.supabase.co/storage/v1/object/public/');

    if (!isValidPublicUrl) {
      const errorMsg =
        'La portada es obligatoria. Sube una imagen (JPG/PNG) y haz clic en "Confirmar portada" para generar el enlace público de Supabase antes de guardar.';
      setCourseErrors({ submit: errorMsg, thumbnail: errorMsg });
      return;
    }

    setSaving(editingCourse?.id || 'new');
    try {
      console.log('[Course Submit] form.thumbnail:', courseForm.thumbnail);

      if (editingCourse) {
        await updateCourse(editingCourse.id, courseForm);
      } else {
        await createCourse(courseForm);
      }
      setCourseModalOpen(false);
      await refreshCourses();
      toast.success(editingCourse ? 'Actualización completa' : 'Curso creado exitosamente');
    } catch (err) {
      setCourseErrors({ submit: err instanceof Error ? err.message : 'Error guardando curso' });
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteCourse = (course: Course) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Curso',
      message: `¿Estás seguro de eliminar "${course.title}"? Esta acción no se puede deshacer y eliminará todos sus módulos, lecciones y recursos.`,
      onConfirm: async () => {
        setConfirmDialog((prev) => (prev ? { ...prev, loading: true } : null));
        try {
          await deleteCourse(course.id);
          await refreshCourses();
        } catch (err) {
          console.error('Error deleting course:', err);
        } finally {
          setConfirmDialog(null);
        }
      },
      variant: 'danger',
    });
  };

  // ─── Instructor Handlers ──────────────────────────────────────────────────────

  const handleNewInstructor = () => {
    setEditingInstructor(null);
    setInstructorForm({
      name: '',
      specialty: '',
      tags: '',
      bio: '',
      photo_url: '',
      photo_alt: '',
      avatar_url: '',
    });
    setInstructorPhotoFile(null);
    setInstructorPhotoPreview(null);
    setInstructorErrors({});
    setInstructorModalOpen(true);
  };

  const handleEditInstructor = (instructor: Instructor) => {
    setEditingInstructor(instructor);
    setInstructorForm({
      name: instructor.name,
      specialty: instructor.specialty || '',
      tags: instructor.tags?.join(', ') || '',
      bio: instructor.bio || '',
      photo_url: instructor.photo_url || '',
      photo_alt: instructor.photo_alt || '',
      avatar_url: instructor.avatar_url || instructor.photo_url || '',
    });
    setInstructorPhotoPreview(instructor.photo_url || instructor.avatar_url || null);
    setInstructorErrors({});
    setInstructorModalOpen(true);
  };

  const handleInstructorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateInstructorForm(instructorForm);
    if (Object.keys(errors).length > 0) {
      setInstructorErrors(errors);
      return;
    }

    // Auto-upload photo if there's a pending file and user didn't click "Confirmar foto"
    if (instructorPhotoFile) {
      setUploadingInstructorPhoto(true);
      try {
        const formData = new FormData();
        formData.append('file', instructorPhotoFile);
        formData.append('instructorId', editingInstructor?.id || 'new');

        const { uploadInstructorPhoto } = await import('@/app/admin/actions/courses');
        const result = await uploadInstructorPhoto(formData);

        if ('error' in result) {
          throw new Error(result.error);
        }

        const publicUrl = result.url;

        // Update form with the public URL for both photo_url and avatar_url
        setInstructorForm((prev) => ({ ...prev, photo_url: publicUrl, avatar_url: publicUrl }));
        setInstructorPhotoFile(null);
        setInstructorPhotoPreview(null);
        setInstructorErrors((prev) => {
          const n = { ...prev };
          delete n.photo_url;
          return n;
        });
        toast.success('Foto del instructor subida correctamente');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error subiendo foto';
        setInstructorErrors((prev) => ({
          ...prev,
          photo_url: errorMessage,
        }));
        toast.error(errorMessage);
        setUploadingInstructorPhoto(false);
        return;
      } finally {
        setUploadingInstructorPhoto(false);
      }
    }

    // Validate that photo has been uploaded to Supabase (not just local blob URL)
    if (instructorForm.photo_url && instructorForm.photo_url.startsWith('blob:')) {
      setInstructorErrors({
        photo_url:
          'Debes hacer clic en "Confirmar foto" para subir la imagen a Supabase antes de guardar',
      });
      toast.error('Debes confirmar la foto antes de guardar');
      return;
    }

    setSaving('instructor');
    try {
      if (editingInstructor) {
        await updateInstructor(editingInstructor.id, instructorForm);
      } else {
        await createInstructor(instructorForm);
      }
      setInstructorModalOpen(false);
      await loadInstructors();
      toast.success(
        editingInstructor ? 'Instructor actualizado' : 'Instructor creado exitosamente'
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error guardando instructor';
      setInstructorErrors({
        submit: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteInstructor = (instructor: Instructor) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Instructor',
      message: `¿Estás seguro de eliminar "${instructor.name}"? Los cursos que tengan este instructor perderán la referencia.`,
      onConfirm: async () => {
        setConfirmDialog((prev) => (prev ? { ...prev, loading: true } : null));
        try {
          await deleteInstructor(instructor.id);
          await loadInstructors();
          await refreshCourses();
        } catch (err) {
          console.error('Error deleting instructor:', err);
        } finally {
          setConfirmDialog(null);
        }
      },
      variant: 'danger',
    });
  };

  // Instructor photo upload handlers
  const handleInstructorPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setInstructorErrors((prev) => ({
        ...prev,
        photo_url: 'Solo se permiten archivos JPG, PNG o WebP',
      }));
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      setInstructorErrors((prev) => ({ ...prev, photo_url: 'La imagen no debe superar los 5 MB' }));
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    setInstructorPhotoFile(file);
    setInstructorPhotoPreview(blobUrl);
    setInstructorForm((prev) => ({ ...prev, photo_url: blobUrl }));
    setInstructorErrors((prev) => {
      const n = { ...prev };
      delete n.photo_url;
      return n;
    });
  };

  const handleInstructorPhotoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] || null;
    if (!file) return;

    const inputEvent = {
      target: { files: e.dataTransfer.files },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleInstructorPhotoChange(inputEvent);
  };

  const handleRemoveInstructorPhoto = () => {
    setInstructorPhotoFile(null);
    if (instructorPhotoPreview && instructorPhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(instructorPhotoPreview);
    }
    setInstructorPhotoPreview(null);
    setInstructorForm((prev) => ({ ...prev, photo_url: '' }));
  };

  const handleUploadInstructorPhoto = async () => {
    if (!instructorPhotoFile) return;

    setUploadingInstructorPhoto(true);
    setInstructorErrors((prev) => {
      const n = { ...prev };
      delete n.photo_url;
      return n;
    });

    try {
      const formData = new FormData();
      formData.append('file', instructorPhotoFile);
      formData.append('instructorId', editingInstructor?.id || 'new');

      const { uploadInstructorPhoto } = await import('@/app/admin/actions/courses');
      const result = await uploadInstructorPhoto(formData);

      if ('error' in result) {
        throw new Error(result.error);
      }

      const publicUrl = result.url;

      // Save to both photo_url and avatar_url for sync
      setInstructorForm((prev) => ({ ...prev, photo_url: publicUrl, avatar_url: publicUrl }));
      setInstructorPhotoFile(null);
      toast.success('Foto del instructor subida correctamente');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error subiendo foto';
      setInstructorErrors((prev) => ({
        ...prev,
        photo_url: errorMessage,
      }));
      toast.error(errorMessage);
    } finally {
      setUploadingInstructorPhoto(false);
    }
  };

  // ─── Module Handlers ────────────────────────────────────────────────────────

  const handleNewModule = (courseId: string) => {
    setModuleCourseId(courseId);
    setEditingModule(null);
    const course = courses.find((c) => c.id === courseId);
    const nextPosition = course?.modules?.length || 0;
    setModuleForm({ title: '', description: '', position: nextPosition });
    setModuleErrors({});
    setModuleModalOpen(true);
  };

  const handleEditModule = (module: CourseModule) => {
    setEditingModule(module);
    setModuleCourseId(module.course_id);
    setModuleForm({
      title: module.title,
      description: module.description || '',
      position: module.position,
    });
    setModuleErrors({});
    setModuleModalOpen(true);
  };

  const handleModuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateModuleForm(moduleForm);
    if (Object.keys(errors).length > 0) {
      setModuleErrors(errors);
      return;
    }

    setSaving(editingModule?.id || 'new');
    try {
      if (editingModule) {
        await updateModule(editingModule.id, moduleForm);
      } else if (moduleCourseId) {
        await createModule(moduleCourseId, moduleForm);
      }
      setModuleModalOpen(false);
      await refreshCourses();
    } catch (err) {
      setModuleErrors({ submit: err instanceof Error ? err.message : 'Error guardando módulo' });
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteModule = (module: CourseModule) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Módulo',
      message: `¿Eliminar "${module.title}"? Se eliminarán todas sus lecciones y recursos asociados.`,
      onConfirm: async () => {
        setConfirmDialog((prev) => (prev ? { ...prev, loading: true } : null));
        try {
          await deleteModule(module.id);
          await refreshCourses();
        } catch (err) {
          console.error('Error deleting module:', err);
        } finally {
          setConfirmDialog(null);
        }
      },
      variant: 'danger',
    });
  };

  const handleModuleReorder = async (courseId: string, moduleIds: string[]) => {
    try {
      await reorderModules(courseId, moduleIds);
      await refreshCourses();
    } catch (err) {
      console.error('Error reordering modules:', err);
    }
  };

  // ─── Lesson Handlers ────────────────────────────────────────────────────────

  const handleNewLesson = (moduleId: string, courseId: string) => {
    setLessonModuleId(moduleId);
    setLessonCourseId(courseId);
    setEditingLesson(null);
    const module = courses.flatMap((c) => c.modules || []).find((m) => m.id === moduleId);
    const nextPosition = module?.lessons?.length || 0;
    setLessonForm({
      title: '',
      description: '',
      duration_seconds: 0,
      position: nextPosition,
      video_provider: 'supabase',
      video_asset_id: '',
      is_free_preview: false,
    });
    setLessonErrors({});
    setVideoUploadProgress(null);
    setLessonModalOpen(true);
  };

  const handleEditLesson = (lesson: Lesson, courseId: string) => {
    setEditingLesson(lesson);
    setLessonModuleId(lesson.module_id);
    setLessonCourseId(courseId);
    setLessonForm({
      title: lesson.title,
      description: lesson.description || '',
      duration_seconds: lesson.duration_seconds,
      position: lesson.position,
      video_provider: lesson.video_provider,
      video_asset_id: lesson.video_asset_id || '',
      is_free_preview: lesson.is_free_preview,
    });
    setLessonErrors({});
    setVideoUploadProgress(null);
    setLessonModalOpen(true);
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateLessonForm(lessonForm);
    if (Object.keys(errors).length > 0) {
      setLessonErrors(errors);
      return;
    }

    setSaving(editingLesson?.id || 'new');
    try {
      if (editingLesson) {
        await updateLesson(editingLesson.id, lessonForm);
      } else if (lessonModuleId) {
        await createLesson(lessonModuleId, lessonForm);
      }
      setLessonModalOpen(false);
      await refreshCourses();
    } catch (err) {
      setLessonErrors({ submit: err instanceof Error ? err.message : 'Error guardando lección' });
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteLesson = (lesson: Lesson) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Lección',
      message: `¿Eliminar "${lesson.title}"? Se eliminarán todos sus recursos asociados.`,
      onConfirm: async () => {
        setConfirmDialog((prev) => (prev ? { ...prev, loading: true } : null));
        try {
          await deleteLesson(lesson.id);
          await refreshCourses();
        } catch (err) {
          console.error('Error deleting lesson:', err);
        } finally {
          setConfirmDialog(null);
        }
      },
      variant: 'danger',
    });
  };

  const handleLessonReorder = async (moduleId: string, lessonIds: string[]) => {
    try {
      await reorderLessons(moduleId, lessonIds);
      await refreshCourses();
    } catch (err) {
      console.error('Error reordering lessons:', err);
    }
  };

  // ─── Resource Handlers ──────────────────────────────────────────────────────

  const handleNewResource = (lessonId: string, courseId: string) => {
    setResourceLessonId(lessonId);
    setResourceCourseId(courseId);
    setEditingResource(null);
    const lesson = courses
      .flatMap((c) => c.modules || [])
      .flatMap((m) => m.lessons || [])
      .find((l) => l.id === lessonId);
    const nextPosition = lesson?.resources?.length || 0;
    setResourceForm({
      display_name: '',
      file_type: 'PDF',
      required_tier: 'obturador',
      sort_order: nextPosition,
    });
    setResourceFile(null);
    setResourceErrors({});
    setResourceModalOpen(true);
  };

  const handleEditResource = (resource: LessonResource) => {
    setEditingResource(resource);
    setResourceLessonId(resource.lesson_id);
    setResourceCourseId(resource.course_id);
    setResourceForm({
      display_name: resource.display_name,
      file_type: resource.file_type,
      required_tier: resource.required_tier,
      sort_order: resource.sort_order,
    });
    setResourceFile(null);
    setResourceErrors({});
    setResourceModalOpen(true);
  };

  const handleResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!resourceForm.display_name.trim()) errors.display_name = 'El nombre visible es obligatorio';
    if (!editingResource && !resourceFile) errors.file = 'Debes seleccionar un archivo';

    if (Object.keys(errors).length > 0) {
      setResourceErrors(errors);
      return;
    }

    setSaving(editingResource?.id || 'new');
    try {
      if (editingResource) {
        await updateLessonResource(editingResource.id, resourceForm);
      } else if (resourceFile && resourceCourseId && resourceLessonId) {
        // The file is already uploaded in the modal, get the storage path
        const uploadData = (window as any).__resourceUploadData;
        if (uploadData) {
          await createLessonResourceRecord(resourceCourseId, resourceLessonId, {
            ...resourceForm,
            file_name: uploadData.fileName,
            file_size: uploadData.fileSize,
            storage_path: uploadData.storagePath,
          });
        } else {
          throw new Error('No se pudo obtener la ruta del archivo subido');
        }
      } else if (!editingResource) {
        throw new Error('Faltan datos para subir el recurso (curso, lección o archivo)');
      }
      setResourceModalOpen(false);
      await refreshCourses();
    } catch (err) {
      setResourceErrors({ submit: err instanceof Error ? err.message : 'Error guardando recurso' });
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteResource = (resource: LessonResource) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Recurso',
      message: `¿Eliminar "${resource.display_name}"?`,
      onConfirm: async () => {
        setConfirmDialog((prev) => (prev ? { ...prev, loading: true } : null));
        try {
          await deleteLessonResource(resource.id);
          await refreshCourses();
        } catch (err) {
          console.error('Error deleting resource:', err);
        } finally {
          setConfirmDialog(null);
        }
      },
      variant: 'danger',
    });
  };

  const handleResourceReorder = async (lessonId: string, resourceIds: string[]) => {
    try {
      await reorderLessonResources(lessonId, resourceIds);
      await refreshCourses();
    } catch (err) {
      console.error('Error reordering resources:', err);
    }
  };

  const toggleCourse = (courseId: string) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  // ─── InstructorsTab Component ───────────────────────────────────────────────────

  function InstructorsTab({
    instructors,
    onNewInstructor,
    onEditInstructor,
    onDeleteInstructor,
  }: {
    instructors: Instructor[];
    onNewInstructor: () => void;
    onEditInstructor: (instructor: Instructor) => void;
    onDeleteInstructor: (instructor: Instructor) => void;
  }) {
    if (instructors.length === 0) {
      return (
        <div className="p-12 text-center">
          <Icon name="UsersIcon" size={48} className="mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-600 text-foreground mb-1">No hay instructores aún</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Añade instructores para asignarlos a tus cursos
          </p>
          <button
            onClick={onNewInstructor}
            className="btn-primary px-6 py-3 inline-flex items-center gap-2"
          >
            <Icon name="PlusIcon" size={18} />
            Crear Instructor
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {instructors.map((instructor) => (
          <motion.div
            key={instructor.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-5 border-white/10 hover:border-primary/30 transition-colors group"
          >
            <div className="relative aspect-square mb-4 overflow-hidden rounded-lg">
              {instructor.photo_url || instructor.avatar_url ? (
                <AppImage
                  src={instructor.photo_url || instructor.avatar_url!}
                  alt={instructor.photo_alt || instructor.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="200px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Icon name="UserIcon" size={32} className="text-muted-foreground/50" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <h4 className="font-600 text-foreground truncate">{instructor.name}</h4>
              {instructor.specialty && (
                <p className="text-sm text-muted-foreground truncate">{instructor.specialty}</p>
              )}
              {instructor.tags && instructor.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {instructor.tags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                  {instructor.tags.length > 3 && (
                    <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                      +{instructor.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditInstructor(instructor);
                  }}
                  className="btn-ghost text-xs px-3 py-1.5 flex-1 flex items-center justify-center gap-1"
                  title="Editar"
                >
                  <Icon name="PencilIcon" size={12} />
                  Editar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteInstructor(instructor);
                  }}
                  className="btn-ghost text-xs px-3 py-1.5 text-red-400 hover:bg-red-500/10 flex-1 flex items-center justify-center gap-1"
                  title="Eliminar"
                >
                  <Icon name="TrashIcon" size={12} />
                  Eliminar
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {/* Add Instructor Card */}
        <button
          type="button"
          onClick={onNewInstructor}
          className="glass-card rounded-xl p-5 border-white/10 hover:border-primary/30 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-3 min-h-[200px]"
        >
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
            <Icon name="PlusIcon" size={28} className="text-primary" />
          </div>
          <div className="text-center">
            <p className="font-600 text-foreground">Crear Instructor</p>
            <p className="text-xs text-muted-foreground mt-0.5">Añadir nuevo instructor</p>
          </div>
        </button>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-700 text-foreground">Gestión de Cursos</h2>
          <p className="text-sm text-muted-foreground">
            Crea y gestiona la estructura completa: Curso → Módulos → Lecciones → Recursos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleNewCourse}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Icon name="PlusIcon" size={16} />
            Nuevo Curso
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        <button
          onClick={() => setActiveTab('courses')}
          className={`flex-1 px-4 py-2 text-sm font-500 rounded-md transition-colors ${
            activeTab === 'courses'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Cursos
        </button>
        <button
          onClick={() => setActiveTab('instructors')}
          className={`flex-1 px-4 py-2 text-sm font-500 rounded-md transition-colors ${
            activeTab === 'instructors'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Instructores
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'courses' && (
          <motion.div
            key="courses"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Courses List */}
            <div className="glass-card rounded-xl overflow-hidden border-white/10">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Icon
                    name="ArrowPathIcon"
                    size={24}
                    className="mx-auto mb-2 animate-spin text-primary"
                  />
                  <p>Cargando cursos...</p>
                </div>
              ) : courses.length === 0 ? (
                <div className="p-12 text-center">
                  <Icon
                    name="FilmIcon"
                    size={48}
                    className="mx-auto mb-4 text-muted-foreground/50"
                  />
                  <h3 className="text-lg font-600 text-foreground mb-1">No hay cursos aún</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Crea tu primer curso para empezar a construir el catálogo
                  </p>
                  <button
                    onClick={handleNewCourse}
                    className="btn-primary px-6 py-3 inline-flex items-center gap-2"
                  >
                    <Icon name="PlusIcon" size={18} />
                    Crear Curso
                  </button>
                </div>
              ) : (
                <table className="w-full">
                  <tbody className="divide-y divide-border/50">
                    {courses.map((course) => (
                      <CourseRow
                        key={course.id}
                        course={course}
                        isExpanded={expandedCourses.has(course.id)}
                        onToggle={() => toggleCourse(course.id)}
                        onEdit={handleEditCourse}
                        onDelete={handleDeleteCourse}
                        onNewModule={(id) => handleNewModule(id)}
                        modules={course.modules || []}
                        expandedModules={expandedModules}
                        onToggleModule={toggleModule}
                        onEditModule={handleEditModule}
                        onDeleteModule={handleDeleteModule}
                        onReorderModules={handleModuleReorder}
                        onNewLesson={(id) => handleNewLesson(id, course.id)}
                        onEditLesson={(lesson) => handleEditLesson(lesson, course.id)}
                        onDeleteLesson={handleDeleteLesson}
                        onReorderLessons={handleLessonReorder}
                        onNewResource={handleNewResource}
                        onEditResource={handleEditResource}
                        onDeleteResource={handleDeleteResource}
                        onReorderResources={handleResourceReorder}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'instructors' && (
          <motion.div
            key="instructors"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="glass-card rounded-xl overflow-hidden border-white/10 p-6">
              <InstructorsTab
                instructors={instructors}
                onNewInstructor={handleNewInstructor}
                onEditInstructor={handleEditInstructor}
                onDeleteInstructor={handleDeleteInstructor}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <CourseModal
        isOpen={courseModalOpen}
        onClose={() => setCourseModalOpen(false)}
        onSubmit={handleCourseSubmit}
        form={courseForm}
        errors={courseErrors}
        setForm={setCourseForm}
        setErrors={setCourseErrors}
        categories={categories}
        instructors={instructors}
        editing={editingCourse}
        saving={saving === (editingCourse?.id || 'new')}
      />

      <ModuleModal
        isOpen={moduleModalOpen}
        onClose={() => setModuleModalOpen(false)}
        onSubmit={handleModuleSubmit}
        form={moduleForm}
        errors={moduleErrors}
        setForm={setModuleForm}
        setErrors={setModuleErrors}
        editing={editingModule}
        saving={saving === (editingModule?.id || 'new')}
      />

      <LessonModal
        isOpen={lessonModalOpen}
        onClose={() => setLessonModalOpen(false)}
        onSubmit={handleLessonSubmit}
        form={lessonForm}
        errors={lessonErrors}
        setForm={setLessonForm}
        setErrors={setLessonErrors}
        editing={editingLesson}
        saving={saving === (editingLesson?.id || 'new')}
        videoUploadProgress={videoUploadProgress}
        uploadingVideo={uploadingVideo}
        setVideoUploadProgress={setVideoUploadProgress}
        setUploadingVideo={setUploadingVideo}
        lessonCourseId={lessonCourseId}
        onNewResource={handleNewResource}
        onEditResource={handleEditResource}
        onDeleteResource={handleDeleteResource}
      />

      <ResourceModal
        isOpen={resourceModalOpen}
        onClose={() => setResourceModalOpen(false)}
        onSubmit={handleResourceSubmit}
        form={resourceForm}
        file={resourceFile}
        errors={resourceErrors}
        setForm={setResourceForm}
        setFile={setResourceFile}
        setErrors={setResourceErrors}
        editing={editingResource}
        saving={saving === (editingResource?.id || 'new')}
        resourceCourseId={resourceCourseId}
        resourceLessonId={resourceLessonId}
      />

      <InstructorModal
        isOpen={instructorModalOpen}
        onClose={() => setInstructorModalOpen(false)}
        onSubmit={handleInstructorSubmit}
        form={instructorForm}
        errors={instructorErrors}
        setForm={setInstructorForm}
        setErrors={setInstructorErrors}
        editing={editingInstructor}
        saving={saving === 'instructor'}
        uploadingPhoto={uploadingInstructorPhoto}
        photoPreview={instructorPhotoPreview}
        photoFile={instructorPhotoFile}
        onPhotoChange={handleInstructorPhotoChange}
        onPhotoDrop={handleInstructorPhotoDrop}
        onRemovePhoto={handleRemoveInstructorPhoto}
        onUploadPhoto={handleUploadInstructorPhoto}
      />

      <ConfirmDialog
        isOpen={confirmDialog?.isOpen ?? false}
        onClose={() => setConfirmDialog(null)}
        onConfirm={confirmDialog?.onConfirm ?? (() => {})}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        confirmText={confirmDialog?.variant === 'danger' ? 'Eliminar' : 'Confirmar'}
        variant={confirmDialog?.variant ?? 'danger'}
        loading={confirmDialog?.loading ?? false}
      />
    </div>
  );
}

const getStatusBadge = (status: CourseStatus) => (
  <span className={`text-xs px-2 py-0.5 rounded-full font-600 ${COURSE_STATUS_COLORS[status]}`}>
    {COURSE_STATUS_LABELS[status]}
  </span>
);

const getAccessTypeBadge = (type: string) => {
  const labels: Record<string, string> = {
    free: 'Gratis',
    membership: 'Membresía',
    premium_purchase: 'Premium',
  };
  const colors: Record<string, string> = {
    free: 'bg-green-500/10 text-green-400 border-green-500/20',
    membership: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    premium_purchase: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-600 border ${colors[type] || colors.free}`}
    >
      {labels[type] || type}
    </span>
  );
};

const getResourceTypeColor = (type: ResourceFileType) => {
  const colorMap: Record<ResourceFileType, string> = {
    PDF: 'bg-red-500/10 text-red-400 border-red-500/20',
    XMP: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    LRT: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    ATN: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    ICC: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    CUBE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    NEF: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    CR2: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    ARW: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    DNG: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    RAW: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    ZIP: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    LUT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    OTHER: 'bg-muted text-muted-foreground border-border',
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded font-600 border ${colorMap[type] || colorMap.OTHER}`}
    >
      <Icon name="FileIcon" size={10} />
      {type}
    </span>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CourseRow({
  course,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onNewModule,
  modules,
  expandedModules,
  onToggleModule,
  onEditModule,
  onDeleteModule,
  onReorderModules,
  onNewLesson,
  onEditLesson,
  onDeleteLesson,
  onReorderLessons,
  onNewResource,
  onEditResource,
  onDeleteResource,
  onReorderResources,
}: {
  course: Course;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (course: Course) => void;
  onDelete: (course: Course) => void;
  onNewModule: (courseId: string) => void;
  modules: CourseModule[];
  expandedModules: Set<string>;
  onToggleModule: (moduleId: string) => void;
  onEditModule: (module: CourseModule) => void;
  onDeleteModule: (module: CourseModule) => void;
  onReorderModules: (courseId: string, moduleIds: string[]) => void;
  onNewLesson: (moduleId: string) => void;
  onEditLesson: (lesson: Lesson) => void;
  onDeleteLesson: (lesson: Lesson) => void;
  onReorderLessons: (moduleId: string, lessonIds: string[]) => void;
  onNewResource: (lessonId: string, courseId: string) => void;
  onEditResource: (resource: LessonResource) => void;
  onDeleteResource: (resource: LessonResource) => void;
  onReorderResources: (lessonId: string, resourceIds: string[]) => void;
}) {
  const totalLessons = modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0);
  const totalResources = modules
    .flatMap((m) => m.lessons || [])
    .flatMap((l) => l.resources || []).length;
  // Usar computedDuration si existe (calculado sumando lecciones), sino usar course.duration
  const displayDuration = (course as any).computedDuration || course.duration || '—';

  return (
    <>
      {/* Course Header Row */}
      <motion.tr
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`cursor-pointer transition-colors ${isExpanded ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
        onClick={onToggle}
      >
        <td className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Icon
              name={isExpanded ? 'ChevronDownIcon' : 'ChevronRightIcon'}
              size={18}
              className="text-muted-foreground transition-transform"
            />
            <div className="flex items-center gap-2">
              {course.thumbnail && (
                <img
                  src={course.thumbnail}
                  alt={course.thumbnail_alt || course.title}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              )}
              <div>
                <p className="font-600 text-foreground">{course.title}</p>
                <p className="text-xs text-muted-foreground">{course.slug}</p>
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <TierBadge tier={course.tier as any} size="sm" />
            {getAccessTypeBadge(course.access_type)}
            {getStatusBadge(course.status)}
          </div>
        </td>
        <td className="px-4 py-4 text-sm text-foreground font-500">
          {course.price ? `$${course.price}` : <span className="text-muted-foreground">—</span>}
        </td>
        <td className="px-4 py-4 text-sm text-muted-foreground">
          {totalLessons} lecciones · {totalResources} recursos · {displayDuration}
        </td>
        <td className="px-4 py-4 text-sm text-muted-foreground">
          {course.instructor?.name || '—'}
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(course);
              }}
              className="text-muted-foreground hover:text-foreground p-1"
              title="Editar"
            >
              <Icon name="PencilIcon" size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(course);
              }}
              className="text-muted-foreground hover:text-red-400 p-1"
              title="Eliminar"
            >
              <Icon name="TrashIcon" size={16} />
            </button>
          </div>
        </td>
      </motion.tr>

      {/* Expanded Course Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <td colSpan={7} className="p-0">
              <div className="bg-muted/30 border-t border-border/50 px-4 pb-4">
                <div className="flex items-center justify-between mb-4 pt-4">
                  <h4 className="text-sm font-600 text-foreground">Módulos y Lecciones</h4>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNewModule(course.id);
                    }}
                    className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1"
                  >
                    <Icon name="PlusIcon" size={12} />
                    Añadir Módulo
                  </button>
                </div>

                {modules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Icon name="FolderIcon" size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      No hay módulos. Crea el primero para estructurar tu curso.
                    </p>
                  </div>
                ) : (
                  <ModuleList
                    modules={modules}
                    expandedModules={expandedModules}
                    courseId={course.id}
                    onToggleModule={onToggleModule}
                    onEditModule={onEditModule}
                    onDeleteModule={onDeleteModule}
                    onReorderModules={() =>
                      onReorderModules(
                        course.id,
                        modules.map((m) => m.id)
                      )
                    }
                    onNewLesson={onNewLesson}
                    onEditLesson={onEditLesson}
                    onDeleteLesson={onDeleteLesson}
                    onReorderLessons={onReorderLessons}
                    onNewResource={onNewResource}
                    onEditResource={onEditResource}
                    onDeleteResource={onDeleteResource}
                    onReorderResources={onReorderResources}
                  />
                )}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

function ModuleList({
  modules,
  expandedModules,
  onToggleModule,
  onEditModule,
  onDeleteModule,
  onReorderModules,
  onNewLesson,
  onEditLesson,
  onDeleteLesson,
  onReorderLessons,
  onNewResource,
  onEditResource,
  onDeleteResource,
  onReorderResources,
  courseId,
}: {
  modules: CourseModule[];
  expandedModules: Set<string>;
  onToggleModule: (moduleId: string) => void;
  onEditModule: (module: CourseModule) => void;
  onDeleteModule: (module: CourseModule) => void;
  onReorderModules: () => void;
  onNewLesson: (moduleId: string, courseId: string) => void;
  onEditLesson: (lesson: Lesson, courseId: string) => void;
  onDeleteLesson: (lesson: Lesson) => void;
  onReorderLessons: (moduleId: string, lessonIds: string[]) => void;
  onNewResource: (lessonId: string, courseId: string) => void;
  onEditResource: (resource: LessonResource) => void;
  onDeleteResource: (resource: LessonResource) => void;
  onReorderResources: (lessonId: string, resourceIds: string[]) => void;
  courseId: string;
}) {
  return (
    <div className="space-y-3">
      {modules.map((module, index) => (
        <ModuleRow
          key={module.id}
          module={module}
          index={index}
          isFirst={index === 0}
          isLast={index === modules.length - 1}
          isExpanded={expandedModules.has(module.id)}
          onToggle={() => onToggleModule(module.id)}
          onEdit={onEditModule}
          onDelete={onDeleteModule}
          onMoveUp={() => {
            // Simplified - in real app use proper reorder
          }}
          onMoveDown={() => {
            // Simplified - in real app use proper reorder
          }}
          onNewLesson={(id) => onNewLesson(id, courseId)}
          onEditLesson={(lesson) => onEditLesson(lesson, courseId)}
          onDeleteLesson={onDeleteLesson}
          courseId={courseId}
          onReorderLessons={() =>
            onReorderLessons(
              module.id,
              (module.lessons || []).map((l) => l.id)
            )
          }
          onNewResource={onNewResource}
          onEditResource={onEditResource}
          onDeleteResource={onDeleteResource}
          onReorderResources={onReorderResources}
        />
      ))}
    </div>
  );
}

function ModuleRow({
  module,
  index,
  isFirst,
  isLast,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onNewLesson,
  onEditLesson,
  onDeleteLesson,
  onReorderLessons,
  onNewResource,
  onEditResource,
  onDeleteResource,
  onReorderResources,
  courseId,
}: {
  module: CourseModule;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (module: CourseModule) => void;
  onDelete: (module: CourseModule) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onNewLesson: (moduleId: string, courseId: string) => void;
  onEditLesson: (lesson: Lesson, courseId: string) => void;
  onDeleteLesson: (lesson: Lesson) => void;
  onReorderLessons: () => void;
  onNewResource: (lessonId: string, courseId: string) => void;
  onEditResource: (resource: LessonResource) => void;
  onDeleteResource: (resource: LessonResource) => void;
  onReorderResources: (lessonId: string, resourceIds: string[]) => void;
  courseId: string;
}) {
  const lessons = module.lessons || [];
  const totalDuration = lessons.reduce((sum, l) => sum + l.duration_seconds, 0);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-background/50">
      <div className="flex items-center gap-3 p-3 bg-muted/30 cursor-pointer" onClick={onToggle}>
        <Icon
          name={isExpanded ? 'ChevronDownIcon' : 'ChevronRightIcon'}
          size={18}
          className="text-muted-foreground flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-600 text-foreground">{module.title}</span>
            <span className="text-xs text-muted-foreground px-2 py-0.5 bg-background rounded">
              Módulo {index + 1}
            </span>
            <span className="text-xs text-muted-foreground">
              {lessons.length} lecciones · {formatDuration(totalDuration)}
            </span>
          </div>
          {module.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{module.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(module);
            }}
            className="btn-ghost text-xs px-2 py-1"
            title="Editar"
          >
            <Icon name="PencilIcon" size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(module);
            }}
            className="btn-ghost text-xs px-2 py-1 text-red-400 hover:bg-red-500/10"
            title="Eliminar"
          >
            <Icon name="TrashIcon" size={12} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2 border-t border-border/50">
              <LessonList
                lessons={lessons}
                moduleId={module.id}
                courseId={courseId}
                onNewLesson={onNewLesson}
                onEditLesson={onEditLesson}
                onDeleteLesson={onDeleteLesson}
                onReorderLessons={onReorderLessons}
                onNewResource={onNewResource}
                onEditResource={onEditResource}
                onDeleteResource={onDeleteResource}
                onReorderResources={onReorderResources}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LessonList({
  lessons,
  moduleId,
  courseId,
  onNewLesson,
  onEditLesson,
  onDeleteLesson,
  onReorderLessons,
  onNewResource,
  onEditResource,
  onDeleteResource,
  onReorderResources,
}: {
  lessons: Lesson[];
  moduleId: string;
  courseId: string;
  onNewLesson: (moduleId: string, courseId: string) => void;
  onEditLesson: (lesson: Lesson, courseId: string) => void;
  onDeleteLesson: (lesson: Lesson) => void;
  onReorderLessons: () => void;
  onNewResource: (lessonId: string, courseId: string) => void;
  onEditResource: (resource: LessonResource) => void;
  onDeleteResource: (resource: LessonResource) => void;
  onReorderResources: (lessonId: string, resourceIds: string[]) => void;
}) {
  if (lessons.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground border-2 border-dashed border-border rounded-xl">
        <Icon name="FilmIcon" size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay lecciones en este módulo</p>
        <button
          onClick={() => onNewLesson(moduleId, courseId)}
          className="btn-primary text-xs px-3 py-1.5 mt-2 inline-flex items-center gap-1"
        >
          <Icon name="PlusIcon" size={12} />
          Añadir Lección
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {lessons.map((lesson, index) => (
        <LessonRow
          key={lesson.id}
          lesson={lesson}
          index={index}
          courseId={courseId}
          onEdit={onEditLesson}
          onDelete={onDeleteLesson}
          onNewResource={onNewResource}
          onEditResource={onEditResource}
          onDeleteResource={onDeleteResource}
          onReorderResources={() =>
            onReorderResources(
              lesson.id,
              (lesson.resources || []).map((r) => r.id)
            )
          }
        />
      ))}
      <button
        onClick={() => onNewLesson(moduleId, courseId)}
        className="btn-ghost text-xs w-full py-2 flex items-center justify-center gap-1"
      >
        <Icon name="PlusIcon" size={12} />
        Añadir otra lección
      </button>
    </div>
  );
}

function LessonRow({
  lesson,
  index,
  onEdit,
  onDelete,
  onNewResource,
  onEditResource,
  onDeleteResource,
  onReorderResources,
  courseId,
}: {
  lesson: Lesson;
  index: number;
  onEdit: (lesson: Lesson, courseId: string) => void;
  onDelete: (lesson: Lesson) => void;
  onNewResource: (lessonId: string, courseId: string) => void;
  onEditResource: (resource: LessonResource) => void;
  onDeleteResource: (resource: LessonResource) => void;
  onReorderResources: () => void;
  courseId: string;
}) {
  const resources = lesson.resources || [];
  const providerLabel = VIDEO_PROVIDER_LABELS[lesson.video_provider];

  return (
    <div className="bg-background rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xs font-mono text-muted-foreground w-6 text-right">
            {index + 1}.
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-500 text-foreground truncate">{lesson.title}</span>
              {lesson.is_free_preview && (
                <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full font-500">
                  Vista previa gratis
                </span>
              )}
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-background rounded border border-border">
                {providerLabel}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDuration(lesson.duration_seconds)}
              </span>
            </div>
            {lesson.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {lesson.description}
              </p>
            )}
            {lesson.video_asset_id && (
              <p className="text-xs text-muted-foreground/70 font-mono mt-1 truncate">
                ID: {lesson.video_asset_id}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onNewResource(lesson.id, courseId)}
            className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
            title="Añadir recurso"
          >
            <Icon name="PlusIcon" size={11} />
            Recurso
          </button>
          <button
            onClick={() => onEdit(lesson, courseId)}
            className="btn-ghost text-xs px-2 py-1"
            title="Editar"
          >
            <Icon name="PencilIcon" size={12} />
          </button>
          <button
            onClick={() => onDelete(lesson)}
            className="btn-ghost text-xs px-2 py-1 text-red-400 hover:bg-red-500/10"
            title="Eliminar"
          >
            <Icon name="TrashIcon" size={12} />
          </button>
        </div>
      </div>

      {/* Resources */}
      <AnimatePresence>
        {resources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden ml-11 border-l border-border/30 pl-3 pt-2 space-y-1.5"
          >
            <div className="space-y-1">
              {resources.map((resource, resIndex) => (
                <ResourceRow
                  key={resource.id}
                  resource={resource}
                  index={resIndex}
                  lessonId={lesson.id}
                  courseId={resource.course_id}
                  onEdit={onEditResource}
                  onDelete={onDeleteResource}
                  onReorder={onReorderResources}
                />
              ))}
            </div>
            <button
              onClick={() => onNewResource(lesson.id, courseId)}
              className="btn-ghost text-xs px-2 py-1 flex items-center gap-1 mt-1"
            >
              <Icon name="PlusIcon" size={11} />
              Añadir recurso
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {resources.length === 0 && (
        <div className="ml-11 border-l border-border/30 pl-3 pt-2">
          <button
            onClick={() => onNewResource(lesson.id, courseId)}
            className="btn-ghost text-xs px-2 py-1 flex items-center gap-1"
          >
            <Icon name="PlusIcon" size={11} />
            Añadir primer recurso
          </button>
        </div>
      )}
    </div>
  );
}

function ResourceRow({
  resource,
  index,
  lessonId,
  courseId,
  onEdit,
  onDelete,
  onReorder,
}: {
  resource: LessonResource;
  index: number;
  lessonId: string;
  courseId: string;
  onEdit: (resource: LessonResource) => void;
  onDelete: (resource: LessonResource) => void;
  onReorder: () => void;
}) {
  const typeColor = getResourceTypeColor(resource.file_type);

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors">
      <span className={`text-xs px-2 py-0.5 rounded font-600 ${typeColor}`}>
        {resource.file_type}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-500 text-foreground truncate">{resource.display_name}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <span>{resource.file_size}</span>
          <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-600">
            {resource.required_tier}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onEdit(resource)} className="btn-ghost text-xs p-1" title="Editar">
          <Icon name="PencilIcon" size={11} />
        </button>
        <button
          onClick={() => onDelete(resource)}
          className="btn-ghost text-xs p-1 text-red-400 hover:bg-red-500/10"
          title="Eliminar"
        >
          <Icon name="TrashIcon" size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── Modal Components ─────────────────────────────────────────────────────────

function CourseModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  errors,
  setForm,
  setErrors,
  categories,
  instructors,
  editing,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: CourseFormData;
  errors: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<CourseFormData>>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  categories: { id: string; name: string }[];
  instructors: Instructor[];
  editing: Course | null;
  saving: boolean;
}) {
  // ─── Hooks (must run unconditionally on every render) ───────────────────

  // Thumbnail upload state
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [draggingThumbnail, setDraggingThumbnail] = useState(false);

  // When editing an existing course, show its current thumbnail as preview
  useEffect(() => {
    if (editing && form.thumbnail && !thumbnailPreview && !thumbnailFile) {
      setThumbnailPreview(form.thumbnail);
    }
  }, [editing, form.thumbnail, thumbnailFile]);

  // When the modal closes, reset thumbnail preview state to avoid stale blob URLs
  useEffect(() => {
    if (!isOpen) {
      setThumbnailFile(null);
      setThumbnailPreview(null);
      setUploadingThumbnail(false);
      setDraggingThumbnail(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ─── Thumbnail Upload ───────────────────────────────────────────────

  const revokeObjectUrl = (url: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  };

  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    console.log(
      '[Thumbnail Debug] Archivo detectado:',
      file ? { name: file.name, type: file.type, size: file.size } : null
    );
    if (!file) return;

    // Validación estricta: solo JPG y PNG
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setErrors((prev) => ({ ...prev, thumbnail: 'Solo se permiten archivos JPG o PNG' }));
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      setErrors((prev) => ({
        ...prev,
        thumbnail: 'La imagen no debe superar los 5 MB',
      }));
      return;
    }
    setThumbnailFile(file);
    revokeObjectUrl(thumbnailPreview);
    setThumbnailPreview(URL.createObjectURL(file));
    setErrors((prev) => {
      const n = { ...prev };
      delete n.thumbnail;
      return n;
    });
  };

  const handleThumbnailDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] || null;
    if (!file) return;
    // Reuse the file-input change logic
    const inputEvent = {
      target: { files: e.dataTransfer.files },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleThumbnailFileChange(inputEvent);
  };

  const handleThumbnailPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const file = e.clipboardData?.files?.[0] || null;
    if (!file) return;

    // Validación estricta para archivos pegados: solo JPG y PNG
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setErrors((prev) => ({ ...prev, thumbnail: 'Solo se permiten archivos JPG o PNG' }));
      return;
    }

    const inputEvent = {
      target: { files: e.clipboardData.files },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleThumbnailFileChange(inputEvent);
  };

  const handleRemoveThumbnail = () => {
    setThumbnailFile(null);
    revokeObjectUrl(thumbnailPreview);
    setThumbnailPreview(null);
    setForm((prev) => ({ ...prev, thumbnail: '' }));
    setErrors((prev) => {
      const n = { ...prev };
      delete n.thumbnail;
      return n;
    });
  };

  const handleUploadThumbnail = async () => {
    if (!thumbnailFile) return;
    setUploadingThumbnail(true);
    try {
      const supabase = createClient();
      const bucketName = STORAGE_BUCKETS.COURSE_THUMBNAILS;

      // Verificar/crear bucket 'course-thumbnails' antes de subir
      const { error: bucketCheckError } = await supabase.storage.from(bucketName).list('', {
        limit: 1,
      });
      if (bucketCheckError) {
        // Si el bucket no existe, intentar crearlo (requiere service role o permisos adecuados)
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: true,
        });
        if (createError) {
          throw new Error(
            `El bucket de almacenamiento '${bucketName}' no existe y no se pudo crear automáticamente: ${createError.message}. ` +
              `Crea el bucket manualmente en el panel de Supabase Storage (Storage > Create new bucket) ` +
              `con nombre exacto '${bucketName}' y visibilidad 'Public'.`
          );
        }
        console.log(`[Supabase Storage] Bucket '${bucketName}' creado automáticamente`);
      }

      const courseId = editing?.id || globalThis.crypto.randomUUID();
      const sanitizedName = thumbnailFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${Date.now()}-${sanitizedName}`;
      const storagePath = `${bucketName}/${courseId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, thumbnailFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('[Supabase Storage] Error subiendo portada:', {
          storagePath,
          error: uploadError,
          // Extra info for RLS/policy debugging (StorageError properties)
          errorCode: (uploadError as any).code || 'unknown',
          errorDetails: (uploadError as any).details || 'none',
          errorHint: (uploadError as any).hint || 'none',
        });

        // Detailed error handling for RLS/policy issues
        const errorMsg = uploadError.message || 'Error desconocido';
        if (
          errorMsg.includes('policy') ||
          errorMsg.includes('RLS') ||
          errorMsg.includes('permission denied') ||
          errorMsg.includes('unauthorized')
        ) {
          throw new Error(
            `Error de políticas de almacenamiento (RLS): ${errorMsg}. ` +
              `Verifica en Supabase Dashboard > Storage > Policies que el bucket '${bucketName}' ` +
              `tenga políticas INSERT/SELECT habilitadas para 'anon' y 'authenticated' roles.`
          );
        }
        throw new Error(`Error subiendo portada: ${errorMsg}`);
      }

      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;

      // Validar que la URL pública es válida (https:// de Supabase)
      if (!publicUrl || !publicUrl.startsWith('https://')) {
        throw new Error('No se pudo generar una URL pública válida desde Supabase Storage');
      }

      console.log('[Thumbnail Debug] Resultado de subida:', {
        uploadError: null,
        storagePath,
        publicUrl,
      });

      console.log('[Thumbnail Upload] publicUrl obtenida:', publicUrl);

      // Almacenar la publicUrl de forma síncrona y obligatoria en courseForm.thumbnail
      setForm((prev) => ({ ...prev, thumbnail: publicUrl }));
      revokeObjectUrl(thumbnailPreview);
      setThumbnailPreview(publicUrl);
      setThumbnailFile(null);
      setErrors((prev) => {
        const n = { ...prev };
        delete n.thumbnail;
        return n;
      });
      toast.success('Portada subida correctamente');
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        thumbnail: err instanceof Error ? err.message : 'Error subiendo portada',
      }));
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setForm((prev) => {
      const updated = { ...prev, [name]: newValue };

      // Sync instructor name when instructor_id changes
      if (name === 'instructor_id') {
        const selectedInstructor = instructors.find((i) => i.id === newValue);
        updated.instructor = selectedInstructor?.name || '';
      }

      return updated;
    });

    if (errors[name])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl glass-card rounded-xl p-6 border-white/10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-700 text-foreground">
            {editing ? 'Editar Curso' : 'Nuevo Curso'}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="Cerrar">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Título *" error={errors.title} required>
              <Input
                id="title"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Título del curso"
                autoFocus
              />
            </FormField>

            <FormField
              label="Slug *"
              error={errors.slug}
              required
              helpText="Solo minúsculas, números y guiones"
            >
              <Input
                id="slug"
                name="slug"
                value={form.slug}
                onChange={handleChange}
                placeholder="mi-curso-fotografia"
              />
            </FormField>
          </div>

          <FormField label="Descripción" error={errors.description}>
            <Textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Descripción del curso para el catálogo..."
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Categoría" error={errors.category_id}>
              <Select
                id="category_id"
                name="category_id"
                value={form.category_id || ''}
                onChange={handleChange}
                options={[
                  { value: '', label: 'Sin categoría' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </FormField>

            <FormField label="Instructor" error={errors.instructor_id}>
              <Select
                id="instructor_id"
                name="instructor_id"
                value={form.instructor_id || ''}
                onChange={handleChange}
                options={(function () {
                  const instructorOptions = instructors.map((i: Instructor) => ({
                    value: i.id,
                    label: i.name + (i.specialty ? ` - ${i.specialty}` : ''),
                  }));
                  return [{ value: '', label: 'Sin instructor' }, ...instructorOptions];
                })()}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <FormField label="Duración" error={errors.duration} helpText="Ej: 2h 30m, 150m, 9000s">
              <Input
                id="duration"
                name="duration"
                value={form.duration}
                onChange={handleChange}
                placeholder="2h 30m"
              />
            </FormField>

            <FormField label="Tier mínimo" error={errors.tier}>
              <Select
                id="tier"
                name="tier"
                value={form.tier}
                onChange={handleChange}
                options={TIER_OPTIONS}
              />
            </FormField>

            <FormField label="Tipo de acceso" error={errors.access_type}>
              <Select
                id="access_type"
                name="access_type"
                value={form.access_type}
                onChange={handleChange}
                options={ACCESS_TYPE_OPTIONS}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField
              label="Precio (USD)"
              error={errors.price}
              helpText="Solo para cursos Premium"
            >
              <Input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                value={form.price?.toString() || ''}
                onChange={handleChange}
                placeholder="0.00"
              />
            </FormField>

            <FormField label="Estado" error={errors.status}>
              <Select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                options={COURSE_STATUS_OPTIONS}
              />
            </FormField>
          </div>

          {/* Thumbnail Upload Dropzone */}
          <FormField label="Portada del curso" error={errors.thumbnail}>
            <div className="space-y-3">
              {/* Dropzone area - only for drag/drop/click/paste to SELECT file */}
              <div
                onDrop={(e) => {
                  e.preventDefault();
                  setDraggingThumbnail(false);
                  handleThumbnailDrop(e);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDraggingThumbnail(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDraggingThumbnail(false);
                }}
                onPaste={handleThumbnailPaste}
                tabIndex={0}
                role="button"
                aria-label="Portada del curso"
                className={`relative flex flex-col items-center justify-center px-6 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  draggingThumbnail
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-primary/5'
                }`}
              >
                {/* Hidden file input - only covers the dropzone, not the action buttons below */}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleThumbnailFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Seleccionar imagen de portada"
                />

                {!thumbnailPreview && !uploadingThumbnail ? (
                  <>
                    <Icon name="ArrowUpTrayIcon" size={28} className="text-muted-foreground mb-2" />
                    <p className="text-sm text-foreground font-500">
                      Hacer clic, arrastrar o pegar (Ctrl+V)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG (máx. 5 MB)</p>
                  </>
                ) : (
                  <>
                    {thumbnailPreview && (
                      <img
                        src={thumbnailPreview}
                        alt="Vista previa de la portada"
                        className="w-32 h-32 object-cover rounded-lg shadow-xl mb-2"
                      />
                    )}
                    {uploadingThumbnail && (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-primary/30 rounded-full border-t-primary animate-spin" />
                        <p className="text-xs text-primary font-600">Subiendo portada...</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Action buttons - SEPARATED from dropzone to prevent click bubbling to file input */}
              {thumbnailPreview && !uploadingThumbnail && (
                <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUploadThumbnail();
                    }}
                    disabled={!thumbnailFile || uploadingThumbnail}
                    className="btn-primary text-xs px-4 py-2 rounded-md w-full sm:w-auto"
                  >
                    Confirmar portada
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveThumbnail();
                    }}
                    className="btn-ghost text-xs px-3 py-1.5 rounded-md w-full sm:w-auto"
                  >
                    Cambiar portada
                  </button>
                </div>
              )}
              {uploadingThumbnail && (
                <div className="flex flex-col items-center gap-2 w-full sm:w-auto">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-8 h-8 border-2 border-primary/30 rounded-full border-t-primary animate-spin" />
                    <p className="text-xs text-primary font-600">Subiendo portada...</p>
                  </div>
                </div>
              )}
            </div>

            {form.thumbnail && !thumbnailPreview && (
              <p className="text-xs text-muted-foreground mt-1">
                Actual: {form.thumbnail.split('/').pop()}
              </p>
            )}
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-4 py-2"
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary px-6 py-2" disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function ModuleModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  errors,
  setForm,
  setErrors,
  editing,
  saving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: ModuleFormData;
  errors: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<ModuleFormData>>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editing: CourseModule | null;
  saving: boolean;
}) {
  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md glass-card rounded-xl p-6 border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-700 text-foreground">
            {editing ? 'Editar Módulo' : 'Nuevo Módulo'}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="Cerrar">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <FormField label="Título *" error={errors.title} required>
            <Input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Título del módulo"
              autoFocus
            />
          </FormField>

          <FormField label="Descripción" error={errors.description}>
            <Textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Descripción opcional del módulo..."
            />
          </FormField>

          <FormField label="Posición" error={errors.position}>
            <Input
              id="position"
              name="position"
              type="number"
              min="0"
              value={form.position.toString()}
              onChange={handleChange}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-4 py-2"
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary px-6 py-2" disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function LessonModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  errors,
  setForm,
  setErrors,
  editing,
  saving,
  videoUploadProgress,
  uploadingVideo,
  setVideoUploadProgress,
  setUploadingVideo,
  lessonCourseId,
  onNewResource,
  onEditResource,
  onDeleteResource,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: LessonFormData;
  errors: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<LessonFormData>>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editing: Lesson | null;
  saving: boolean;
  videoUploadProgress: number | null;
  uploadingVideo: boolean;
  setVideoUploadProgress: React.Dispatch<React.SetStateAction<number | null>>;
  setUploadingVideo: React.Dispatch<React.SetStateAction<boolean>>;
  lessonCourseId: string | null;
  onNewResource: (lessonId: string, courseId: string) => void;
  onEditResource: (resource: LessonResource) => void;
  onDeleteResource: (resource: LessonResource) => void;
}) {
  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const parsedValue =
      type === 'number'
        ? parseInt(value) || 0
        : type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : value;
    setForm((prev) => ({ ...prev, [name]: parsedValue }));
    if (errors[name])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl glass-card rounded-xl p-6 border-white/10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-700 text-foreground">
            {editing ? 'Editar Lección' : 'Nueva Lección'}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1" aria-label="Cerrar">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <FormField label="Título *" error={errors.title} required>
            <Input
              id="title"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Título de la lección"
              autoFocus
            />
          </FormField>

          <FormField label="Descripción" error={errors.description}>
            <Textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Descripción opcional de la lección..."
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField
              label="Duración (segundos)"
              error={errors.duration}
              helpText="O usa formato: 1h 30m, 90m, 5400s"
            >
              <Input
                id="duration_seconds"
                name="duration_seconds"
                type="number"
                min="0"
                value={form.duration_seconds.toString()}
                onChange={handleChange}
                placeholder="3600"
              />
            </FormField>

            <FormField label="Posición" error={errors.position}>
              <Input
                id="position"
                name="position"
                type="number"
                min="0"
                value={form.position.toString()}
                onChange={handleChange}
              />
            </FormField>
          </div>

          <FormField label="Proveedor de video" error={errors.video_provider}>
            <Select
              id="video_provider"
              name="video_provider"
              value={form.video_provider}
              onChange={handleChange}
              options={[
                { value: 'supabase', label: 'Supabase Storage' },
                { value: 'bunny', label: 'Bunny.net Stream' },
                { value: 'vimeo', label: 'Vimeo' },
              ]}
            />
          </FormField>

          <FormField
            label={`Video Asset ID (${VIDEO_PROVIDER_LABELS[form.video_provider]})`}
            error={errors.video_asset_id}
            helpText={VIDEO_PROVIDER_PLACEHOLDERS[form.video_provider]}
          >
            <Input
              id="video_asset_id"
              name="video_asset_id"
              value={form.video_asset_id}
              onChange={handleChange}
              placeholder={VIDEO_PROVIDER_PLACEHOLDERS[form.video_provider]}
            />
            {form.video_provider === 'supabase' && lessonCourseId && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm font-500 text-foreground mb-2">
                    Subir archivo de video (MP4, WebM, MOV)
                  </label>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !lessonCourseId) return;

                      setUploadingVideo(true);
                      setVideoUploadProgress(0);

                      // Generate lesson ID - use existing if editing, or generate new UUID for new lessons
                      const lessonId = editing?.id || globalThis.crypto.randomUUID();

                      // Simulate progress updates (will be replaced by real progress if available)
                      const progressInterval = setInterval(() => {
                        setVideoUploadProgress((prev) => {
                          if (prev === null || prev >= 90) return prev ?? 90;
                          return prev + 10;
                        });
                      }, 200);

                      try {
                        // Upload directly from client using Supabase JS client
                        const supabase = createClient();

                        // Sanitize filename
                        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                        const fileName = `${Date.now()}-${sanitizedName}`;
                        const storagePath = `${lessonCourseId}/${lessonId}.mp4`;

                        const { error: uploadError } = await supabase.storage
                          .from('videos')
                          .upload(storagePath, file, {
                            cacheControl: '3600',
                            upsert: false,
                          });

                        clearInterval(progressInterval);

                        if (uploadError) {
                          throw new Error(`Error subiendo video: ${uploadError.message}`);
                        }

                        setVideoUploadProgress(100);

                        // Update the video_asset_id with the storage path
                        setForm((prev) => ({ ...prev, video_asset_id: storagePath }));

                        // Show success
                        setTimeout(() => setVideoUploadProgress(null), 2000);
                        setUploadingVideo(false);
                      } catch (err) {
                        clearInterval(progressInterval);
                        setVideoUploadProgress(null);
                        setUploadingVideo(false);
                        setErrors((prev) => ({
                          ...prev,
                          video_asset_id:
                            err instanceof Error ? err.message : 'Error subiendo video',
                        }));
                      }
                    }}
                    disabled={uploadingVideo}
                    className="w-full px-4 py-2.5 text-sm border-border bg-input rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-primary/60 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {uploadingVideo && !editing?.id && (
                    <p className="text-xs text-amber-400 mt-1">
                      Guarda la lección primero para poder subir el video.
                    </p>
                  )}
                </div>

                {videoUploadProgress !== null && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Subiendo video...</span>
                      <span className="text-primary font-600">{videoUploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full progress-bar rounded-full transition-all duration-300"
                        style={{ width: `${videoUploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {form.video_provider === 'vimeo' && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm font-500 text-foreground mb-2">
                    Pegar URL de Vimeo o ID numérico
                  </label>
                  <input
                    type="text"
                    value={form.video_asset_id}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const cleanId = extractVimeoId(raw);
                      setForm((prev) => ({ ...prev, video_asset_id: cleanId }));
                    }}
                    placeholder="https://vimeo.com/1246953838?share=copy o 1246953838"
                    className="w-full px-4 py-2.5 text-sm border-border bg-input rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-primary/60"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Se extraerá automáticamente el ID numérico. Ej:{' '}
                    <code className="bg-muted px-1 rounded">https://vimeo.com/1246953838</code> →{' '}
                    <code className="bg-muted px-1 rounded">1246953838</code>
                  </p>
                </div>
              </div>
            )}
          </FormField>

          <FormField label="" error={errors.is_free_preview}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                id="is_free_preview"
                name="is_free_preview"
                checked={form.is_free_preview}
                onChange={handleChange}
                className="w-4 h-4 rounded border-border bg-input text-primary focus:ring-primary focus:ring-2"
              />
              <span className="text-sm text-foreground">Marcar como vista previa gratuita</span>
            </label>
            <p className="text-xs text-muted-foreground mt-1">
              Las lecciones de vista previa son accesibles sin comprar el curso ni tener membresía.
            </p>
          </FormField>

          {/* Recursos Descargables de la Lección */}
          {editing && (
            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-600 text-foreground mb-3 flex items-center gap-2">
                <Icon name="ArchiveBoxIcon" size={16} />
                Recursos Descargables de la Lección
              </h4>
              {editing.resources && editing.resources.length > 0 ? (
                <div className="space-y-2">
                  {editing.resources.map((resource) => (
                    <div
                      key={resource.id}
                      className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-600 ${getResourceTypeColor(resource.file_type)}`}
                        >
                          {resource.file_type}
                        </span>
                        <div>
                          <p className="text-sm font-500 text-foreground">
                            {resource.display_name}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <span>{resource.file_size}</span>
                            <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-600">
                              {resource.required_tier}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onEditResource(resource);
                          }}
                          className="btn-ghost text-xs p-1"
                          title="Editar"
                        >
                          <Icon name="PencilIcon" size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteResource(resource)}
                          className="btn-ghost text-xs p-1 text-red-400 hover:bg-red-500/10"
                          title="Eliminar"
                        >
                          <Icon name="TrashIcon" size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay recursos en esta lección.</p>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNewResource(editing.id, lessonCourseId!);
                }}
                className="btn-ghost w-full mt-3 py-2 flex items-center justify-center gap-2"
              >
                <Icon name="PlusIcon" size={14} />
                Añadir Recurso
              </button>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-4 py-2"
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary px-6 py-2" disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function ResourceModal({
  isOpen,
  onClose,
  onSubmit,
  form,
  file,
  errors,
  setForm,
  setFile,
  setErrors,
  editing,
  saving,
  resourceCourseId,
  resourceLessonId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: Omit<ResourceFormData, 'file'>;
  file: File | null;
  errors: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<Omit<ResourceFormData, 'file'>>>;
  setFile: React.Dispatch<React.SetStateAction<File | null>>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editing: LessonResource | null;
  saving: boolean;
  resourceCourseId: string | null;
  resourceLessonId: string | null;
}) {
  if (!isOpen) return null;

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) {
      // Auto-populate fields from file
      const fileName = f.name;
      const fileExtension = fileName.split('.').pop()?.toUpperCase() || 'OTHER';
      const fileSize = formatFileSize(f.size);

      // Check if extension matches a known file type
      const matchedType = RESOURCE_FILE_TYPES.find((t) =>
        t.extensions.some((ext) => ext.toLowerCase() === `.${fileExtension.toLowerCase()}`)
      );
      const fileType = matchedType?.value || (fileExtension as any);

      setForm((prev) => ({
        ...prev,
        display_name: fileName,
        file_type: fileType,
        // file_size is auto-generated on server
      }));
    }
    if (f && errors.file)
      setErrors((prev) => {
        const n = { ...prev };
        delete n.file;
        return n;
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For new resources, upload file first
    if (!editing && file && resourceCourseId && resourceLessonId) {
      setUploading(true);
      setUploadProgress(0);

      // Timeout de seguridad para que la UI nunca quede congelada si Supabase no responde
      const timeoutId = setTimeout(() => {
        setUploading(false);
        setUploadProgress(null);
        setErrors((prev) => ({
          ...prev,
          submit:
            'La subida tardó demasiado tiempo y se canceló. Revisa tu conexión o inténtalo de nuevo.',
        }));
      }, 120000); // 2 minutos

      try {
        // Asegurar que el bucket 'resources' existe antes de subir
        const supabase = createClient();
        const bucketName = STORAGE_BUCKETS.RESOURCES;
        const { error: bucketCheckError } = await supabase.storage.from(bucketName).list('', {
          limit: 1,
        });
        if (bucketCheckError) {
          // Si el bucket no existe, intentar crearlo (requiere rol de servicio o permisos adecuados)
          const { error: createError } = await supabase.storage.createBucket(bucketName, {
            public: true,
          });
          if (createError) {
            throw new Error(
              `El bucket de almacenamiento '${bucketName}' no existe y no se pudo crear: ${createError.message}. Crea el bucket en el panel de Supabase Storage.`
            );
          }
        }

        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storagePath = `${resourceCourseId}/${resourceLessonId}/${fileName}`;

        setUploadProgress(20);

        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        clearTimeout(timeoutId);

        if (uploadError) {
          console.error('[Supabase Storage] Error subiendo recurso:', {
            storagePath,
            error: uploadError,
            errorCode: (uploadError as any).code || 'unknown',
            errorDetails: (uploadError as any).details || 'none',
            errorHint: (uploadError as any).hint || 'none',
          });

          // Detailed error handling for RLS/policy issues
          const errorMsg = uploadError.message || 'Error desconocido';
          if (
            errorMsg.includes('policy') ||
            errorMsg.includes('RLS') ||
            errorMsg.includes('permission denied') ||
            errorMsg.includes('unauthorized')
          ) {
            throw new Error(
              `Error de políticas de almacenamiento (RLS): ${errorMsg}. ` +
                `Verifica en Supabase Dashboard > Storage > Policies que el bucket '${bucketName}' ` +
                `tenga políticas INSERT/SELECT habilitadas para 'anon' y 'authenticated' roles.`
            );
          }
          throw new Error(`Error subiendo archivo: ${errorMsg}`);
        }

        setUploadProgress(100);

        // Obtener URL pública del bucket
        const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
        const publicUrl = urlData.publicUrl;

        // Almacenar ruta y metadatos para que el componente padre cree el registro en BD
        (window as any).__resourceUploadData = {
          storagePath,
          fileName: file.name,
          fileSize: formatFileSize(file.size),
        };

        // Crear registro en la base de datos vía server action
        await onSubmit(e);

        // Limpieza
        delete (window as any).__resourceUploadData;
        setUploadProgress(null);
        setUploading(false);
        setFile(null);
      } catch (err) {
        clearTimeout(timeoutId);
        setUploadProgress(null);
        setUploading(false);
        setErrors((prev) => ({
          ...prev,
          submit: err instanceof Error ? err.message : 'Error subiendo recurso',
        }));
        console.error('Error subiendo recurso:', err);
      }
    } else {
      // Para edición, solo se envía el formulario
      await onSubmit(e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md glass-card rounded-xl p-6 border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-700 text-foreground">
            {editing ? 'Editar Recurso' : 'Nuevo Recurso'}
          </h3>
          <button
            onClick={onClose}
            className="btn-ghost p-1"
            aria-label="Cerrar"
            disabled={uploading}
          >
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!editing && (
            <FormField label="Archivo *" error={errors.file} required>
              <FileInput
                accept=".pdf,.xmp,.lrtemplate,.atn,.icc,.icm,.cube,.3dl,.nef,.cr2,.arw,.dng,.raw,.rw2,.orf,.pef,.zip,.lut,.csp"
                onChange={handleFileChange}
                selectedFile={file}
              />
            </FormField>
          )}

          <FormField label="Nombre visible *" error={errors.display_name} required>
            <Input
              id="display_name"
              name="display_name"
              value={form.display_name}
              onChange={handleChange}
              placeholder="Ej: Preset Lightroom - Tonos Cálidos"
            />
          </FormField>

          <FormField label="Tipo de archivo" error={errors.file_type}>
            <Select
              id="file_type"
              name="file_type"
              value={form.file_type}
              onChange={handleChange}
              options={RESOURCE_FILE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
          </FormField>

          <FormField label="Tier mínimo requerido" error={errors.required_tier}>
            <Select
              id="required_tier"
              name="required_tier"
              value={form.required_tier}
              onChange={handleChange}
              options={[
                { value: 'free', label: 'Gratis (Sin membresía)' },
                { value: 'apertura', label: 'Apertura' },
                { value: 'obturador', label: 'Obturador' },
                { value: 'diafragma', label: 'Diafragma' },
              ]}
            />
          </FormField>

          <FormField label="Orden" error={errors.sort_order}>
            <Input
              id="sort_order"
              name="sort_order"
              type="number"
              min="0"
              value={form.sort_order.toString()}
              onChange={handleChange}
            />
          </FormField>

          {uploading && uploadProgress !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Subiendo archivo...</span>
                <span className="text-primary font-600">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full progress-bar rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-4 py-2"
              disabled={saving || uploading}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary px-6 py-2" disabled={saving || uploading}>
              {uploading
                ? 'Subiendo...'
                : saving
                  ? 'Guardando...'
                  : editing
                    ? 'Actualizar'
                    : 'Subir'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
