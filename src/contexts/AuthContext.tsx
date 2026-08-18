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
    metadata?: { fullName?: string; avatarUrl?: string; plan?: string }
  ) => Promise<{ user: User | null; session: Session | null }>;
  signIn: (email: string, password: string) => Promise<{ user: User | null; session: Session | null }>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<User | null>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<Record<string, unknown> | null>;
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
   * ⚠️  SENSITIVE OPERATION NOTE:
   * The subscription insert below is a temporary demo pattern.
   * In production, subscription creation MUST be triggered by a verified
   * payment webhook (server-side) — never directly from the client.
   * This code path should be removed once the payment provider is integrated.
   * See: src/app/api/webhooks/payment/route.ts
   */
  const signUp = async (
    email: string,
    password: string,
    metadata: { fullName?: string; avatarUrl?: string; plan?: string } = {}
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || '',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;

    // ⚠️  DEMO ONLY — subscription insert from client is not production-safe.
    // In production this must be triggered by payment confirmation webhook.
    const userId = data.user?.id;
    const tier = metadata?.plan;
    if (userId && tier && tier !== 'free') {
      const { error: subError } = await supabase
        .from('subscriptions')
        .insert({ user_id: userId, tier, status: 'active' });
      if (subError) {
        console.warn('Subscription insert note:', subError.message);
      }
    }

    return { user: data.user, session: data.session };
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
   *
   * ⚠️  NOTE: This queries 'user_profiles' but the migration creates 'profiles'.
   * Align table name with migration before using in production.
   */
  const getUserProfile = async (): Promise<Record<string, unknown> | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
