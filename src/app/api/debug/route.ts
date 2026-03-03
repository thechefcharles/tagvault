import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Debug route - remove or protect in production.
 * GET /api/debug to diagnose Server Component / Supabase issues.
 */
export async function GET() {
  const checks: Record<string, string | boolean> = {};

  // 1. Env vars (names only)
  checks.NEXT_PUBLIC_SUPABASE_URL = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  checks.NEXT_PUBLIC_SUPABASE_ANON_KEY = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  checks.SUPABASE_SERVICE_ROLE_KEY = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 2. Supabase client + auth
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      checks.supabase_auth = `Error: ${error.message}`;
    } else {
      checks.supabase_auth = user ? `OK (user: ${user.id.slice(0, 8)}...)` : 'OK (no session)';
    }
  } catch (err) {
    checks.supabase_auth = `Throw: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json(checks);
}
