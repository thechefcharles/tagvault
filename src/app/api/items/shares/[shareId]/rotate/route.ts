import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitOrThrow, RateLimitError, getRateLimitKey } from '@/lib/rateLimit';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> },
) {
  try {
    const { user, activeOrgId } = await requireActiveOrg();
    const { shareId } = await params;
    if (!shareId) return NextResponse.json({ error: 'Missing share id' }, { status: 400 });

    const key = getRateLimitKey('items:shares:rotate', _request, user.id);
    await rateLimitOrThrow({ key, limit: 10, windowSec: 60 });

    const supabase = await createClient();

    const { data: share } = await supabase
      .from('item_shares')
      .select('id, org_id, item_id, expires_at')
      .eq('id', shareId)
      .eq('org_id', activeOrgId)
      .single();

    if (!share) return NextResponse.json({ error: 'Share not found' }, { status: 404 });

    const itemId = (share as { item_id: string }).item_id;
    if (!itemId) return NextResponse.json({ error: 'Invalid share' }, { status: 400 });

    await supabase
      .from('item_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', shareId)
      .eq('org_id', activeOrgId);

    const newToken = generateToken();

    const { data: newShare, error } = await supabase
      .from('item_shares')
      .insert({
        org_id: activeOrgId,
        item_id: itemId,
        token: newToken,
        created_by: user.id,
        expires_at: (share as { expires_at: string | null }).expires_at,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(newShare);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: e.headers });
    }
    if (e instanceof Error && (e.message === 'Unauthenticated' || e.message === 'No active org')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    Sentry.captureException(e, { tags: { area: 'share_item', handler: 'items_shares_rotate' } });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 },
    );
  }
}
