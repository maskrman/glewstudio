import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
