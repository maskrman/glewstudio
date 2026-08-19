/**
 * Subscription service — GLEW Studio
 *
 * Client-side and shared subscription helpers.
 * All functions here use the browser Supabase client.
 *
 * For server-side subscription access, use:
 *   import { createClient } from '@/lib/supabase/server';
 * directly in Server Components or Route Handlers.
 *
 * ⚠️  SENSITIVE OPERATIONS NOTE:
 * - getUserSubscriptionTier() reads from the client — result is for UI only.
 * - Authorization must always be re-validated server-side (RLS + API routes).
 * - Never trust client-side tier checks for access control decisions.
 */

import { createClient } from '@/lib/supabase/client';
import {
  type SubscriptionTier,
  TIER_RANK,
  MEMBERSHIP_DISCOUNTS,
  MEMBERSHIP_PRICES,
  calculateCoursePrice,
  hasAccess,
  tierRank,
  TIER_LABELS,
  TIER_SHORT_LABELS,
} from '@/lib/config';

export type { SubscriptionTier };
export {
  TIER_RANK,
  MEMBERSHIP_DISCOUNTS,
  MEMBERSHIP_PRICES,
  calculateCoursePrice,
  hasAccess,
  tierRank,
  TIER_LABELS,
  TIER_SHORT_LABELS,
};

/**
 * Backward-compat alias: formatted price strings.
 * Prefer MEMBERSHIP_PRICES from @/lib/config for numeric values.
 */
export const TIER_PRICES: Record<string, string> = {
  apertura: `$${MEMBERSHIP_PRICES.apertura.monthly}/mes`,
  obturador: `$${MEMBERSHIP_PRICES.obturador.monthly}/mes`,
  diafragma: `$${MEMBERSHIP_PRICES.diafragma.monthly}/mes`,
};

/**
 * Fetches the active subscription tier for the currently authenticated user.
 * Returns null if not authenticated or no active subscription.
 *
 * ⚠️  Client-side only — result is for UI rendering, NOT for authorization.
 */
export async function getUserSubscriptionTier(): Promise<SubscriptionTier | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      console.warn('Subscription fetch error:', error.message);
      return null;
    }

    return (data?.tier as SubscriptionTier) ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if the current user has purchased a specific course.
 *
 * ⚠️  Client-side only — result is for UI rendering, NOT for authorization.
 * Server-side access validation is enforced via RLS and the video-token API.
 */
export async function checkCoursePurchase(courseId: string): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  try {
    const { data } = await supabase
      .from('course_purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .eq('purchase_status', 'paid')
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
