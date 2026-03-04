import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { listItems, createItem } from '@/lib/db/items';
import { createItemSchema } from '@/lib/db/validators';
import { checkRateLimit, getRateLimitKey } from '@/lib/rateLimit';
import { apiError } from '@/lib/api/response';
import { assertWithinLimits, incrementUsage, EntitlementError } from '@/lib/entitlements';
import { logApi } from '@/lib/apiLog';

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'link' | 'file' | 'note' | null;
    const sort = (searchParams.get('sort') as 'recent' | 'priority') ?? 'recent';
    const cursor = searchParams.get('cursor') ?? undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 25;

    const { items, nextCursor } = await listItems({
      userId: user.id,
      type: type ?? undefined,
      sort,
      limit,
      cursor,
    });
    const res = NextResponse.json({ items, nextCursor });
    logApi({
      requestId,
      userId: user.id,
      path: '/api/items',
      method: 'GET',
      status: 200,
      ms: Date.now() - start,
    });
    return res;
  } catch (err) {
    const ms = Date.now() - start;
    if (err instanceof Error && err.message === 'Unauthenticated') {
      logApi({ requestId, path: '/api/items', method: 'GET', status: 401, ms });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err);
    logApi({ requestId, path: '/api/items', method: 'GET', status: 500, ms });
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  try {
    const user = await requireUser();
    const key = getRateLimitKey('items', request, user.id);
    const rl = await checkRateLimit(key, { limit: 30, windowSec: 60 });
    if (!rl.ok) {
      logApi({
        requestId,
        userId: user.id,
        path: '/api/items',
        method: 'POST',
        status: 429,
        ms: Date.now() - start,
        errorCode: 'RATE_LIMITED',
      });
      const res = apiError(
        'RATE_LIMITED',
        'Too many requests. Please try again later.',
        { retry_after_seconds: rl.retryAfter },
        429,
      );
      rl.headers.forEach((v, k) => res.headers.set(k, v));
      return res;
    }
    const body = await request.json();

    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (parsed.data.type === 'file') {
      return NextResponse.json({ error: 'Use /api/items/upload for file items' }, { status: 400 });
    }

    try {
      await assertWithinLimits({ userId: user.id, action: 'items_create' });
      await assertWithinLimits({ userId: user.id, action: 'embeddings_enqueue' });
    } catch (e) {
      if (e instanceof EntitlementError) {
        return apiError('PLAN_LIMIT_EXCEEDED', e.message, undefined, 402);
      }
      throw e;
    }

    const item = await createItem({
      userId: user.id,
      payload: parsed.data,
    });

    await incrementUsage({ userId: user.id, action: 'items_create' });
    await incrementUsage({ userId: user.id, action: 'embeddings_enqueue' });

    logApi({
      requestId,
      userId: user.id,
      path: '/api/items',
      method: 'POST',
      status: 200,
      ms: Date.now() - start,
    });
    return NextResponse.json(item);
  } catch (err) {
    const ms = Date.now() - start;
    if (err instanceof Error && err.message === 'Unauthenticated') {
      logApi({ requestId, path: '/api/items', method: 'POST', status: 401, ms });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof EntitlementError) {
      logApi({
        requestId,
        path: '/api/items',
        method: 'POST',
        status: 402,
        ms,
        errorCode: 'PLAN_LIMIT_EXCEEDED',
      });
      return apiError('PLAN_LIMIT_EXCEEDED', err.message, undefined, 402);
    }
    Sentry.captureException(err);
    logApi({ requestId, path: '/api/items', method: 'POST', status: 500, ms });
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
