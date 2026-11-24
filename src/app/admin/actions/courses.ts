'use server';

/**
 * GLEW Studio — Admin Courses API Routes
 * Server-side actions for course, module, and lesson management
 */

import { createServiceRoleClient } from '@/lib/supabase/service';
import type {
  CourseFormData,
  ModuleFormData,
  LessonFormData,
  ResourceFormData,
  InstructorFormData,
} from '@/lib/admin-courses';
import type { CourseStatus } from '@/lib/admin-courses';
import { formatDuration } from '@/lib/admin-courses';
import { revalidatePath } from 'next/cache';

// ─── Course Actions ────────────────────────────────────────────────────────────

export async function createCourse(data: CourseFormData) {
  const supabase = createServiceRoleClient();

  // Get instructor name if instructor_id is provided
  let instructorName = '';
  if (data.instructor_id) {
    const { data: instructor } = await supabase
      .from('instructors')
      .select('name')
      .eq('id', data.instructor_id)
      .single();
    instructorName = instructor?.name || '';
  }

  // Only include columns that exist in the database schema
  const insertData: Record<string, unknown> = {
    title: data.title,
    slug: data.slug,
    instructor_id: data.instructor_id,
    instructor: instructorName, // Sync instructor name for backwards compatibility
    thumbnail: data.thumbnail,
    thumbnail_alt: data.thumbnail || '', // Default to empty string or title
    duration: data.duration,
    tier: data.tier,
    access_type: data.access_type,
    price: data.price,
    status: data.status,
    is_published: data.status === 'public' || data.status === 'presale',
  };

  // Add optional fields only if they have values
  if (data.category_id) insertData.category_id = data.category_id;
  if (data.description) insertData.description = data.description; // Will fail silently if column doesn't exist

  const { data: course, error } = await supabase
    .from('courses')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Error creando curso: ${error.message}`);
  }

  // Revalidate admin and public course paths
  revalidatePath('/admin/courses');
  revalidatePath('/courses');
  revalidatePath('/course-detail');

  return course;
}

export async function updateCourse(id: string, data: Partial<CourseFormData>) {
  const supabase = createServiceRoleClient();

  // Only include columns that exist in the database schema
  const updateData: Record<string, unknown> = {};

  // Map known valid columns from the form data
  const validColumns = [
    'title',
    'slug',
    'instructor_id',
    'thumbnail',
    'duration',
    'tier',
    'access_type',
    'price',
    'status',
    'category_id',
  ] as const;

  for (const key of validColumns) {
    if (data[key as keyof CourseFormData] !== undefined) {
      updateData[key] = data[key as keyof CourseFormData];
    }
  }

  // Handle description - will fail silently if column doesn't exist
  if (data.description !== undefined) {
    updateData.description = data.description;
  }

  // Handle instructor_id -> sync instructor name
  if (data.instructor_id !== undefined) {
    if (data.instructor_id) {
      const { data: instructor } = await supabase
        .from('instructors')
        .select('name')
        .eq('id', data.instructor_id)
        .single();
      updateData.instructor = instructor?.name || '';
    } else {
      updateData.instructor = '';
    }
  }

  // Handle status -> is_published
  if (data.status) {
    updateData.is_published = data.status === 'public' || data.status === 'presale';
  }

  const { data: course, error } = await supabase
    .from('courses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error actualizando curso: ${error.message}`);
  }

  // Check if RLS blocked the update (data returned but row not actually updated)
  if (!course) {
    throw new Error(
      'Actualización bloqueada por políticas de seguridad (RLS). Verifica que el usuario tenga permisos de escritura en la tabla courses.'
    );
  }

  // Revalidate admin and public course paths
  revalidatePath('/admin/courses');
  revalidatePath('/courses');
  revalidatePath('/course-detail');

  return course;
}

export async function deleteCourse(id: string) {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from('courses').delete().eq('id', id);

  if (error) {
    throw new Error(`Error eliminando curso: ${error.message}`);
  }

  return { success: true };
}

