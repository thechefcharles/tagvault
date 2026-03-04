import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Root redirect in middleware (avoids root page Server Component execution)
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  // Auth callback: Supabase redirects with ?code= after email confirmation.
  // Redirect to our callback route to exchange the code for a session.
  const code = searchParams.get('code');
  if (code) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    callbackUrl.searchParams.set('code', code);
    callbackUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(callbackUrl);
  }

  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const isProtected =
    pathname.startsWith('/app') ||
    pathname === '/search' ||
    pathname.startsWith('/saved-searches') ||
    pathname.startsWith('/alerts') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/orgs') ||
    pathname.startsWith('/admin');

  if (!supabaseUrl || !supabaseAnonKey) {
    // Env may be missing in Edge; redirect protected routes to login to avoid "Unauthenticated" throw
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return response;
  }

  let user = null;
  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    // getUser validates with Supabase; timeout prevents hang if Supabase is unreachable
    const { data } = await Promise.race([
      supabase.auth.getUser(),
      new Promise<{ data: { user: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { user: null } }), 1500),
      ),
    ]);
    user = data.user;
  } catch {
    // Supabase auth failed (e.g. network); treat as unauthenticated
  }

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if ((pathname === '/login' || pathname === '/signup') && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/app';
    return NextResponse.redirect(url);
  }

  return response;
}
