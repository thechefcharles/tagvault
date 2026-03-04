import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOrThrow, RateLimitError, getRateLimitKey } from '@/lib/rateLimit';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bodySchema = z.object({
  tag_ids: z.array(z.string().uuid()),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { activeOrgId } = await requireActiveOrg();
    const { id: itemId } = await params;
    if (!itemId) return NextResponse.json({ error: 'Missing item id' }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('item_tags')
      .select('tag_id, tags(id, name, slug)')
      .eq('item_id', itemId)
      .eq('org_id', activeOrgId);

    if (error) throw error;

    const tags = ((data ?? []) as { tags?: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null }[])
      .map((row) => {
        const t = Array.isArray(row.tags) ? row.tags[0] : row.tags;
        return t ? { id: t.id, name: t.name, slug: t.slug } : null;
      })
      .filter((x): x is { id: string; name: string; slug: string } => !!x);

    return NextResponse.json({ tags });
  } catch (err) {
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { area: 'tags' } });
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
    const { id: itemId } = await params;
    if (!itemId) return NextResponse.json({ error: 'Missing item id' }, { status: 400 });

    const key = getRateLimitKey('items:tags', request, user.id);
    await rateLimitOrThrow({ key, limit: 60, windowSec: 60 });

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
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
      .eq('id', itemId)
      .eq('org_id', activeOrgId)
      .single();

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    await supabase.from('item_tags').delete().eq('item_id', itemId).eq('org_id', activeOrgId);

    if (parsed.data.tag_ids.length > 0) {
      const rows = parsed.data.tag_ids.map((tagId) => ({
        org_id: activeOrgId,
        item_id: itemId,
        tag_id: tagId,
      }));
      const { error } = await supabase.from('item_tags').insert(rows);
      if (error) {

        if (error.code === '23503') {
          return NextResponse.json({ error: 'One or more tags not found' }, { status: 400 });
        }
        throw error;
      }
    }

    const { data: tagsData } = await supabase
      .from('item_tags')
      .select('tag_id, tags(id, name, slug)')
      .eq('item_id', itemId)
      .eq('org_id', activeOrgId);

    const tags = ((tagsData ?? []) as { tags?: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null }[])
      .map((row) => {
        const t = Array.isArray(row.tags) ? row.tags[0] : row.tags;
        return t ? { id: t.id, name: t.name, slug: t.slug } : null;
      })
      .filter((x): x is { id: string; name: string; slug: string } => !!x);

    return NextResponse.json({ tags });
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
    Sentry.captureException(err, { tags: { area: 'tags' } });
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
    const { id: itemId } = await params;
    if (!itemId) return NextResponse.json({ error: 'Missing item id' }, { status: 400 });

    const key = getRateLimitKey('items:tags', request, user.id);
    await rateLimitOrThrow({ key, limit: 60, windowSec: 60 });

    const body = await request.json().catch(() => ({}));
    const tagId = typeof body?.tag_id === 'string' ? body.tag_id : null;
    if (!tagId) {
      return NextResponse.json({ error: 'tag_id required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('item_tags')
      .delete()
      .eq('item_id', itemId)
      .eq('tag_id', tagId)
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
    Sentry.captureException(err, { tags: { area: 'tags' } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
