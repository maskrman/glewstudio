import { NextRequest, NextResponse } from 'next/server';
import { getCourseBySlugForPlayer, getCourseByIdForPlayer } from '@/app/actions/courses';
import { createClient } from '@/lib/supabase/server';
import { hasAccess, type SubscriptionTier } from '@/lib/config';

export async function GET(request: NextRequest) {
  // Extract slug early so it's available in catch block
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ message: 'Slug del curso requerido' }, { status: 400 });
  }

  // Check if slug is a UUID (course ID)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  try {
    // ── 1. Authenticate user ────────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    const isAuthenticated = !!user && !authError;

    // ── 2. Fetch course data ────────────────────────────────────────────────────
    let course;
    try {
      if (isUuid) {
        course = await getCourseByIdForPlayer(slug);
      } else {
        course = await getCourseBySlugForPlayer(slug);
      }
    } catch (error) {
      console.error('Error fetching course for player:', error);
      return NextResponse.json({ message: 'Error interno del servidor' }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ message: 'Curso no encontrado' }, { status: 404 });
    }

    // ── 3. Check access ─────────────────────────────────────────────────────────
    // ALL courses require authentication first
    if (!isAuthenticated) {
      return NextResponse.json(
        {
          message: 'Autenticación requerida',
          error: 'UNAUTHENTICATED',
        },
        { status: 401 }
      );
    }

    const accessType = course.access_type as string;
    const minimumTier = (course.minimum_tier ?? null) as SubscriptionTier;

    // User is authenticated, check access based on type
    let hasCourseAccess = false;

    if (accessType === 'free') {
      // Free courses accessible to all authenticated users
      hasCourseAccess = true;
    } else if (accessType === 'premium_purchase') {
      // Check if user purchased this course
      const { data: purchase } = await supabase
        .from('course_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('course_id', course.id)
        .eq('purchase_status', 'paid')
        .maybeSingle();
      hasCourseAccess = !!purchase;
    } else if (accessType === 'membership') {
      // Check subscription tier
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('tier, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (subscription) {
        const userTier = subscription.tier as SubscriptionTier;
        // If minimum_tier is null, any active subscription grants access
        hasCourseAccess = hasAccess(userTier, minimumTier);
      }
    }

    if (!hasCourseAccess) {
      return NextResponse.json(
        {
          message: 'Acceso denegado',
          error: 'FORBIDDEN',
          requiredTier: minimumTier,
          accessType,
        },
        { status: 403 }
      );
    }

    // ── 4. Return full course data (user has access) ───────────────────────────
    const responseData = {
      ...course,
      modules: course.modules ?? [],
      resources: course.resources ?? [],
      reviews: course.reviews ?? [],
      review_count: course.review_count ?? 0,
      rating_distribution: course.rating_distribution ?? { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      rating: course.rating ?? 0,
      description: course.description ?? null,
      created_at: course.created_at ?? new Date().toISOString(),
      updated_at: course.updated_at ?? new Date().toISOString(),
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error in course-player API route:', error);
    return NextResponse.json(
      {
        id: '',
        title: 'Curso no disponible',
        slug: slug,
        description: null,
        instructor: '',
        thumbnail: null,
        thumbnail_alt: null,
        duration: '0min',
        tier: 'apertura',
        access_type: 'free',
        minimum_tier: null,
        price: null,
        rating: 0,
        review_count: 0,
        rating_distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        category: null,
        modules: [],
        resources: [],
        reviews: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