export async function getCourses() {
  const supabase = createServiceRoleClient();

  // 1. Traer cursos con módulos, lecciones e instructor (sin el join problemático de recursos)
  const { data, error } = await supabase
    .from('courses')
    .select(
      `
      *,
      instructor:instructors (
        id,
        name,
        specialty,
        tags,
        bio,
        photo_url,
        photo_alt,
        created_at,
        updated_at
      ),
      modules:course_modules (
        *,
        lessons:lessons (
          *
        )
      )
    `
    )
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error obteniendo cursos: ${error.message}`);
  }

  // 2. Traer todos los recursos de las lecciones de forma independiente
  const allLessonIds = (data ?? []).flatMap((course: any) =>
    course.modules?.flatMap((m: any) => m.lessons?.map((l: any) => l.id) ?? [])
  );

  let allResources: any[] = [];
  if (allLessonIds.length > 0) {
    const { data: resources, error: resourcesError } = await supabase
      .from('lesson_resources')
      .select('*')
      .in('lesson_id', allLessonIds)
      .order('sort_order', { ascending: true });

    if (resourcesError) {
      throw new Error(`Error obteniendo recursos: ${resourcesError.message}`);
    }

    allResources = resources ?? [];
  }

  // 3. Mapear y asignar recursos a cada lección correspondiente en JavaScript
  // También calcular duración total sumando duration_seconds de todas las lecciones
  const coursesWithResources = (data ?? []).map((course: any) => {
    const modulesWithResources = (course.modules ?? []).map((module: any) => {
      const lessonsWithResources = (module.lessons ?? []).map((lesson: any) => ({
        ...lesson,
        resources: allResources.filter((r: any) => r.lesson_id === lesson.id),
      }));
      return { ...module, lessons: lessonsWithResources };
    });

    // Calcular duración total en segundos sumando todas las lecciones
    const totalSeconds = modulesWithResources.reduce((sum: number, module: any) => {
      const lessonSeconds = (module.lessons ?? []).reduce(
        (lessonSum: number, lesson: any) => lessonSum + (lesson.duration_seconds || 0),
        0
      );
      return sum + lessonSeconds;
    }, 0);

    // Si hay lecciones con duración, usar la suma; sino usar el campo duration del curso
    const computedDuration =
      totalSeconds > 0 ? formatDuration(totalSeconds) : course.duration || '';

    return { ...course, modules: modulesWithResources, computedDuration };
  });

  return coursesWithResources;
}

export async function getCourseWithModules(id: string) {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('courses')
    .select(
      `
      *,
      modules:course_modules (
        *,
        lessons:lessons ( * )
      )
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Error obteniendo curso: ${error.message}`);
  }

  // Convert arrays to newline-separated strings for form display
  if (data) {
    data.what_you_will_learn = Array.isArray(data.what_you_will_learn)
      ? data.what_you_will_learn.join('\n')
      : data.what_you_will_learn || '';
    data.requirements = Array.isArray(data.requirements)
      ? data.requirements.join('\n')
      : data.requirements || '';
  }

  return data;
}

// ─── Module Actions ────────────────────────────────────────────────────────────

export async function createModule(courseId: string, data: ModuleFormData) {
  const supabase = createServiceRoleClient();

  const { data: module, error } = await supabase
    .from('course_modules')
    .insert({
      course_id: courseId,
      title: data.title,
      description: data.description,
      position: data.position,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creando módulo: ${error.message}`);
  }

  return module;
}

