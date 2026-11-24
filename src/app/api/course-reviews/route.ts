import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, rating, comment } = body;

    if (!courseId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // Check if user already has a review for this course
    const serviceClient = createServiceRoleClient();
    const { data: existing } = await serviceClient
      .from('course_reviews')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Ya tienes una reseña para este curso' }, { status: 400 });
    }

    // Create review
    const { data, error } = await serviceClient
      .from('course_reviews')
      .insert({
        course_id: courseId,
        user_id: user.id,
        rating,
        comment: comment || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating review:', error);
      return NextResponse.json({ error: 'Error al crear reseña' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, rating, comment, reviewId } = body;

    if (!reviewId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const serviceClient = createServiceRoleClient();

    // Verify ownership
    const { data: existing } = await serviceClient
      .from('course_reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Update review
    const { data, error } = await serviceClient
      .from('course_reviews')
      .update({
        rating,
        comment: comment || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) {
      console.error('Error updating review:', error);
      return NextResponse.json({ error: 'Error al actualizar reseña' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get('reviewId');

    if (!reviewId) {
      return NextResponse.json({ error: 'ID de reseña requerido' }, { status: 400 });
    }

    const serviceClient = createServiceRoleClient();

    // Verify ownership
    const { data: existing } = await serviceClient
      .from('course_reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Delete review
    const { error } = await serviceClient.from('course_reviews').delete().eq('id', reviewId);

    if (error) {
      console.error('Error deleting review:', error);
      return NextResponse.json({ error: 'Error al eliminar reseña' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
