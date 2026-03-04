import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOrThrow, RateLimitError, getRateLimitKey } from '@/lib/rateLimit';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const patchSchema = z.object({
  revoked: z.boolean().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> },
) {
  try {
    const { user, activeOrgId } = await requireActiveOrg();
    const { shareId } = await params;
    if (!shareId) return NextResponse.json({ error: 'Missing share id' }, { status: 400 });

    const key = getRateLimitKey('items:shares:mutate', request, user.id);
    await rateLimitOrThrow({ key, limit: 30, windowSec: 60 });

    const body = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: share } = await supabase
      .from('item_shares')
      .select('id, org_id')
      .eq('id', shareId)
      .eq('org_id', activeOrgId)
      .single();

    if (!share) return NextResponse.json({ error: 'Share not found' }, { status: 404 });

    const updates: { revoked_at?: string | null; expires_at?: string | null } = {};
    if (parsed.data.revoked === true) {
      updates.revoked_at = new Date().toISOString();
    }
    if (parsed.data.expires_at !== undefined) {
      updates.expires_at = parsed.data.expires_at;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('item_shares')
      .update(updates)
      .eq('id', shareId)
      .eq('org_id', activeOrgId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: e.headers });
    }
    if (e instanceof Error && (e.message === 'Unauthenticated' || e.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(e, { tags: { area: 'share_item', handler: 'items_shares_patch' } });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 },
    );
  }
}
