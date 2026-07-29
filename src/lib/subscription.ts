'use client';

import { createClient } from '@/lib/supabase/client';

export type SubscriptionTier = 'apertura' | 'obturador' | 'diafragma' | null;

const TIER_RANK: Record<string, number> = {
  apertura: 1,
  obturador: 2,
  diafragma: 3,
};

/**
 * Returns the numeric rank of a tier (higher = more access).
 * null / unknown → 0 (no subscription)
 */
export function tierRank(tier: SubscriptionTier): number {
  if (!tier) return 0;
  return TIER_RANK[tier] ?? 0;
}

/**
 * Returns true if the user's tier meets or exceeds the required tier.
 */
export function hasAccess(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  if (!requiredTier) return true; // no requirement → always accessible
  return tierRank(userTier) >= tierRank(requiredTier);
}

/**
 * Fetches the active subscription tier for the currently authenticated user.
 * Returns null if not authenticated or no active subscription.
 */
export async function getUserSubscriptionTier(): Promise<SubscriptionTier> {
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
      console.log('Subscription fetch error:', error.message);
      return null;
    }

    return (data?.tier as SubscriptionTier) ?? null;
  } catch {
    return null;
  }
}

export const TIER_LABELS: Record<string, string> = {
  apertura: 'Plan Apertura',
  obturador: 'Plan Obturador',
  diafragma: 'Plan Diafragma',
};

export const TIER_PRICES: Record<string, string> = {
  apertura: '$19/mes',
  obturador: '$49/mes',
  diafragma: '$99/mes',
};
