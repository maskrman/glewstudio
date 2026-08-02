'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { SubscriptionTier } from '@/types/supabase';

export type { SubscriptionTier };

export interface UserPlan {
  tier: SubscriptionTier | null;
  status: string | null;
  expiresAt: string | null;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
}

const TIER_RANK: Record<string, number> = {
  apertura: 1,
  obturador: 2,
  diafragma: 3,
};

export function tierRank(tier: SubscriptionTier | null): number {
  if (!tier) return 0;
  return TIER_RANK[tier] ?? 0;
}

export function hasAccess(userTier: SubscriptionTier | null, requiredTier: SubscriptionTier | null): boolean {
  if (!requiredTier) return true;
  return tierRank(userTier) >= tierRank(requiredTier);
}

export const TIER_LABELS: Record<string, string> = {
  apertura: 'Plan Básico',
  obturador: 'Plan Estándar',
  diafragma: 'Plan VIP',
};

export const TIER_PRICES: Record<string, string> = {
  apertura: '$10/mes',
  obturador: '$25/mes',
  diafragma: '$50/mes',
};

/**
 * Hook to get the current user's subscription plan.
 * Returns tier, status, expiry, and access helpers.
 */
export function useUserPlan(): UserPlan {
  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const fetchPlan = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setTier(null);
          setStatus(null);
          return;
        }

        const { data, error: subError } = await supabase
          .from('subscriptions')
          .select('tier, status, expires_at')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (subError) {
          setError(subError.message);
          return;
        }

        setTier((data?.tier as SubscriptionTier) ?? null);
        setStatus(data?.status ?? null);
        setExpiresAt(data?.expires_at ?? null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error fetching subscription');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlan();
  }, []);

  const isActive = status === 'active' && tier !== null;

  return { tier, status, expiresAt, isActive, isLoading, error };
}

/**
 * Server-side helper to get user subscription tier.
 * Use in Server Components / Route Handlers.
 */
export async function getUserSubscription(userId: string): Promise<{
  tier: SubscriptionTier | null;
  status: string | null;
  isActive: boolean;
}> {
  const { createClient: createServerClient } = await import('@/lib/supabase/server');
  const supabase = await createServerClient();

  const { data } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  const tier = (data?.tier as SubscriptionTier) ?? null;
  const status = data?.status ?? null;
  const isActive = status === 'active' && tier !== null;

  return { tier, status, isActive };
}
