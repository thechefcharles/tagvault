import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { requireActiveOrg } from '@/lib/server/auth';
import { apiError } from '@/lib/api/response';
import { assertWithinLimits, incrementUsage, EntitlementError } from '@/lib/entitlements';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  query: z.string().default(''),
  filters: z.record(z.string(), z.unknown()).default({}),
  sort: z.enum(['best_match', 'priority', 'recent']).default('best_match'),
  semantic_enabled: z.boolean().default(true),
  pinned: z.boolean().default(false),
});

export async function GET() {
  try {
    const { activeOrgId } = await requireActiveOrg();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('org_id', activeOrgId)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, activeOrgId } = await requireActiveOrg();
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    try {
      await assertWithinLimits({ userId: user.id, orgId: activeOrgId, action: 'saved_searches_create' });
    } catch (e) {
      if (e instanceof EntitlementError) {
        return apiError('PLAN_LIMIT_EXCEEDED', e.message, undefined, 402);
      }
      throw e;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('saved_searches')
      .insert({
        owner_user_id: null,
        org_id: activeOrgId,
        name: parsed.data.name,
        query: parsed.data.query,
        filters: parsed.data.filters,
        sort: parsed.data.sort,
        semantic_enabled: parsed.data.semantic_enabled,
        pinned: parsed.data.pinned,
      })
      .select()
      .single();

    if (error) throw error;

    await incrementUsage({ userId: user.id, action: 'saved_searches_create' });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err instanceof EntitlementError) {
      return apiError('PLAN_LIMIT_EXCEEDED', err.message, undefined, 402);
    }
    Sentry.captureException(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
