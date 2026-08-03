import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/video-player',
  '/watchlist',
  '/account-subscription-management',
  '/receipt',
  '/course-detail',
];

// Routes that require an active subscription
const SUBSCRIPTION_REQUIRED_ROUTES = [
  '/video-player',
  '/watchlist',
];

// Public-only routes (redirect to dashboard if already logged in)
const AUTH_ROUTES = ['/sign-up-login'];

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

function injectTokenFromHeader(request: NextRequest): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  const hasCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token'));
  if (hasCookie) return;
  request.cookies.set(`sb-${getProjectRef()}-auth-token`, token);
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

function isSubscriptionRoute(pathname: string): boolean {
  return SUBSCRIPTION_REQUIRED_ROUTES.some((route) => pathname.startsWith(route));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  injectTokenFromHeader(request);
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Redirect unauthenticated users away from protected routes
  if (isProtectedRoute(pathname) && !user) {
    const redirectUrl = new URL('/sign-up-login', request.url);
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated AND confirmed users away from auth routes
  // Allow unconfirmed users to stay on sign-up-login to complete OTP verification
  if (isAuthRoute(pathname) && user && user.email_confirmed_at) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Check subscription for subscription-required routes
  if (isSubscriptionRoute(pathname) && user) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!subscription) {
      const upgradeUrl = new URL('/account-subscription-management', request.url);
      upgradeUrl.searchParams.set('upgrade', '1');
      return NextResponse.redirect(upgradeUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
