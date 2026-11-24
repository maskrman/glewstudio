import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  // Validación estricta del parámetro 'next' para evitar redirect abierto.
  // Solo se permiten rutas relativas internas que comiencen con "/" y no con "//".
  // Cualquier otro valor (URL externa, protocolo, ruta absoluta) se rechaza y se usa "/dashboard" por defecto.
  const isSafeNext =
    typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.includes('://');
  const safeNext = isSafeNext ? next : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-up-login`);
}
