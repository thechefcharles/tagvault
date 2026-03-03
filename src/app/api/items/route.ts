import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { listItems, createItem } from '@/lib/db/items';
import { createItemSchema } from '@/lib/db/validators';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { apiError } from '@/lib/api/response';
import { assertWithinLimits, incrementUsage, EntitlementError } from '@/lib/entitlements';

export async function GET(request: Request) {
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
    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err);
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const limit = await checkRateLimit(`items:${user.id}`);
    if (!limit.ok) {
      return apiError(
        'RATE_LIMITED',
        'Too many requests. Please try again later.',
        { retryAfter: limit.retryAfter },
        429,
      );
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

    return NextResponse.json(item);
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof EntitlementError) {
      return apiError('PLAN_LIMIT_EXCEEDED', err.message, undefined, 402);
    }
    Sentry.captureException(err);
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
