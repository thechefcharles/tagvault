import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRedis } from '@/lib/server/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  const version =
    process.env.SENTRY_RELEASE ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    'dev';

  const checks: {
    db: { ok: boolean; error?: string };
    redis: 'ok' | 'fail' | 'skip';
    sentry: boolean;
  } = {
    db: { ok: true },
    redis: 'skip',
    sentry: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
  };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
    if (error) {
      checks.db = { ok: false, error: error.message };
    }
  } catch (e) {
    checks.db = { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }

  const redis = getRedis();
  if (redis) {
    try {
      await redis.get('health:ping');
      checks.redis = 'ok';
    } catch {
      checks.redis = 'fail';
    }
  }

  const body = {
    ok: checks.db.ok,
    time: new Date().toISOString(),
    version,
    checks: {
      db: checks.db,
      redis: checks.redis,
      sentry: checks.sentry,
    },
    ms: Date.now() - start,
  };

  if (!checks.db.ok) {
    return NextResponse.json(body, { status: 503 });
  }

  return NextResponse.json(body, { status: 200 });
}
