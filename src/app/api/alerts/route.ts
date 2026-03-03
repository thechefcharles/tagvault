import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { apiError } from '@/lib/api/response';
import { assertWithinLimits, incrementUsage, EntitlementError } from '@/lib/entitlements';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createSchema = z.object({
  saved_search_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  frequency_minutes: z.number().int().min(15).max(10080).default(60),
  enabled: z.boolean().default(true),
  notify_on_new: z.boolean().default(true),
});

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('alerts')
      .select('*, saved_searches(name)')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
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

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: saved } = await supabase
      .from('saved_searches')
      .select('id')
      .eq('id', parsed.data.saved_search_id)
      .eq('owner_user_id', user.id)
      .single();

    if (!saved) {
      return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });
    }

    try {
      await assertWithinLimits({ userId: user.id, action: 'alerts_create' });
    } catch (e) {
      if (e instanceof EntitlementError) {
        return apiError('PLAN_LIMIT_EXCEEDED', e.message, undefined, 402);
      }
      throw e;
    }

    const { data: alert, error } = await supabase
      .from('alerts')
      .insert({
        owner_user_id: user.id,
        org_id: null,
        saved_search_id: parsed.data.saved_search_id,
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
    if (err instanceof Error && err.message === 'Unauthenticated') {
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
