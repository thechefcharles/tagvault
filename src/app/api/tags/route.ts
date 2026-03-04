import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOrThrow, RateLimitError, getRateLimitKey } from '@/lib/rateLimit';
import { requireActiveOrg } from '@/lib/server/auth';
import { assertWithinLimits, EntitlementError } from '@/lib/entitlements';
import { tagSlug } from '@/lib/tags';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api/response';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export async function GET() {
  try {
    const { activeOrgId } = await requireActiveOrg();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('tags')
      .select('id, name, slug, created_at')
      .eq('org_id', activeOrgId)
      .order('name');

    if (error) throw error;
    return NextResponse.json(data ?? []);
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

export async function POST(request: NextRequest) {
  try {
    const { user, activeOrgId } = await requireActiveOrg();
    const key = getRateLimitKey('tags:create', request, user.id);
    await rateLimitOrThrow({ key, limit: 30, windowSec: 60 });

    await assertWithinLimits({ userId: user.id, orgId: activeOrgId, action: 'tags_create' });

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const slug = tagSlug(parsed.data.name);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('tags')
      .insert({ org_id: activeOrgId, name: parsed.data.name.trim(), slug })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
      }
      throw error;
    }
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
    if (err instanceof EntitlementError) {
      return apiError('PLAN_LIMIT_EXCEEDED', err.message, { upgrade: true }, 402);
    }
    Sentry.captureException(err, { tags: { area: 'tags' } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
