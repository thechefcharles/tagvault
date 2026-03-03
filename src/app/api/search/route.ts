import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { getQueryEmbedding } from '@/lib/embeddings';
import { searchItemsHybrid } from '@/lib/db/search-hybrid';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') ?? '').trim();
    const type = (searchParams.get('type') ?? 'all') as 'link' | 'file' | 'note' | 'all';
    const sort = (searchParams.get('sort') ?? 'best_match') as 'best_match' | 'priority' | 'recent';
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));
    const cursorRaw = searchParams.get('cursor');
    const offset = cursorRaw ? Math.max(0, parseInt(cursorRaw, 10) || 0) : 0;
    const semantic = searchParams.get('semantic') !== 'false';
    let queryEmbedding: number[] | null = null;

    if (semantic && q.trim()) {
      queryEmbedding = await getQueryEmbedding(q);
    }

    const fetchLimit = limit + 1;
    const items = await searchItemsHybrid({
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

    return NextResponse.json({ items: page, nextCursor });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
