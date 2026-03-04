import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/app';

  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message);
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
  }

  const target = next || '/app';
  if (target === '/app') {
    return NextResponse.redirect(new URL('/onboarding?next=/app', request.url));
  }
  return NextResponse.redirect(new URL(target, request.url));
}
