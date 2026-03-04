import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { requireActiveOrg } from '@/lib/server/auth';
import { apiError } from '@/lib/api/response';
import { assertWithinLimits, incrementUsage, EntitlementError } from '@/lib/entitlements';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createSchema = z
  .object({
    source_type: z.enum(['saved_search', 'collection', 'tag_filter']).default('saved_search'),
    source_id: z.string().uuid().nullable().optional(),
    saved_search_id: z.string().uuid().nullable().optional(),
    tag_ids: z.array(z.string().uuid()).optional(),
    name: z.string().min(1).max(200),
    frequency_minutes: z.number().int().min(15).max(10080).default(60),
    enabled: z.boolean().default(true),
    notify_on_new: z.boolean().default(true),
  })
  .refine(
    (d) => {
      if (d.source_type === 'saved_search') return !!(d.source_id ?? d.saved_search_id);
      if (d.source_type === 'collection') return !!d.source_id;
      if (d.source_type === 'tag_filter') return !!d.tag_ids?.length;
      return false;
    },
    { message: 'saved_search needs source_id or saved_search_id; collection needs source_id; tag_filter needs tag_ids' },
  );

export async function GET() {
  try {
    const { activeOrgId } = await requireActiveOrg();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('alerts')
      .select('*, saved_searches(name)')
      .eq('org_id', activeOrgId)
      .order('created_at', { ascending: false });

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

    const supabase = await createClient();
    const { source_type, source_id, saved_search_id, tag_ids } = parsed.data;

    if (source_type === 'saved_search') {
      const searchId = source_id ?? saved_search_id;
      if (!searchId) {
        return NextResponse.json({ error: 'Saved search required' }, { status: 400 });
      }
      const { data: saved } = await supabase
        .from('saved_searches')
        .select('id')
        .eq('id', searchId)
        .eq('org_id', activeOrgId)
        .single();
      if (!saved) {
        return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });
      }
    } else if (source_type === 'collection' && source_id) {
      const { data: col } = await supabase
        .from('collections')
        .select('id')
        .eq('id', source_id)
        .eq('org_id', activeOrgId)
        .single();
      if (!col) {
        return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
      }
    } else if (source_type === 'tag_filter' && tag_ids?.length) {
      const { data: tags } = await supabase
        .from('tags')
        .select('id')
        .eq('org_id', activeOrgId)
        .in('id', tag_ids);
      if (!tags || tags.length !== tag_ids.length) {
        return NextResponse.json({ error: 'One or more tags not found' }, { status: 404 });
      }
    }

    try {
      await assertWithinLimits({ userId: user.id, orgId: activeOrgId, action: 'alerts_create' });
    } catch (e) {
      if (e instanceof EntitlementError) {
        return apiError('PLAN_LIMIT_EXCEEDED', e.message, undefined, 402);
      }
      throw e;
    }

    const searchId = source_type === 'saved_search' ? (source_id ?? saved_search_id) : null;
    const { data: alert, error } = await supabase
      .from('alerts')
      .insert({
        owner_user_id: null,
        org_id: activeOrgId,
        saved_search_id: searchId,
        source_type,
        source_id: source_type === 'saved_search' ? searchId : source_type === 'collection' ? source_id : null,
        tag_ids: source_type === 'tag_filter' ? tag_ids : null,
        name: parsed.data.name,
        frequency_minutes: parsed.data.frequency_minutes,
        enabled: parsed.data.enabled,
        notify_on_new: parsed.data.notify_on_new,
      })
      .select()
      .single();

    if (error) throw error;

    await incrementUsage({ userId: user.id, action: 'alerts_create' });
    return NextResponse.json(alert);
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
