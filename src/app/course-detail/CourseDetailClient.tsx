'use client';

import React, { useState, useEffect, useCallback } from 'react';
import CourseDetailHero from './components/CourseDetailHero';
import CourseDetailBody from './components/CourseDetailBody';

interface Instructor {
  id: string;
  name: string;
  specialty: string;
  tags: string[];
  bio: string | null;
  photo_url: string | null;
  photo_alt: string | null;
  created_at: string;
  updated_at: string;
}

interface CourseData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  instructor: string | Instructor;
  instructor_name: string;
  instructor_specialty: string;
  instructor_photo_url: string | null;
  instructor_photo_alt: string | null;
  thumbnail: string | null;
  thumbnail_alt: string | null;
  duration: string;
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma';
  access_type: 'free' | 'membership' | 'premium_purchase';
  minimum_tier: 'free' | 'apertura' | 'obturador' | 'diafragma' | null;
  price: number | null;
  rating: number;
  review_count: number;
  rating_distribution: Record<number, number>;
  category: { id: string; name: string; slug: string } | null;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    position: number;
    lessons: Array<{
      id: string;
      title: string;
      description: string | null;
      duration_seconds: number;
      position: number;
      video_provider: 'supabase' | 'bunny' | 'vimeo';
      video_asset_id: string | null;
      is_free_preview: boolean;
    }>;
  }>;
  reviews: Array<{
    id: string;
    course_id: string;
    user_id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    updated_at: string;
    user?: { full_name: string; avatar_url: string | null };
  }>;
  lesson_count: number;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CourseDetailClientProps {
  course: CourseData;
}

export default function CourseDetailClient({ course }: CourseDetailClientProps) {
  const [activeTab, setActiveTab] = useState<
    'descripcion' | 'lecciones' | 'instructor' | 'resenas'
  >('lecciones');
  const [scrollToReviews, setScrollToReviews] = useState(false);

  // Handle scroll to reviews when requested
  useEffect(() => {
    if (scrollToReviews) {
      const reviewsTab = document.getElementById('reviews-tab');
      reviewsTab?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollToReviews(false);
    }
  }, [scrollToReviews]);

  // Handle review click from Hero - switch to reviews tab and scroll
  const handleReviewClick = useCallback(() => {
    setActiveTab('resenas');
    // Small delay to ensure tab is rendered before scrolling
    setTimeout(() => {
      setScrollToReviews(true);
    }, 0);
  }, []);

  return (
    <>
      <CourseDetailHero course={course} onScrollToReviews={handleReviewClick} />
      <CourseDetailBody course={course} activeTab={activeTab} setActiveTab={setActiveTab} />
    </>
  );
}
