import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { planName, planPrice, benefits, accessLevel, billingDate, billingCycle } = body;

    if (!planName) {
      return NextResponse.json({ error: 'planName is required' }, { status: 400 });
    }

    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';
    const userEmail = user.email!;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        type: 'PLAN_UPGRADE',
        email: userEmail,
        name: userName,
        orderDetails: {
          planName,
          planPrice,
          benefits: benefits ?? [],
          accessLevel: accessLevel ?? 'Acceso completo al plan',
          billingDate: billingDate ?? new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }),
          billingCycle: billingCycle ?? 'Mensual',
          upgradeDate: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }),
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data?.error || 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
