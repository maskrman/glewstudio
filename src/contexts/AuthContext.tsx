'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    metadata?: { fullName?: string; avatarUrl?: string; plan?: string; couponCode?: string }
  ) => Promise<{ user: User | null; session: Session | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ user: User | null; session: Session | null }>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<User | null>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<Record<string, unknown> | null>;
  validateCoupon: (
    code: string
  ) => Promise<{ valid: boolean; discount_percent: number; message: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Email/Password Sign Up
   *
   * Security note: Subscription creation is handled exclusively by a
   * SECURITY DEFINER database trigger (create_free_subscription_for_new_user).
   * The trigger creates tier='apertura', status='trialing' — never premium/active.
   * Premium subscriptions can only be granted by server-side webhooks.
   * See: src/app/api/webhooks/payment/route.ts
   * See: supabase/migrations/20260818200000_security_hardening_phase1.sql
   */
  const signUp = async (
    email: string,
    password: string,
    metadata: { fullName?: string; avatarUrl?: string; plan?: string; couponCode?: string } = {}
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || '',
          // Pass coupon code in metadata for server-side processing
          coupon_code: metadata?.couponCode || '',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;

    // ✅ SECURITY: Subscription is created by DB trigger (server-side SECURITY DEFINER).
    // The client MUST NOT insert into subscriptions — RLS blocks it.
    // No client-side subscription insert here.

    return { user: data.user, session: data.session };
  };

  // Validate coupon using Supabase RPC
  const validateCoupon = async (
    code: string
  ): Promise<{ valid: boolean; discount_percent: number; message: string }> => {
    const { data, error } = await supabase.rpc('validate_coupon', { p_code: code.toUpperCase() });

    if (error) {
      console.error('[AuthContext] Error validating coupon:', error);
      return { valid: false, discount_percent: 0, message: 'Error validando cupón' };
    }

    // RPC returns an array of rows
    if (data && data.length > 0) {
      return data[0] as { valid: boolean; discount_percent: number; message: string };
    }

    return { valid: false, discount_percent: 0, message: 'Cupón no válido' };
  };

  // Email/Password Sign In
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return { user: data.user, session: data.session };
  };

  // Sign Out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // Get Current User (re-validates with Supabase server)
  const getCurrentUser = async (): Promise<User | null> => {
    const {
      data: { user: u },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return u;
  };

  // Check if Email is Verified
  const isEmailVerified = (): boolean => {
    return user?.email_confirmed_at != null;
  };

  /**
   * Get User Profile from Database
   */
  const getUserProfile = async (): Promise<Record<string, unknown> | null> => {
    if (!user) return null;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw error;
    return data as Record<string, unknown>;
  };

  const value: AuthContextValue = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
    validateCoupon,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
