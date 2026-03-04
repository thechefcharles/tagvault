import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOrThrow, RateLimitError, getRateLimitKey } from '@/lib/rateLimit';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().min(1).max(200).trim(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, activeOrgId } = await requireActiveOrg();
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing collection id' }, { status: 400 });

    const key = getRateLimitKey('collections:mutate', request, user.id);
    await rateLimitOrThrow({ key, limit: 30, windowSec: 60 });

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('collections')
      .update({ name: parsed.data.name })
      .eq('id', id)
      .eq('org_id', activeOrgId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A collection with this name already exists' }, { status: 409 });
      }
      throw error;
    }
    if (!data) return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    return NextResponse.json(data);
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
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { activeOrgId } = await requireActiveOrg();
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing collection id' }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase.from('collections').delete().eq('id', id).eq('org_id', activeOrgId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
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
