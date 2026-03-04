import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireActiveOrg } from '@/lib/server/auth';
import { createClient } from '@/lib/supabase/server';
import { VAULT_BUCKET } from '@/lib/storage/constants';
import { getItemById } from '@/lib/db/items';

const EXPIRES_IN = 60; // seconds

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { activeOrgId } = await requireActiveOrg();
    const { id } = await params;

    const item = await getItemById({ orgId: activeOrgId, id });
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (item.type !== 'file' || !item.storage_path) {
      return NextResponse.json(
        { error: 'Item is not a file or has no storage path' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(VAULT_BUCKET)
      .createSignedUrl(item.storage_path, EXPIRES_IN);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed to create signed URL' },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: data.signedUrl });
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
