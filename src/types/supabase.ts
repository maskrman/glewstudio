// Supabase Database Types
// Generated types for glewstudio-main

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SubscriptionTier = 'apertura' | 'obturador' | 'diafragma'
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trial'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          avatar_url?: string | null
          bio?: string | null
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          tier: SubscriptionTier
          status: SubscriptionStatus
          started_at: string
          expires_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          tier?: SubscriptionTier
          status?: SubscriptionStatus
          started_at?: string
          expires_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          tier?: SubscriptionTier
          status?: SubscriptionStatus
          expires_at?: string | null
          updated_at?: string | null
        }
      }
      watchlist: {
        Row: {
          id: string
          user_id: string
          course_id: string
          course_title: string
          course_instructor: string
          course_thumbnail: string
          course_thumbnail_alt: string
          course_duration: string
          course_tier: string
          course_rating: number | null
          course_lesson_count: number | null
          added_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          course_title: string
          course_instructor: string
          course_thumbnail: string
          course_thumbnail_alt?: string
          course_duration: string
          course_tier?: string
          course_rating?: number | null
          course_lesson_count?: number | null
          added_at?: string | null
        }
        Update: {
          course_title?: string
          course_instructor?: string
          course_thumbnail?: string
          course_thumbnail_alt?: string
          course_duration?: string
          course_tier?: string
          course_rating?: number | null
          course_lesson_count?: number | null
        }
      }
      course_progress: {
        Row: {
          id: string
          user_id: string
          course_id: string
          course_title: string
          course_instructor: string
          course_thumbnail: string
          course_thumbnail_alt: string
          watched_seconds: number
          total_seconds: number
          completed: boolean
          started_at: string
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          course_title: string
          course_instructor?: string
          course_thumbnail?: string
          course_thumbnail_alt?: string
          watched_seconds?: number
          total_seconds?: number
          completed?: boolean
          started_at?: string
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          course_title?: string
          course_instructor?: string
          course_thumbnail?: string
          course_thumbnail_alt?: string
          watched_seconds?: number
          total_seconds?: number
          completed?: boolean
          completed_at?: string | null
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      subscription_tier: SubscriptionTier
      subscription_status: SubscriptionStatus
    }
  }
}