export async function updateModule(id: string, data: Partial<ModuleFormData>) {
  const supabase = createServiceRoleClient();

  const { data: module, error } = await supabase
    .from('course_modules')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error actualizando módulo: ${error.message}`);
  }

  return module;
}

export async function deleteModule(id: string) {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from('course_modules').delete().eq('id', id);

  if (error) {
    throw new Error(`Error eliminando módulo: ${error.message}`);
  }

  return { success: true };
}

export async function reorderModules(courseId: string, moduleIds: string[]) {
  const supabase = createServiceRoleClient();

  const updates = moduleIds.map((id, index) =>
    supabase
      .from('course_modules')
      .update({ position: index })
      .eq('id', id)
      .eq('course_id', courseId)
  );

  const results = await Promise.all(updates);

  for (const result of results) {
    if (result.error) {
      throw new Error(`Error reordenando módulos: ${result.error.message}`);
    }
  }

  return { success: true };
}

// ─── Lesson Actions ────────────────────────────────────────────────────────────

export async function createLesson(moduleId: string, data: LessonFormData) {
  const supabase = createServiceRoleClient();

  const { data: lesson, error } = await supabase
    .from('lessons')
    .insert({
      module_id: moduleId,
      title: data.title,
      description: data.description,
      duration_seconds: data.duration_seconds,
      position: data.position,
      video_provider: data.video_provider,
      video_asset_id: data.video_asset_id || null,
      is_free_preview: data.is_free_preview,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creando lección: ${error.message}`);
  }

  // Recalcular duración del curso padre
  const { data: module } = await supabase
    .from('course_modules')
    .select('course_id')
    .eq('id', moduleId)
    .single();
  if (module?.course_id) {
    await recalculateCourseDuration(module.course_id);
  }

  return lesson;
}

// Recalculate course duration from lessons (shared with public actions)
export async function recalculateCourseDuration(courseId: string) {
  const supabase = createServiceRoleClient();

  // Traer todos los módulos con sus lecciones para este curso
  const { data: modules, error: modulesError } = await supabase
    .from('course_modules')
    .select(
      `
      *,
      lessons:lessons (
        duration_seconds
      )
    `
    )
    .eq('course_id', courseId);

  if (modulesError) {
    throw new Error(`Error obteniendo módulos: ${modulesError.message}`);
  }

  // Sumar duración total de todas las lecciones en segundos
  const totalSeconds = (modules ?? []).reduce((sum: number, module: any) => {
    const lessons = module.lessons ?? [];
    const lessonSeconds = lessons.reduce(
      (lessonSum: number, lesson: any) => lessonSum + (lesson.duration_seconds || 0),
      0
    );
    return sum + lessonSeconds;
  }, 0);

  const duration = formatDuration(totalSeconds);

  const { data: course, error } = await supabase
    .from('courses')
    .update({ duration })
    .eq('id', courseId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error actualizando duración del curso: ${error.message}`);
  }

  return course;
}

export async function updateLesson(id: string, data: Partial<LessonFormData>) {
  const supabase = createServiceRoleClient();

  const { data: lesson, error } = await supabase
    .from('lessons')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error actualizando lección: ${error.message}`);
  }

  // Recalcular duración del curso padre
  const { data: module } = await supabase
    .from('course_modules')
    .select('course_id')
    .eq('id', lesson.module_id)
    .single();
  if (module?.course_id) {
    await recalculateCourseDuration(module.course_id);
  }

  return lesson;
}

export async function deleteLesson(id: string) {
  const supabase = createServiceRoleClient();

  // Obtener course_id antes de eliminar
  const { data: lesson } = await supabase.from('lessons').select('module_id').eq('id', id).single();

  const { error } = await supabase.from('lessons').delete().eq('id', id);

  if (error) {
    throw new Error(`Error eliminando lección: ${error.message}`);
  }

  // Recalcular duración del curso padre
  const { data: module } = await supabase
    .from('course_modules')
    .select('course_id')
    .eq('id', lesson?.module_id)
    .single();
  if (module?.course_id) {
    await recalculateCourseDuration(module.course_id);
  }

  return { success: true };
}

export async function reorderLessons(moduleId: string, lessonIds: string[]) {
  const supabase = createServiceRoleClient();

  const updates = lessonIds.map((id, index) =>
    supabase.from('lessons').update({ position: index }).eq('id', id).eq('module_id', moduleId)
  );

  const results = await Promise.all(updates);

  for (const result of results) {
    if (result.error) {
      throw new Error(`Error reordenando lecciones: ${result.error.message}`);
    }
  }

  return { success: true };
}

// ─── Resource Actions ──────────────────────────────────────────────────────────

