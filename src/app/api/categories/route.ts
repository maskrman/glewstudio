import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/categories
 *
 * Returns the list of published categories with course counts.
 * Used on the landing page and courses page.
 *
 * SECURITY FIX (Audit Phase 3.1 — HIGH #1):
 *   Previously used SUPABASE_SERVICE_ROLE_KEY with no authentication check.
 *   Service Role bypasses RLS and should never be used in a public read-only
 *   endpoint that returns non-sensitive public data.
 *
 *   Fix: Uses the server-side client (anon key) instead of Service Role.
 *   Categories and published courses are public data — they have public
 *   SELECT policies (or should have them). If the anon client cannot read
 *   these tables, the correct fix is to add a public SELECT policy, not
 *   to use Service Role for a public endpoint.
 *
 *   Service Role is NOT used in this endpoint.
 */
export async function GET() {
  try {
    // Use the server client (anon key) — NOT Service Role.
    // Categories and published courses are public data.
    const supabase = await createClient();

    // Fetch categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, slug, cover_image, cover_image_alt, icon, color, sort_order')
      .order('sort_order', { ascending: true });

    if (catError) {
      return NextResponse.json({ categories: [] }, { status: 200 });
    }

    if (!categories || categories.length === 0) {
      return NextResponse.json({ categories: [] }, { status: 200 });
    }

    // Fetch course counts per category
    const { data: courseCounts, error: countError } = await supabase
      .from('courses')
      .select('category_id')
      .eq('is_published', true);

    const countMap: Record<string, number> = {};
    if (!countError && courseCounts) {
      for (const row of courseCounts) {
        if (row.category_id) {
          countMap[row.category_id] = (countMap[row.category_id] || 0) + 1;
        }
      }
    }

    const result = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      coverImage: cat.cover_image,
      coverImageAlt: cat.cover_image_alt,
      icon: cat.icon,
      color: cat.color,
      courseCount: countMap[cat.id] || 0,
    }));

    return NextResponse.json({ categories: result }, { status: 200 });
  } catch {
    return NextResponse.json({ categories: [] }, { status: 200 });
  }
}
