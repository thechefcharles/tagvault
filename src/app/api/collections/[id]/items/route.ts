import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOrThrow, RateLimitError, getRateLimitKey } from '@/lib/rateLimit';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const postSchema = z.object({
  item_id: z.string().uuid(),
});
const deleteSchema = z.object({
  item_id: z.string().uuid(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { activeOrgId } = await requireActiveOrg();
    const { id: collectionId } = await params;
    if (!collectionId) return NextResponse.json({ error: 'Missing collection id' }, { status: 400 });

    const supabase = await createClient();
    const { data: coll } = await supabase
      .from('collections')
      .select('id, name')
      .eq('id', collectionId)
      .eq('org_id', activeOrgId)
      .single();

    if (!coll) return NextResponse.json({ error: 'Collection not found' }, { status: 404 });

    const { data: rows, error } = await supabase
      .from('collection_items')
      .select('item_id, items(*)')
      .eq('collection_id', collectionId)
      .eq('org_id', activeOrgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const items = (rows ?? []).map((r: { item_id: string; items: unknown }) =>
      (r as { items: Record<string, unknown> | null }).items,
    ).filter(Boolean) as Record<string, unknown>[];
    return NextResponse.json({ collection: coll, items });
  } catch (err) {
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { area: 'collections' } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, activeOrgId } = await requireActiveOrg();
    const { id: collectionId } = await params;
    if (!collectionId) return NextResponse.json({ error: 'Missing collection id' }, { status: 400 });

    const key = getRateLimitKey('collections:items', request, user.id);
    await rateLimitOrThrow({ key, limit: 60, windowSec: 60 });

    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data: item } = await supabase
      .from('items')
      .select('id')
      .eq('id', parsed.data.item_id)
      .eq('org_id', activeOrgId)
      .single();

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const { error } = await supabase.from('collection_items').insert({
      org_id: activeOrgId,
      collection_id: collectionId,
      item_id: parsed.data.item_id,
    });

    if (error) {
      if (error.code === '23505') return NextResponse.json({ ok: true });
      if (error.code === '23503') return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests', retry_after: err.retryAfter },
        { status: 429, headers: err.headers },
      );
    }
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { area: 'collections' } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, activeOrgId } = await requireActiveOrg();
    const { id: collectionId } = await params;
    if (!collectionId) return NextResponse.json({ error: 'Missing collection id' }, { status: 400 });

    const key = getRateLimitKey('collections:items', request, user.id);
    await rateLimitOrThrow({ key, limit: 60, windowSec: 60 });

    const body = await request.json().catch(() => ({}));
    const parsed = deleteSchema.safeParse({ item_id: body?.item_id });
    if (!parsed.success) {
      return NextResponse.json({ error: 'item_id required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .eq('item_id', parsed.data.item_id)
      .eq('org_id', activeOrgId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests', retry_after: err.retryAfter },
        { status: 429, headers: err.headers },
      );
    }
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { area: 'collections' } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
