import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/user-count
 *
 * Returns the total number of registered users for social proof display
 * on the landing page.
 *
 * SECURITY FIX (Audit Phase 3.1 — HIGH #1):
 *   Previously used SUPABASE_SERVICE_ROLE_KEY with no authentication check.
 *   Service Role bypasses RLS and should never be used in a public endpoint
 *   without prior authorization.
 *
 *   Fix: Uses the server-side anon/user client and calls the
 *   public.get_public_user_count() SECURITY DEFINER function which is
 *   safe to call from any authenticated or unauthenticated context.
 *   The function returns only an aggregate count — no PII is exposed.
 *
 *   Service Role is NOT used in this endpoint.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Call the public SECURITY DEFINER function — no Service Role needed.
    // This function is safe for unauthenticated callers: it returns only
    // an aggregate count, never individual user data.
    const { data, error } = await supabase
      .rpc('get_public_user_count');

    if (error) {
      // Non-critical: return 0 rather than exposing internal errors
      return NextResponse.json({ count: 0 }, { status: 200 });
    }

    return NextResponse.json({ count: data ?? 0 }, { status: 200 });
  } catch {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
}
