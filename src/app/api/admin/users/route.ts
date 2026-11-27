import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';

export async function GET(request: Request) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    // Get all auth users
    const { data: usersResult, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      throw new Error(`Error obteniendo usuarios: ${usersError.message}`);
    }

    const authUsers = usersResult.users ?? [];

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*');

    if (profilesError) {
      throw new Error(`Error obteniendo perfiles: ${profilesError.message}`);
    }

    // Get active subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('subscriptions')
      .select('user_id, tier, status')
      .eq('status', 'active');

    if (subsError) {
      throw new Error(`Error obteniendo suscripciones: ${subsError.message}`);
    }

    // Get course purchases
    const { data: purchases, error: purchasesError } = await supabase
      .from('course_purchases')
      .select('user_id, course_id')
      .eq('purchase_status', 'paid');

    if (purchasesError) {
      throw new Error(`Error obteniendo compras: ${purchasesError.message}`);
    }

    // Build lookup maps
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const subscriptionMap = new Map((subscriptions ?? []).map((s) => [s.user_id, s]));
    const purchaseCountMap = new Map<string, number>();
    (purchases ?? []).forEach((p) => {
      purchaseCountMap.set(p.user_id, (purchaseCountMap.get(p.user_id) || 0) + 1);
    });

    // Enrich users
    const enrichedUsers = authUsers
      .map((user) => {
        const profile = profileMap.get(user.id);
        const subscription = subscriptionMap.get(user.id);
        const activePurchases = purchaseCountMap.get(user.id) || 0;
        const role = user.app_metadata?.role === 'admin' ? 'admin' : 'student';

        return {
          id: user.id,
          email: user.email ?? '',
          full_name: profile?.full_name ?? '',
          avatar_url: profile?.avatar_url ?? null,
          bio: profile?.bio ?? null,
          created_at: profile?.created_at ?? user.created_at,
          updated_at: profile?.updated_at ?? user.updated_at ?? user.created_at,
          role,
          subscription_tier: subscription?.tier ?? null,
          subscription_status: subscription?.status ?? null,
          active_course_purchases: activePurchases,
        };
      })
      .filter((user) => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
          user.email.toLowerCase().includes(searchLower) ||
          user.full_name.toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json(enrichedUsers);
  } catch (error) {
    console.error('[API/admin/users] Error:', error);
    return NextResponse.json({ error: 'Error obteniendo usuarios' }, { status: 500 });
  }
}
