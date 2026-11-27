/**
 * Supabase Database Types — GLEW Studio
 *
 * Single source of truth for all database row types.
 * Keep in sync with supabase/migrations/*.sql
 *
 * NOTE: SubscriptionTier and SubscriptionStatus are re-exported from
 * @/lib/config so that all application code imports from one place.
 * Do NOT redefine them here — import from @/lib/config instead.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ─── Enum aliases (canonical definitions live in @/lib/config) ────────────────
export type SubscriptionTier = 'apertura' | 'obturador' | 'diafragma';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trial';
export type CourseStatus = 'draft' | 'public' | 'presale';
export type LessonVideoProvider = 'supabase' | 'bunny';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier: SubscriptionTier;
          status: SubscriptionStatus;
          started_at: string;
          expires_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier?: SubscriptionTier;
          status?: SubscriptionStatus;
          started_at?: string;
          expires_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          tier?: SubscriptionTier;
          status?: SubscriptionStatus;
          expires_at?: string | null;
          updated_at?: string | null;
        };
      };
      watchlist: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          course_title: string;
          course_instructor: string;
          course_thumbnail: string;
          course_thumbnail_alt: string;
          course_duration: string;
          course_tier: string;
          course_rating: number | null;
          course_lesson_count: number | null;
          added_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          course_title: string;
          course_instructor: string;
          course_thumbnail: string;
          course_thumbnail_alt?: string;
          course_duration: string;
          course_tier?: string;
          course_rating?: number | null;
          course_lesson_count?: number | null;
          added_at?: string | null;
        };
        Update: {
          course_title?: string;
          course_instructor?: string;
          course_thumbnail?: string;
          course_thumbnail_alt?: string;
          course_duration?: string;
          course_tier?: string;
          course_rating?: number | null;
          course_lesson_count?: number | null;
        };
      };
      course_progress: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          course_title: string;
          course_instructor: string;
          course_thumbnail: string;
          course_thumbnail_alt: string;
          watched_seconds: number;
          total_seconds: number;
          completed: boolean;
          started_at: string;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          course_title: string;
          course_instructor?: string;
          course_thumbnail?: string;
          course_thumbnail_alt?: string;
          watched_seconds?: number;
          total_seconds?: number;
          completed?: boolean;
          started_at?: string;
          completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          course_title?: string;
          course_instructor?: string;
          course_thumbnail?: string;
          course_thumbnail_alt?: string;
          watched_seconds?: number;
          total_seconds?: number;
          completed?: boolean;
          completed_at?: string | null;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          cover_image: string | null;
          cover_image_alt: string | null;
          icon: string | null;
          color: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          cover_image?: string | null;
          cover_image_alt?: string | null;
          icon?: string | null;
          color?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          cover_image?: string | null;
          cover_image_alt?: string | null;
          icon?: string | null;
          color?: string | null;
          sort_order?: number;
        };
      };
      courses: {
        Row: {
          id: string;
          title: string;
          slug: string;
          instructor: string;
          thumbnail: string;
          thumbnail_alt: string;
          duration: string;
          tier?: SubscriptionTier | 'free';
          access_type: 'free' | 'membership' | 'premium_purchase';
          minimum_tier: SubscriptionTier | null;
          price: number | null;
          lesson_count: number;
          rating: number | null;
          category_id: string | null;
          is_published: boolean;
          status: CourseStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          instructor: string;
          thumbnail?: string;
          thumbnail_alt?: string;
          duration?: string;
          tier?: SubscriptionTier | 'free';
          access_type?: 'free' | 'membership' | 'premium_purchase';
          minimum_tier?: SubscriptionTier | null;
          price?: number | null;
          lesson_count?: number;
          rating?: number | null;
          category_id?: string | null;
          is_published?: boolean;
          status?: CourseStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          slug?: string;
          instructor?: string;
          thumbnail?: string;
          thumbnail_alt?: string;
          duration?: string;
          tier?: SubscriptionTier | 'free';
          access_type?: 'free' | 'membership' | 'premium_purchase';
          minimum_tier?: SubscriptionTier | null;
          price?: number | null;
          lesson_count?: number;
          rating?: number | null;
          category_id?: string | null;
          is_published?: boolean;
          status?: CourseStatus;
          updated_at?: string;
        };
      };
      course_modules: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          description: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          description?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          position?: number;
          updated_at?: string;
        };
      };
      lessons: {
        Row: {
          id: string;
          module_id: string;
          title: string;
          description: string | null;
          duration_seconds: number;
          position: number;
          video_provider: LessonVideoProvider;
          video_asset_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          title: string;
          description?: string | null;
          duration_seconds?: number;
          position?: number;
          video_provider?: LessonVideoProvider;
          video_asset_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          duration_seconds?: number;
          position?: number;
          video_provider?: LessonVideoProvider;
          video_asset_id?: string | null;
          updated_at?: string;
        };
      };
      otp_codes: {
        Row: {
          id: string;
          email: string;
          code: string;
          type: 'signup' | 'recovery';
          expires_at: string;
          used: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          code: string;
          type?: 'signup' | 'recovery';
          expires_at: string;
          used?: boolean;
          created_at?: string;
        };
        Update: {
          used?: boolean;
        };
      };
      course_purchases: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          price_paid: number | null;
          amount: number | null;
          currency: string | null;
          provider: string | null;
          provider_payment_id: string | null;
          purchase_status: 'paid' | 'pending' | 'refunded' | 'failed';
          discount_applied: number | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          price_paid?: number | null;
          amount?: number | null;
          currency?: string | null;
          provider?: string | null;
          provider_payment_id?: string | null;
          purchase_status?: 'paid' | 'pending' | 'refunded' | 'failed';
          discount_applied?: number | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          purchase_status?: 'paid' | 'pending' | 'refunded' | 'failed';
          updated_at?: string | null;
        };
      };
      lesson_resources: {
        Row: {
          id: string;
          course_id: string;
          lesson_id: string;
          file_name: string;
          display_name: string;
          file_type: string;
          file_size: string | null;
          storage_path: string;
          required_tier: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          lesson_id: string;
          file_name: string;
          display_name: string;
          file_type: string;
          file_size?: string | null;
          storage_path: string;
          required_tier?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          display_name?: string;
          file_type?: string;
          file_size?: string | null;
          storage_path?: string;
          required_tier?: string;
          sort_order?: number;
        };
      };
      course_reviews: {
        Row: {
          id: string;
          course_id: string;
          user_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          user_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          rating?: number;
          comment?: string | null;
          updated_at?: string;
        };
      };
      downloads: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          course_title: string;
          file_type: string;
          file_size: string;
          downloaded_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          course_title: string;
          file_type: string;
          file_size?: string;
          downloaded_at?: string;
        };
        Update: Record<string, never>;
      };
      /**
       * Idempotency log for payment webhook events.
       * Written exclusively by the server-side webhook handler (service-role).
       * Prevents duplicate subscription activations from replayed webhooks.
       * Migration: 20260818210000_webhook_idempotency.sql
       */
      processed_webhook_events: {
        Row: {
          id: string;
          provider_event_id: string;
          event_type: string;
          user_id: string | null;
          processed_at: string;
          metadata: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          provider_event_id: string;
          event_type: string;
          user_id?: string | null;
          processed_at?: string;
          metadata?: Record<string, unknown> | null;
        };
        Update: {
          metadata?: Record<string, unknown> | null;
        };
      };
      instructors: {
        Row: {
          id: string;
          name: string;
          specialty: string | null;
          tags: string[] | null;
          bio: string | null;
          photo_url: string | null;
          photo_alt: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          specialty?: string | null;
          tags?: string[] | null;
          bio?: string | null;
          photo_url?: string | null;
          photo_alt?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          specialty?: string | null;
          tags?: string[] | null;
          bio?: string | null;
          photo_url?: string | null;
          photo_alt?: string | null;
          updated_at?: string;
        };
      };
      membership_plans: {
        Row: {
          id: string;
          slug: string;
          name: string;
          badge: string | null;
          monthly_price: number;
          annual_monthly_price: number;
          premium_discount_percent: number;
          features: Json;
          is_popular: boolean;
          stripe_monthly_price_id: string | null;
          stripe_annual_price_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          badge?: string | null;
          monthly_price?: number;
          annual_monthly_price?: number;
          premium_discount_percent?: number;
          features?: Json;
          is_popular?: boolean;
          stripe_monthly_price_id?: string | null;
          stripe_annual_price_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          name?: string;
          badge?: string | null;
          monthly_price?: number;
          annual_monthly_price?: number;
          premium_discount_percent?: number;
          features?: Json;
          is_popular?: boolean;
          stripe_monthly_price_id?: string | null;
          stripe_annual_price_id?: string | null;
          updated_at?: string;
        };
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          discount_percent: number;
          max_uses: number;
          current_uses: number;
          expires_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          discount_percent: number;
          max_uses?: number;
          current_uses?: number;
          expires_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          discount_percent?: number;
          max_uses?: number;
          current_uses?: number;
          expires_at?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      subscription_tier: SubscriptionTier;
      subscription_status: SubscriptionStatus;
      course_status: CourseStatus;
      lesson_video_provider: LessonVideoProvider;
    };
  };
}
