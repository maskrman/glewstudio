'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
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
 *
 * SECURITY FIX (Audit Phase 2, Issue #5):
 *   Access requires EITHER:
 *   A. Active subscription with tier >= resource.required_tier
 *      (status = active AND tier rank >= required tier rank)
 *   B. Paid course purchase:
 *      user_id = auth.uid() AND course_id = resource.course_id AND purchase_status = 'paid'
 *      (NOT just any purchase row — must be explicitly paid)
 *
 *   Previously: course_purchase check did not verify purchase_status = 'paid'.
 *   A pending or refunded purchase would have granted access.
 */
export async function generateSignedDownloadUrl(
  resourceId: string
): Promise<SignedDownloadResult> {
  try {
    const supabase = await createClient();

    // 1. Verify authentication — user_id always from server-side session
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

    // 3. Check active subscription with sufficient tier
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    // 4. Check paid course purchase (explicit: user_id + course_id + purchase_status = 'paid')
    // SECURITY: Must verify purchase_status = 'paid' explicitly.
    // pending, failed, refunded, chargeback do NOT grant access.
    const { data: paidPurchase } = await supabase
      .from('course_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', resource.course_id)
      .eq('purchase_status', 'paid')
      .maybeSingle();

    const hasPaidPurchase = !!paidPurchase;

    // 5. Evaluate access
    const userTierRank = subscription ? (TIER_RANK[subscription.tier] ?? 0) : 0;
    const requiredTierRank = TIER_RANK[resource.required_tier] ?? 1;
    const hasSubscriptionAccess = !!subscription && userTierRank >= requiredTierRank;
    const hasAccess = hasSubscriptionAccess || hasPaidPurchase;

    if (!hasAccess) {
      const requiredLabel = TIER_LABELS[resource.required_tier] ?? resource.required_tier;
      return {
        url: null,
        error: `Acceso denegado. Este recurso requiere ${requiredLabel}.`,
      };
    }

    // 6. Generate signed URL from private bucket
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

    // 7. Log download using service-role admin client (non-blocking — fire and forget)
    // Regular users no longer have INSERT on downloads (Phase 2 hardening).
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    supabaseAdmin
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
