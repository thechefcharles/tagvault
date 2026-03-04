import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { VAULT_BUCKET } from '@/lib/storage/constants';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimitOrThrow, RateLimitError, getClientIp } from '@/lib/rateLimit';

const EXPIRES_IN = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; itemId: string }> },
) {
  const ip = getClientIp(request) ?? 'unknown';
  try {
    await rateLimitOrThrow({
      key: `share:download:ip:${ip}`,
      limit: 60,
      windowSec: 60,
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: e.headers });
    }
    throw e;
  }

  try {
    const { token, itemId } = await params;
    if (!token || !itemId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const supabase = await createClient();
    const { data: raw, error: rpcError } = await supabase.rpc('get_shared_collection_by_token', {
      p_token: token,
    });

    if (rpcError) {
      Sentry.captureException(rpcError, { tags: { area: 'share', phase: 'rpc' } });
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const payload = raw as { collection: unknown; items: { id: string; type: string; storage_path: string | null }[] } | null;
    if (!payload || !payload.items) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const item = payload.items.find((i) => i.id === itemId);
    if (!item || item.type !== 'file' || !item.storage_path) {
      return NextResponse.json(
        { error: 'Item not found or is not a file' },
        { status: 404 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(VAULT_BUCKET)
      .createSignedUrl(item.storage_path, EXPIRES_IN);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed to create download URL' },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'share' } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
