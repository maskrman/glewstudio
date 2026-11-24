'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import TierBadge from '@/components/ui/TierBadge';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserSubscriptionTier,
  hasAccess,
  canAccessCourse as canAccessCourseFn,
  TIER_LABELS,
  TIER_SHORT_LABELS,
  type SubscriptionTier,
} from '@/lib/subscription';
import { parseDuration } from '@/lib/admin-courses';

function getTierValue(
  tier: 'free' | 'apertura' | 'obturador' | 'diafragma' | null
): SubscriptionTier {
  return (tier as SubscriptionTier) || 'apertura';
}

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
}

interface CourseDetailBodyProps {
  course: CourseData;
  activeTab: 'descripcion' | 'lecciones' | 'instructor' | 'resenas';
  setActiveTab: React.Dispatch<
    React.SetStateAction<'descripcion' | 'lecciones' | 'instructor' | 'resenas'>
  >;
}

export default function CourseDetailBody({
  course,
  activeTab,
  setActiveTab,
}: CourseDetailBodyProps) {
  const { user, loading: authLoading } = useAuth();
  const [userTier, setUserTier] = useState<SubscriptionTier>(null);
  const [tierLoading, setTierLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(course.modules.slice(0, 2).map((m) => m.id))
  );
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [userReview, setUserReview] = useState<(typeof course.reviews)[0] | null>(null);
  const [newReviewRating, setNewReviewRating] = useState<number>(5);
  const [newReviewHover, setNewReviewHover] = useState<number>(0);
  const [editReviewRating, setEditReviewRating] = useState<number>(0);
  const [editReviewHover, setEditReviewHover] = useState<number>(0);
  const [submitError, setSubmitError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTierLoading(false);
      return;
    }
    getUserSubscriptionTier().then((tier) => {
      setUserTier(tier);
      setTierLoading(false);
    });
  }, [user, authLoading]);

  // Find user's existing review
  useEffect(() => {
    if (user && course.reviews) {
      const review = course.reviews.find((r) => r.user_id === user.id);
      setUserReview(review || null);
      if (review) {
        setEditReviewRating(review.rating);
      }
    }
  }, [user, course.reviews]);

  // Initialize new review rating from user's existing review if they haven't reviewed
  useEffect(() => {
    if (!userReview) {
      setNewReviewRating(5);
    }
  }, [userReview]);

  const isAuthenticated = !!user;
  const isLoading = authLoading || tierLoading;
  const canAccessCourse = canAccessCourseFn({
    accessType: course.access_type,
    minimumTier: getTierValue(course.minimum_tier),
    userTier,
    isAuthenticated,
    hasPurchased: false,
  });

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDuration = (input: number | string): string => {
    // If input is already a string (e.g., "1m 36s", "2h 30m"), return as-is
    if (typeof input === 'string') {
      // If it's just a number string, parse it
      if (/^\d+$/.test(input.trim())) {
        const seconds = parseInt(input, 10);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
      }
      // Already formatted string like "1m 36s" or "2h 30m"
      return input;
    }
    // Numeric seconds
    const hours = Math.floor(input / 3600);
    const minutes = Math.floor((input % 3600) / 60);
    const secs = input % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const totalSeconds = course.modules.reduce(
    (acc, m) => acc + m.lessons.reduce((sum, l) => sum + l.duration_seconds, 0),
    0
  );
  const totalDuration = parseDuration(totalSeconds);

  const handleSubmitReview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setSubmitError('');

    const rating = userReview ? editReviewRating : newReviewRating;
    const formData = new FormData(e.currentTarget);
    const comment = formData.get('comment') as string;

    try {
      const response = await fetch('/api/course-reviews', {
        method: userReview ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          rating,
          comment: comment || null,
          reviewId: userReview?.id,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMsg = responseData?.error || responseData?.message || 'Error al guardar reseña';
        setSubmitError(errorMsg);
        return;
      }

      // Update local state immediately
      const newReview = responseData;
      if (userReview) {
        // Editing existing review
        const newReviews = course.reviews.map((r) =>
          r.id === userReview.id ? { ...r, rating, comment } : r
        );
        const newDist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        newReviews.forEach((r) => newDist[r.rating]++);
        const newAvg =
          newReviews.length > 0
            ? Math.round(
                (newReviews.reduce((sum, r) => sum + r.rating, 0) / newReviews.length) * 10
              ) / 10
            : 0;
        // Update parent state via callback (we'll use a simpler approach - just reload)
        window.location.reload();
      } else {
        // New review
        const newReviews = [...course.reviews, newReview];
        const newDist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        newReviews.forEach((r) => newDist[r.rating]++);
        const newAvg =
          Math.round((newReviews.reduce((sum, r) => sum + r.rating, 0) / newReviews.length) * 10) /
          10;
        window.location.reload();
      }
    } catch (error) {
      setSubmitError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-10 2xl:px-16 pb-20">
      <div className="flex flex-col lg:flex-row gap-10">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex border-b border-border mb-8 overflow-x-auto scrollbar-hide">
            {(
              [
                { id: 'descripcion', label: 'Descripción' },
                { id: 'lecciones', label: `Lecciones (${totalLessons})` },
                { id: 'instructor', label: 'Instructor' },
                { id: 'resenas', label: `Reseñas (${course.review_count})` },
              ] as const
            ).map((t) => (
              <button
                key={`detail-tab-${t.id}`}
                onClick={() =>
                  setActiveTab(t.id as 'descripcion' | 'lecciones' | 'instructor' | 'resenas')
                }
                className={`shrink-0 px-5 py-3.5 text-sm font-600 border-b-2 transition-colors ${
                  activeTab === t.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* DESCRIPCIÓN */}
          {activeTab === 'descripcion' && (
            <div className="prose prose-invert max-w-none">
              <h3 className="text-lg font-700 text-foreground mb-3">Descripción completa</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line mb-4">
                {course.description ||
                  'Este curso te enseñará técnicas profesionales de fotografía.'}
              </p>
            </div>
          )}

          {/* CURRÍCULO */}
          {activeTab === 'lecciones' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-muted-foreground">
                  {totalLessons} lecciones · {totalDuration} de contenido
                </p>
                <button
                  onClick={() => setExpandedSections(new Set(course.modules.map((s) => s.id)))}
                  className="text-xs text-primary hover:text-accent font-600 transition-colors"
                >
                  Expandir todo
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {course.modules.map((section) => (
                  <div key={section.id} className="border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between px-4 py-3.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          name={
                            expandedSections.has(section.id) ? 'ChevronUpIcon' : 'ChevronDownIcon'
                          }
                          size={16}
                          className="text-muted-foreground shrink-0"
                        />

                        <span className="text-sm font-700 text-foreground">{section.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {section.lessons.length} lecciones
                      </span>
                    </button>

                    {expandedSections.has(section.id) && (
                      <div className="divide-y divide-border">
                        {section.lessons.map((lesson) => {
                          const lessonLocked = !lesson.is_free_preview && !canAccessCourse;
                          return (
                            <div
                              key={lesson.id}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                {lesson.is_free_preview ? (
                                  <Icon name="PlayIcon" size={14} className="text-primary" />
                                ) : lessonLocked ? (
                                  <Icon
                                    name="LockClosedIcon"
                                    size={12}
                                    className="text-muted-foreground"
                                  />
                                ) : (
                                  <Icon name="PlayIcon" size={14} className="text-primary" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm ${lessonLocked ? 'text-muted-foreground' : 'text-foreground'}`}
                                  >
                                    {lesson.title}
                                  </span>
                                  {lesson.is_free_preview && (
                                    <span className="text-xs text-primary border border-primary/30 px-1.5 py-0.5 rounded font-600">
                                      Vista previa
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-muted-foreground font-mono">
                                  {formatDuration(lesson.duration_seconds)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INSTRUCTOR */}
          {activeTab === 'instructor' && (
            <div>
              <div className="flex items-start gap-5 mb-6">
                <div className="relative w-20 h-20 rounded-full overflow-hidden shrink-0">
                  <AppImage
                    src={course.instructor_photo_url || course.thumbnail || ''}
                    alt={course.instructor_photo_alt || course.instructor_name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
                <div>
                  <h3 className="text-xl font-700 text-foreground mb-1">
                    {course.instructor_name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {course.instructor_specialty || 'Fotógrafo Comercial'}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Icon name="StarIcon" size={14} className="text-primary" variant="solid" />
                      <span className="text-foreground font-600">
                        {course.rating.toFixed(1)}
                      </span>{' '}
                      valoración
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon name="UsersIcon" size={14} />
                      {course.review_count} estudiantes
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon name="PlayCircleIcon" size={14} />
                      {totalLessons} lecciones
                    </div>
                  </div>
                </div>
              </div>
              <div className="prose prose-invert max-w-none">
                <h3 className="text-lg font-700 text-foreground mb-3">Biografía</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line mb-4">
                  {course.instructor &&
                  typeof course.instructor === 'object' &&
                  course.instructor.bio
                    ? course.instructor.bio
                    : course.description ||
                      'Experto en fotografía comercial con años de experiencia en la industria.'}
                </p>

                {/* Tags */}
                {course.instructor &&
                  typeof course.instructor === 'object' &&
                  course.instructor.tags &&
                  course.instructor.tags.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-700 text-foreground mb-3">Especialidades</h3>
                      <div className="flex flex-wrap gap-2">
                        {course.instructor.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/30 rounded-full text-primary text-xs font-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* RESEÑAS */}
          {activeTab === 'resenas' && (
            <div>
              {/* Rating summary */}
              <div
                className="flex items-center gap-8 mb-8 p-5 bg-card border border-border rounded-2xl cursor-pointer hover:bg-primary/5 transition-colors"
                onClick={() => {
                  setActiveTab('resenas');
                  setTimeout(() => {
                    const form = document.getElementById('write-review-form');
                    form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 0);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setActiveTab('resenas')}
                aria-label="Escribir reseña"
              >
                <div className="text-center">
                  <div className="text-5xl font-800 gradient-gold-text mb-1">
                    {course.rating.toFixed(1)}
                  </div>
                  <div className="flex justify-center mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Icon
                        key={`sum-star-${i}`}
                        name="StarIcon"
                        size={14}
                        className="text-primary"
                        variant="solid"
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground underline">
                    {course.review_count} reseñas
                  </p>
                </div>
                <div className="flex-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const total = course.review_count || 1;
                    const count = course.rating_distribution?.[star] || 0;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={`rating-bar-${star}`} className="flex items-center gap-2 mb-1.5">
                        <div className="flex items-center gap-0.5 w-12 shrink-0">
                          {Array.from({ length: star }).map((_, i) => (
                            <Icon
                              key={`rbar-star-${star}-${i}`}
                              name="StarIcon"
                              size={10}
                              className="text-primary"
                              variant="solid"
                            />
                          ))}
                        </div>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full progress-bar rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {Math.round(pct)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Write Review Form */}
              {isAuthenticated && !userReview && (
                <div
                  id="write-review-form"
                  className="mb-8 p-5 bg-card border border-border rounded-2xl"
                >
                  <h3 className="text-lg font-700 text-foreground mb-4">Escribe tu reseña</h3>
                  {submitError && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                      {submitError}
                    </div>
                  )}
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div>
                      <label className="text-sm font-600 text-foreground mb-2 block">
                        Tu calificación
                      </label>
                      <div
                        className="flex items-center gap-2"
                        role="radiogroup"
                        aria-label="Selecciona tu calificación"
                        onMouseLeave={() => setNewReviewHover(0)}
                      >
                        {[5, 4, 3, 2, 1].map((star) => (
                          <button
                            key={`rate-${star}`}
                            type="button"
                            onClick={() => setNewReviewRating(star)}
                            onMouseEnter={() => setNewReviewHover(star)}
                            role="radio"
                            aria-checked={star <= (newReviewHover || newReviewRating)}
                            className="w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all hover:scale-105"
                          >
                            <Icon
                              name="StarIcon"
                              size={20}
                              className={`${
                                star <= (newReviewHover || newReviewRating)
                                  ? 'text-primary'
                                  : 'text-muted-foreground'
                              }`}
                              variant="solid"
                            />
                          </button>
                        ))}
                      </div>
                      <input type="hidden" name="rating" value={newReviewRating} />
                    </div>
                    <div>
                      <label
                        htmlFor="review-comment"
                        className="text-sm font-600 text-foreground mb-2 block"
                      >
                        Tu opinión (opcional)
                      </label>
                      <textarea
                        id="review-comment"
                        name="comment"
                        rows={4}
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all resize-none"
                        placeholder="¿Qué te pareció el curso? ¿Qué aprendiste? ¿Lo recomendarías?"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary w-full sm:w-auto py-2.5 px-6 text-sm font-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Publicando...' : 'Publicar Reseña'}
                    </button>
                  </form>
                </div>
              )}

              {/* User's Existing Review */}
              {userReview && (
                <div className="mb-8 p-5 bg-primary/5 border border-primary/20 rounded-2xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
                      <AppImage
                        src={userReview.user?.avatar_url || ''}
                        alt={userReview.user?.full_name || 'Tu avatar'}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                    <div>
                      <span className="text-sm font-600 text-foreground">
                        {userReview.user?.full_name || 'Tú'}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatDate(userReview.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex mb-2">
                    {Array.from({ length: userReview.rating }).map((_, i) => (
                      <Icon
                        key={`urev-star-${i}`}
                        name="StarIcon"
                        size={14}
                        className="text-primary"
                        variant="solid"
                      />
                    ))}
                  </div>
                  {userReview.comment && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      {userReview.comment}
                    </p>
                  )}
                  <button
                    onClick={() => setShowWriteReview(true)}
                    className="text-xs text-primary hover:text-accent font-600"
                  >
                    Editar reseña
                  </button>
                </div>
              )}

              {/* Edit Review Form */}
              {showWriteReview && userReview && (
                <div className="mb-8 p-5 bg-card border border-border rounded-2xl">
                  <h3 className="text-lg font-700 text-foreground mb-4">Editar tu reseña</h3>
                  {submitError && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                      {submitError}
                    </div>
                  )}
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div>
                      <label className="text-sm font-600 text-foreground mb-2 block">
                        Tu calificación
                      </label>
                      <div
                        className="flex items-center gap-2"
                        role="radiogroup"
                        aria-label="Selecciona tu calificación"
                        onMouseLeave={() => setEditReviewHover(0)}
                      >
                        {[5, 4, 3, 2, 1].map((star) => (
                          <button
                            key={`erate-${star}`}
                            type="button"
                            onClick={() => setEditReviewRating(star)}
                            onMouseEnter={() => setEditReviewHover(star)}
                            role="radio"
                            aria-checked={star <= (editReviewHover || editReviewRating)}
                            className="w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all hover:scale-105"
                          >
                            <Icon
                              name="StarIcon"
                              size={20}
                              className={`${
                                star <= (editReviewHover || editReviewRating)
                                  ? 'text-primary'
                                  : 'text-muted-foreground'
                              }`}
                              variant="solid"
                            />
                          </button>
                        ))}
                      </div>
                      <input type="hidden" name="rating" value={editReviewRating} />
                    </div>
                    <div>
                      <label
                        htmlFor="edit-review-comment"
                        className="text-sm font-600 text-foreground mb-2 block"
                      >
                        Tu opinión (opcional)
                      </label>
                      <textarea
                        id="edit-review-comment"
                        name="comment"
                        rows={4}
                        defaultValue={userReview.comment || ''}
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all resize-none"
                        placeholder="¿Qué te pareció el curso? ¿Qué aprendiste? ¿Lo recomendarías?"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-primary py-2.5 px-6 text-sm font-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Actualizando...' : 'Actualizar Reseña'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowWriteReview(false)}
                        disabled={isSubmitting}
                        className="btn-ghost py-2.5 px-6 text-sm font-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Reviews list */}
              <div className="flex flex-col gap-5">
                {course.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="flex gap-4 pb-5 border-b border-border last:border-0"
                  >
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
                      <AppImage
                        src={rev.user?.avatar_url || ''}
                        alt={rev.user?.full_name || 'Reviewer'}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-600 text-foreground">
                          {rev.user?.full_name || 'Usuario anónimo'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(rev.created_at)}
                        </span>
                      </div>
                      <div className="flex mb-2">
                        {Array.from({ length: rev.rating }).map((_, i) => (
                          <Icon
                            key={`rev-star-${rev.id}-${i}`}
                            name="StarIcon"
                            size={12}
                            className="text-primary"
                            variant="solid"
                          />
                        ))}
                      </div>
                      {rev.comment && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {rev.comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {course.reviews.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <Icon
                      name="MessageSquareIcon"
                      size={32}
                      className="mx-auto mb-3 text-muted-foreground/50"
                    />
                    <p className="text-sm">No hay reseñas aún. ¡Sé el primero en escribir una!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sticky sidebar */}
        <aside className="w-full lg:w-80 xl:w-96 shrink-0">
          <div className="lg:sticky lg:top-20">
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
              {/* Thumbnail */}
              <div className="relative aspect-video">
                <AppImage
                  src={course.thumbnail || ''}
                  alt={course.thumbnail_alt || course.title}
                  fill
                  className="object-cover"
                  sizes="400px"
                />

                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  {course.access_type === 'free' ? (
                    <Link href={`/video-player?course=${course.slug}`}>
                      <div className="w-14 h-14 rounded-full bg-green-500/90 flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
                        <Icon name="PlayIcon" size={24} className="text-white ml-1" />
                      </div>
                    </Link>
                  ) : canAccessCourse ? (
                    <Link href={`/video-player?course=${course.slug}`}>
                      <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
                        <Icon name="PlayIcon" size={24} className="text-primary-foreground ml-1" />
                      </div>
                    </Link>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
                      <Icon name="LockClosedIcon" size={22} className="text-white/60" />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5">
                {/* Subscription status - hide for free courses */}
                {!isLoading && course.access_type !== 'free' && (
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-xs ${
                      canAccessCourse
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon name={canAccessCourse ? 'CheckCircleIcon' : 'LockClosedIcon'} size={13} />
                    <span>
                      {isAuthenticated
                        ? userTier
                          ? canAccessCourse
                            ? `Acceso incluido en ${TIER_LABELS[userTier]}`
                            : `Tu plan (${TIER_LABELS[userTier]}) no incluye este curso`
                          : 'Sin suscripción activa'
                        : 'Inicia sesión para acceder'}
                    </span>
                  </div>
                )}

                {/* Access type badge */}
                <div className="mb-4">
                  {course.access_type === 'free' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-xs font-600 w-full text-center">
                      <Icon name="GiftIcon" size={12} />
                      Gratis
                    </span>
                  ) : course.access_type === 'membership' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-xs font-600 w-full text-center">
                      <Icon name="ShieldIcon" size={12} />
                      Membresía{' '}
                      {course.minimum_tier ? TIER_SHORT_LABELS[course.minimum_tier] : 'Apertura'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-600 w-full text-center">
                      <Icon name="GemIcon" size={12} />
                      Compra Premium
                    </span>
                  )}
                </div>

                {/* Price */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-2xl font-800 text-foreground">
                      {course.access_type === 'free'
                        ? 'Gratis'
                        : course.price
                          ? `$${course.price}`
                          : 'Incluido en'}
                    </div>
                    <TierBadge tier={course.tier} size="md" showIcon />
                  </div>
                  {course.price && (
                    <div className="text-right">
                      <div className="text-lg font-700 text-primary">${course.price}</div>
                      <div className="text-xs text-muted-foreground">USD</div>
                    </div>
                  )}
                </div>

                {/* CTA based on access */}
                {isLoading ? (
                  <div className="w-full py-3 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : course.access_type === 'free' ? (
                  <Link
                    href={`/video-player?course=${course.slug}`}
                    className="btn-primary w-full py-3 text-sm font-700 text-center block mb-3"
                    style={{ backgroundColor: 'rgb(34 197 94)', borderColor: 'rgb(34 197 94)' }}
                  >
                    Comenzar Curso
                  </Link>
                ) : canAccessCourse ? (
                  <Link
                    href={`/video-player?course=${course.slug}`}
                    className="btn-primary w-full py-3 text-sm font-700 text-center block mb-3"
                  >
                    Continuar Curso
                  </Link>
                ) : isAuthenticated ? (
                  <Link
                    href="/account-subscription-management"
                    className="btn-primary w-full py-3 text-sm font-700 text-center block mb-3"
                  >
                    Actualizar Plan
                  </Link>
                ) : (
                  <Link
                    href="/sign-up-login"
                    className="btn-primary w-full py-3 text-sm font-700 text-center block mb-3"
                  >
                    Acceder al Curso
                  </Link>
                )}

                <Link
                  href={`/video-player?course=${course.slug}`}
                  className="btn-ghost w-full py-2.5 text-sm font-600 text-center block mb-5"
                >
                  Vista Previa Gratis
                </Link>

                {/* Course stats */}
                <div className="flex flex-col gap-2.5 text-sm">
                  {[
                    { icon: 'ClockIcon', label: `${totalDuration} de contenido en video` },
                    { icon: 'QueueListIcon', label: `${totalLessons} lecciones` },
                    { icon: 'DocumentArrowDownIcon', label: 'Archivos de práctica incluidos' },
                    { icon: 'DevicePhoneMobileIcon', label: 'Acceso en móvil y tablet' },
                    { icon: 'TrophyIcon', label: 'Certificado al completar' },
                  ].map((item, i) => (
                    <div
                      key={`course-stat-${i}`}
                      className="flex items-center gap-2.5 text-muted-foreground"
                    >
                      <Icon name={item.icon as any} size={15} className="text-primary shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
