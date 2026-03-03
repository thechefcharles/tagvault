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

  const response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
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
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase auth failed (e.g. network); treat as unauthenticated
  }

  if (
    (pathname.startsWith('/app') ||
      pathname === '/search' ||
      pathname.startsWith('/saved-searches') ||
      pathname.startsWith('/alerts') ||
      pathname.startsWith('/notifications')) &&
    !user
  ) {
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