export async function uploadLessonResource(
  courseId: string,
  lessonId: string,
  file: File,
  metadata: Omit<ResourceFormData, 'file'>
) {
  const supabase = createServiceRoleClient();

  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const storagePath = `${courseId}/${lessonId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('lesson-resources')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Error subiendo archivo: ${uploadError.message}`);
  }

  const { data: resource, error: dbError } = await supabase
    .from('lesson_resources')
    .insert({
      course_id: courseId,
      lesson_id: lessonId,
      file_name: file.name,
      display_name: metadata.display_name,
      file_type: metadata.file_type,
      file_size: formatFileSize(file.size),
      storage_path: storagePath,
      required_tier: metadata.required_tier,
      sort_order: metadata.sort_order,
    })
    .select()
    .single();

  if (dbError) {
    // Rollback storage upload on DB error
    await supabase.storage.from('lesson-resources').remove([storagePath]);
    throw new Error(`Error guardando recurso: ${dbError.message}`);
  }

  return resource;
}

export async function updateLessonResource(
  id: string,
  data: Partial<Omit<ResourceFormData, 'file'>>
) {
  const supabase = createServiceRoleClient();

  const { data: resource, error } = await supabase
    .from('lesson_resources')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error actualizando recurso: ${error.message}`);
  }

  return resource;
}

export async function deleteLessonResource(id: string) {
  const supabase = createServiceRoleClient();

  // Get storage path first
  const { data: resource, error: fetchError } = await supabase
    .from('lesson_resources')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (fetchError) {
    throw new Error(`Error obteniendo recurso: ${fetchError.message}`);
  }

  // Delete from storage
  if (resource.storage_path) {
    await supabase.storage.from('lesson-resources').remove([resource.storage_path]);
  }

  // Delete from database
  const { error: deleteError } = await supabase.from('lesson_resources').delete().eq('id', id);

  if (deleteError) {
    throw new Error(`Error eliminando recurso: ${deleteError.message}`);
  }

  return { success: true };
}

export async function reorderLessonResources(lessonId: string, resourceIds: string[]) {
  const supabase = createServiceRoleClient();

  const updates = resourceIds.map((id, index) =>
    supabase
      .from('lesson_resources')
      .update({ sort_order: index })
      .eq('id', id)
      .eq('lesson_id', lessonId)
  );

  const results = await Promise.all(updates);

  for (const result of results) {
    if (result.error) {
      throw new Error(`Error reordenando recursos: ${result.error.message}`);
    }
  }

  return { success: true };
}

// ─── Client-side Resource Upload (for direct browser upload) ─────────────────────

export async function uploadLessonResourceClient(
  courseId: string,
  lessonId: string,
  file: File,
  metadata: Omit<ResourceFormData, 'file'>
): Promise<{ path: string; publicUrl: string }> {
  // This is a placeholder - actual client upload happens in the component
  // using createClient() from @/lib/supabase/client
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const storagePath = `${courseId}/${lessonId}/${fileName}`;

  return { path: storagePath, publicUrl: '' };
}

export async function createLessonResourceRecord(
  courseId: string,
  lessonId: string,
  metadata: Omit<ResourceFormData, 'file'> & {
    storage_path: string;
    file_name: string;
    file_size: string;
  }
) {
  const supabase = createServiceRoleClient();

  const { data: resource, error } = await supabase
    .from('lesson_resources')
    .insert({
      course_id: courseId,
      lesson_id: lessonId,
      file_name: metadata.file_name,
      display_name: metadata.display_name,
      file_type: metadata.file_type,
      file_size: metadata.file_size,
      storage_path: metadata.storage_path,
      required_tier: metadata.required_tier,
      sort_order: metadata.sort_order,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error guardando recurso: ${error.message}`);
  }

  return resource;
}

// ─── Categories ────────────────────────────────────────────────────────────────

export async function getCategories() {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Error obteniendo categorías: ${error.message}`);
  }

  return data;
}

// ─── Instructor Actions ────────────────────────────────────────────────────────

export async function createInstructor(data: InstructorFormData) {
  const supabase = createServiceRoleClient();

  // Parse tags from comma-separated string
  const tags = data.tags
    ? data.tags
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean)
    : [];

  // Prepare insert data - include avatar_url if photo_url is provided (for sync)
  const insertData: Record<string, unknown> = {
    name: data.name,
    specialty: data.specialty,
    tags: tags,
    bio: data.bio || null,
    photo_url: data.photo_url || null,
    photo_alt: data.photo_alt || null,
  };

  // Also set avatar_url to keep it in sync with photo_url if column exists
  if (data.photo_url) {
    insertData.avatar_url = data.photo_url;
  }

  const { data: instructor, error } = await supabase
    .from('instructors')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Error creando instructor: ${error.message}`);
  }

  return instructor;
}

