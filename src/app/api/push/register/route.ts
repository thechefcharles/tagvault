import * as Sentry from '@sentry/nextjs';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireActiveOrg } from '@/lib/server/auth';
import { apiOk, apiError } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { rateLimitOrThrow, RateLimitError } from '@/lib/rateLimit';

const bodySchema = z.object({
  player_id: z.string().min(1, 'player_id required'),
  platform: z.enum(['ios', 'android', 'web']),
});

export async function POST(request: NextRequest) {
  let user: { id: string };
  let activeOrgId: string;
  try {
    const ctx = await requireActiveOrg();
    user = ctx.user;
    activeOrgId = ctx.activeOrgId;
  } catch {
    return apiError('UNAUTHORIZED', 'Unauthorized', undefined, 401);
  }

  const key = `push:register:u:${user.id}`;
  try {
    await rateLimitOrThrow({ key, limit: 30, windowSec: 60 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      const res = apiError('RATE_LIMITED', 'Too many requests', {
        retry_after_seconds: e.retryAfter,
      }, 429);
      e.headers.forEach((v, k) => res.headers.set(k, v));
      return res;
    }
    throw e;
  }

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', parsed.error.message, undefined, 400);
  }

  const { player_id, platform } = parsed.data;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('push_devices')
      .upsert(
        {
          org_id: activeOrgId,
          user_id: user.id,
          provider: 'onesignal',
          player_id,
          platform,
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: 'provider,player_id',
          ignoreDuplicates: false,
        },
      )
      .select('id')
      .single();

    if (error) {
      Sentry.captureException(error, {
        tags: { area: 'push', action: 'register' },
        extra: { orgId: activeOrgId, userId: user.id },
      });
      return apiError('INTERNAL_ERROR', 'Failed to register device', undefined, 500);
    }

    return apiOk({ ok: true });
  } catch (e) {
    Sentry.captureException(e, {
      tags: { area: 'push', action: 'register' },
      extra: { orgId: activeOrgId, userId: user.id },
    });
    return apiError('INTERNAL_ERROR', 'Failed to register device', undefined, 500);
  }
}
