import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOrThrow, RateLimitError, getRateLimitKey } from '@/lib/rateLimit';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api/response';
import { assertWithinLimits, EntitlementError } from '@/lib/entitlements';
import { z } from 'zod';

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const postSchema = z.object({
  expires_at: z.string().datetime().nullable().optional(),
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

    const { data: item } = await supabase
      .from('items')
      .select('id')
      .eq('id', itemId)
      .eq('org_id', activeOrgId)
      .single();

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const { data: shares, error } = await supabase
      .from('item_shares')
      .select('id, token, created_by, created_at, revoked_at, expires_at, last_accessed_at')
      .eq('org_id', activeOrgId)
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(shares ?? []);
  } catch (err) {
    if (err instanceof Error && (err.message === 'Unauthenticated' || err.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(err, { tags: { area: 'share_item', handler: 'items_shares_list' } });
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

    const key = getRateLimitKey('items:shares', request, user.id);
    await rateLimitOrThrow({ key, limit: 20, windowSec: 60 });

    await assertWithinLimits({ userId: user.id, orgId: activeOrgId, action: 'item_shares_create' });

    const body = await request.json().catch(() => ({}));
    const parsed = postSchema.safeParse(body);
    const expiresAt = parsed.success && parsed.data.expires_at ? parsed.data.expires_at : null;

    const supabase = await createClient();

    const { data: item } = await supabase
      .from('items')
      .select('id')
      .eq('id', itemId)
      .eq('org_id', activeOrgId)
      .single();

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const token = generateToken();

    const { data: share, error } = await supabase
      .from('item_shares')
      .insert({
        org_id: activeOrgId,
        item_id: itemId,
        token,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(share);
  } catch (e) {
    if (e instanceof EntitlementError) {
      return apiError('PLAN_LIMIT_EXCEEDED', e.message, undefined, 402);
    }
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: e.headers });
    }
    if (e instanceof Error && (e.message === 'Unauthenticated' || e.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(e, { tags: { area: 'share_item', handler: 'items_shares_create' } });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 },
    );
  }
}
