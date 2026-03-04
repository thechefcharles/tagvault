import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { requireActiveOrg } from '@/lib/server/auth';
import { apiError } from '@/lib/api/response';
import { assertWithinLimits, incrementUsage, EntitlementError } from '@/lib/entitlements';
import { getQueryEmbedding } from '@/lib/embeddings';
import { searchItemsHybrid } from '@/lib/db/search-hybrid';
import { rateLimitOrThrow, RateLimitError, getRateLimitKey } from '@/lib/rateLimit';
import { logApi } from '@/lib/apiLog';

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const start = Date.now();
  let userId: string | undefined;
  try {
    const { user, activeOrgId } = await requireActiveOrg();
    userId = user.id;
    const key = getRateLimitKey('search', request, user.id);
    const rlResult = await rateLimitOrThrow({ key, limit: 60, windowSec: 60 });
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') ?? '').trim();
    const type = (searchParams.get('type') ?? 'all') as 'link' | 'file' | 'note' | 'all';
    const sort = (searchParams.get('sort') ?? 'best_match') as 'best_match' | 'priority' | 'recent';
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));
    const cursorRaw = searchParams.get('cursor');
    const offset = cursorRaw ? Math.max(0, parseInt(cursorRaw, 10) || 0) : 0;
    const semantic = searchParams.get('semantic') !== 'false';
    let queryEmbedding: number[] | null = null;

    if (q.trim()) {
      try {
        await assertWithinLimits({ userId: user.id, orgId: activeOrgId, action: 'searches_run' });
      } catch (e) {
        if (e instanceof EntitlementError) {
          return apiError('PLAN_LIMIT_EXCEEDED', e.message, undefined, 402);
        }
        throw e;
      }
    }

    if (semantic && q.trim()) {
      queryEmbedding = await getQueryEmbedding(q);
    }

    const fetchLimit = limit + 1;
    const items = await searchItemsHybrid({
      orgId: activeOrgId,
      userId: user.id,
      q,
      type,
      sort,
      limit: fetchLimit,
      offset,
      useSemantic: semantic,
      queryEmbedding,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? String(offset + limit) : null;

    if (q.trim()) {
      await incrementUsage({ userId: user.id, action: 'searches_run' });
    }

    const res = NextResponse.json({ items: page, nextCursor });
    if (rlResult?.headers) rlResult.headers.forEach((v, k) => res.headers.set(k, v));
    logApi({
      requestId,
      userId: user.id,
      path: '/api/search',
      method: 'GET',
      status: 200,
      ms: Date.now() - start,
    });
    return res;
  } catch (err) {
    const ms = Date.now() - start;
    if (err instanceof Error && err.message === 'Unauthenticated') {
      logApi({ requestId, path: '/api/search', method: 'GET', status: 401, ms });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof RateLimitError) {
      logApi({
        requestId,
        path: '/api/search',
        method: 'GET',
        status: 429,
        ms,
        errorCode: 'RATE_LIMITED',
      });
      const res = apiError('RATE_LIMITED', 'Too many requests', {
        retry_after_seconds: err.retryAfter,
      }, 429);
      err.headers.forEach((v, k) => res.headers.set(k, v));
      return res;
    }
    if (err instanceof EntitlementError) {
      logApi({
        requestId,
        path: '/api/search',
        method: 'GET',
        status: 402,
        ms,
        errorCode: 'PLAN_LIMIT_EXCEEDED',
      });
      return apiError('PLAN_LIMIT_EXCEEDED', err.message, undefined, 402);
    }
    Sentry.captureException(err, {
      tags: { area: 'search' },
      extra: userId ? { user_id: userId } : undefined,
    });
    logApi({ requestId, path: '/api/search', method: 'GET', status: 500, ms });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
