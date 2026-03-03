import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { apiError } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { VAULT_BUCKET } from '@/lib/storage/constants';
import { getItemById, updateItem, deleteItem } from '@/lib/db/items';
import { updateItemSchema } from '@/lib/db/validators';
import { assertWithinLimits, incrementUsage, EntitlementError } from '@/lib/entitlements';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const download = searchParams.get('download') === '1';

    const item = await getItemById({ userId: user.id, id });
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (download && item.type === 'file' && item.storage_path) {
      const supabase = await createClient();
      const { data: urlData, error } = await supabase.storage
        .from(VAULT_BUCKET)
        .createSignedUrl(item.storage_path, 60);

      if (!error && urlData?.signedUrl) {
        return NextResponse.redirect(urlData.signedUrl);
      }
    }

    return NextResponse.json(item);
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const limit = await checkRateLimit(`items:${user.id}`);
    if (!limit.ok) {
      return apiError(
        'RATE_LIMITED',
        'Too many requests. Please try again later.',
        { retryAfter: limit.retryAfter },
        429,
      );
    }
    const { id } = await params;
    const body = await request.json();

    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const hasEmbeddingTrigger = parsed.data.title !== undefined || parsed.data.description !== undefined;
    if (hasEmbeddingTrigger) {
      try {
        await assertWithinLimits({ userId: user.id, action: 'embeddings_enqueue' });
      } catch (e) {
        if (e instanceof EntitlementError) {
          return apiError('PLAN_LIMIT_EXCEEDED', e.message, undefined, 402);
        }
        throw e;
      }
    }

    const item = await updateItem({
      userId: user.id,
      id,
      payload: parsed.data,
    });

    if (hasEmbeddingTrigger) {
      await incrementUsage({ userId: user.id, action: 'embeddings_enqueue' });
    }

    return NextResponse.json(item);
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const limit = await checkRateLimit(`items:${user.id}`);
    if (!limit.ok) {
      return apiError(
        'RATE_LIMITED',
        'Too many requests. Please try again later.',
        { retryAfter: limit.retryAfter },
        429,
      );
    }
    const { id } = await params;

    const item = await getItemById({ userId: user.id, id });
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (item.storage_path) {
      const admin = createAdminClient();
      const { error: storageError } = await admin.storage
        .from(VAULT_BUCKET)
        .remove([item.storage_path]);

      if (storageError) {
        const msg = storageError.message?.toLowerCase() ?? '';
        const isNotFound =
          msg.includes('not found') ||
          msg.includes('object not found') ||
          msg.includes('does not exist');
        if (!isNotFound) {
          return NextResponse.json(
            { error: 'Failed to remove file from storage' },
            { status: 500 },
          );
        }
      }
    }

    await deleteItem({ userId: user.id, id });
    return NextResponse.json({ ok: true });
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
