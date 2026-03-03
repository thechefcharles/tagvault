import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Redis } from '@upstash/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  const env = process.env.NODE_ENV ?? 'development';
  const checks: { db: string; redis: string; stripe: string } = {
    db: 'skip',
    redis: 'skip',
    stripe: 'skip',
  };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
    checks.db = error ? 'fail' : 'ok';
  } catch {
    checks.db = 'fail';
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    try {
      const redis = new Redis({ url: redisUrl, token: redisToken });
      await redis.get('health:ping');
      checks.redis = 'ok';
    } catch {
      checks.redis = 'fail';
    }
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  checks.stripe = stripeKey ? 'ok' : 'skip';

  return NextResponse.json({
    status: 'ok',
    env,
    time: new Date().toISOString(),
    checks,
    ms: Date.now() - start,
  });
}