export async function updateInstructor(id: string, data: Partial<InstructorFormData>) {
  const supabase = createServiceRoleClient();

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.specialty !== undefined) updateData.specialty = data.specialty;
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.photo_url !== undefined) {
    updateData.photo_url = data.photo_url;
    // Also sync avatar_url with photo_url
    updateData.avatar_url = data.photo_url;
  }
  if (data.photo_alt !== undefined) updateData.photo_alt = data.photo_alt;

  if (data.tags !== undefined) {
    updateData.tags = data.tags
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);
  }

  const { data: instructor, error } = await supabase
    .from('instructors')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error actualizando instructor: ${error.message}`);
  }

  return instructor;
}

export async function deleteInstructor(id: string) {
  const supabase = createServiceRoleClient();

  // Check if instructor is used by any courses
  const { data: courses } = await supabase
    .from('courses')
    .select('id')
    .eq('instructor_id', id)
    .limit(1);

  if (courses && courses.length > 0) {
    throw new Error(
      'No se puede eliminar el instructor porque tiene cursos asignados. Reasigna los cursos primero.'
    );
  }

  const { error } = await supabase.from('instructors').delete().eq('id', id);

  if (error) {
    throw new Error(`Error eliminando instructor: ${error.message}`);
  }

  return { success: true };
}

export async function getInstructors() {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('instructors')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    // Manejo seguro si no existe la tabla public.instructors
    // PGRST205 = "Table not found in schema cache"
    const isTableNotFound =
      error.code === 'PGRST205' ||
      error.message?.includes('public.instructors') ||
      error.message?.includes('schema cache');

    if (isTableNotFound) {
      console.warn(
        '[getInstructors] La tabla "instructors" no existe aún. Retornando array vacío.'
      );
      return [];
    }

    throw new Error(`Error obteniendo instructores: ${error.message}`);
  }

  return data ?? [];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ─── Instructor Photo Upload (Server Action) ──────────────────────────────────────

export async function uploadInstructorPhoto(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const supabase = createServiceRoleClient();

  const file = formData.get('file') as File | null;
  const instructorId = (formData.get('instructorId') as string) || 'new';

  if (!file) {
    return { error: 'No se ha proporcionado ningún archivo' };
  }

  // Validar tipo de archivo
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Solo se permiten archivos JPG, PNG o WebP' };
  }

  // Validar tamaño (5 MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { error: 'La imagen no debe superar los 5 MB' };
  }

  const bucketName = 'course-thumbnails';

  // Verificar/crear bucket
  const { error: bucketCheckError } = await supabase.storage
    .from(bucketName)
    .list('', { limit: 1 });
  if (bucketCheckError) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
    });
    if (createError) {
      return { error: `Error creando bucket: ${createError.message}` };
    }
  }

  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${Date.now()}-${sanitizedName}`;
  const storagePath = `instructors/${instructorId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    console.error('[Server Action] Error subiendo foto:', uploadError);
    const errorMsg = uploadError.message || 'Error desconocido';
    if (
      errorMsg.includes('policy') ||
      errorMsg.includes('RLS') ||
      errorMsg.includes('permission denied') ||
      errorMsg.includes('unauthorized') ||
      errorMsg.includes('not found')
    ) {
      return {
        error: `Error de almacenamiento (RLS/Bucket): ${errorMsg}. Verifica políticas en Supabase Dashboard.`,
      };
    }
    return { error: `Error subiendo foto: ${errorMsg}` };
  }

  const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  if (!publicUrl || !publicUrl.startsWith('https://')) {
    return { error: 'No se pudo generar una URL pública válida' };
  }

  return { url: publicUrl };
}
