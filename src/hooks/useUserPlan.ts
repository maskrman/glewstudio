'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  hasAccess,
  TIER_LABELS,
  TIER_RANK,
  type SubscriptionTier,
} from '@/lib/config';

// Re-export real implementations from lib/config (single source of truth)
export { hasAccess, TIER_LABELS, TIER_RANK };
export type { SubscriptionTier };

export interface UserPlan {
  tier: SubscriptionTier | null;
  status: string | null;
  expiresAt: string | null;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to get the current user's subscription plan.
 * Returns tier, status, expiry, and access helpers.
 *
 * NOTE: This hook is for UI rendering only.
 * Authorization decisions must always be validated server-side.
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
        const {
          data: { user },
        } = await supabase.auth.getUser();
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
const TIER_PRICES: any = null;

export { TIER_PRICES };