'use server';

import { createClient } from '@/lib/supabase/server';
import { TIER_RANK, TIER_LABELS } from '@/lib/config';

const DOWNLOAD_URL_EXPIRY_SECONDS = 300; // 5 minutes — short-lived for security
const BUCKET_NAME = 'lesson-resources';

export interface LessonResource {
  id: string;
  courseId: string;
  lessonId: string;
  fileName: string;
  displayName: string;
  fileType: string;
  fileSize: string | null;
  storagePath: string;
  requiredTier: string;
  sortOrder: number;
}

export interface LessonResourcesResult {
  resources: LessonResource[];
  error?: string;
}

export interface SignedDownloadResult {
  url: string | null;
  error?: string;
}

/**
 * Server Action: getLessonResources
 *
 * Fetches all downloadable resources for a given course lesson.
 * Requires the user to be authenticated.
 */
export async function getLessonResources(
  courseId: string,
  lessonId: string
): Promise<LessonResourcesResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { resources: [], error: 'No autenticado.' };
    }

    const { data, error } = await supabase
      .from('lesson_resources')
      .select('id, course_id, lesson_id, file_name, display_name, file_type, file_size, storage_path, required_tier, sort_order')
      .eq('course_id', courseId)
      .eq('lesson_id', lessonId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[getLessonResources] Query error:', error.message);
      return { resources: [], error: error.message };
    }

    const resources: LessonResource[] = (data ?? []).map((row) => ({
      id: row.id,
      courseId: row.course_id,
      lessonId: row.lesson_id,
      fileName: row.file_name,
      displayName: row.display_name,
      fileType: row.file_type,
      fileSize: row.file_size,
      storagePath: row.storage_path,
      requiredTier: row.required_tier,
      sortOrder: row.sort_order,
    }));

    return { resources };
  } catch (err) {
    console.error('[getLessonResources] Unexpected error:', err);
    return { resources: [], error: 'Error interno del servidor.' };
  }
}

/**
 * Server Action: generateSignedDownloadUrl
 *
 * Generates a short-lived (5-minute) signed URL for a lesson resource file.
 * Access is granted only when the authenticated user has:
 *   - An active subscription that meets or exceeds the resource's required tier, OR
 *   - A direct course purchase for the course
 *
 * Also logs the download to the public.downloads table.
 */
export async function generateSignedDownloadUrl(
  resourceId: string
): Promise<SignedDownloadResult> {
  try {
    const supabase = await createClient();

    // 1. Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { url: null, error: 'No autenticado. Inicia sesión para descargar.' };
    }

    // 2. Fetch the resource record
    const { data: resource, error: resourceError } = await supabase
      .from('lesson_resources')
      .select('id, course_id, display_name, file_type, file_size, storage_path, required_tier')
      .eq('id', resourceId)
      .maybeSingle();

    if (resourceError || !resource) {
      return { url: null, error: 'Recurso no encontrado.' };
    }

    // 3. Tier hierarchy — imported from @/lib/config (single source of truth)
    // const TIER_RANK is no longer defined locally

    // 4. Check active subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    // 5. Check course purchase (fallback)
    let hasPurchase = false;
    if (!subscription) {
      const { data: purchase } = await supabase
        .from('course_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', resource.course_id)
        .maybeSingle();
      hasPurchase = !!purchase;
    }

    // 6. Evaluate access
    const userTierRank = subscription ? (TIER_RANK[subscription.tier] ?? 0) : 0;
    const requiredTierRank = TIER_RANK[resource.required_tier] ?? 1;
    const hasSubscriptionAccess = subscription && userTierRank >= requiredTierRank;
    const hasAccess = hasSubscriptionAccess || hasPurchase;

    if (!hasAccess) {
      const requiredLabel = TIER_LABELS[resource.required_tier] ?? resource.required_tier;
      return {
        url: null,
        error: `Acceso denegado. Este recurso requiere ${requiredLabel}.`,
      };
    }

    // 7. Generate signed URL from private bucket
    const { data: signedData, error: signError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(resource.storage_path, DOWNLOAD_URL_EXPIRY_SECONDS, {
        download: resource.display_name,
      });

    if (signError || !signedData?.signedUrl) {
      console.warn('[generateSignedDownloadUrl] Could not sign URL:', signError?.message);
      return {
        url: null,
        error: 'El archivo aún no está disponible en el servidor. Contacta al administrador.',
      };
    }

    // 8. Log download (non-blocking — fire and forget)
    supabase
      .from('downloads')
      .insert({
        user_id: user.id,
        file_name: resource.display_name,
        course_title: resource.course_id,
        file_type: resource.file_type,
        file_size: resource.file_size ?? '',
      })
      .then(({ error: logError }) => {
        if (logError) console.warn('[generateSignedDownloadUrl] Log error:', logError.message);
      });

    return { url: signedData.signedUrl };
  } catch (err) {
    console.error('[generateSignedDownloadUrl] Unexpected error:', err);
    return { url: null, error: 'Error interno del servidor.' };
  }
}
