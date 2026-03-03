import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { apiError } from '@/lib/api/response';
import { assertWithinLimits, incrementUsage, EntitlementError } from '@/lib/entitlements';
import { createClient } from '@/lib/supabase/server';
import { VAULT_BUCKET } from '@/lib/storage/constants';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: Request) {
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
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const description = formData.get('description') as string | null;
    const title = (formData.get('title') as string | null) || null;
    const priorityRaw = formData.get('priority');
    const priority = priorityRaw
      ? Math.min(20, Math.max(1, parseInt(String(priorityRaw), 10)))
      : null;

    if (!file || !description?.trim()) {
      return NextResponse.json({ error: 'file and description are required' }, { status: 400 });
    }

    if (description.length < 12 || description.length > 500) {
      return NextResponse.json({ error: 'description must be 12–500 characters' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size must not exceed 50MB' }, { status: 400 });
    }

    try {
      await assertWithinLimits({ userId: user.id, action: 'items_create' });
      await assertWithinLimits({ userId: user.id, action: 'embeddings_enqueue' });
    } catch (e) {
      if (e instanceof EntitlementError) {
        return apiError('PLAN_LIMIT_EXCEEDED', e.message, undefined, 402);
      }
      throw e;
    }

    const supabase = await createClient();
    const db = await import('@/lib/db/items');
    const item = await db.createItem({
      userId: user.id,
      payload: {
        type: 'file',
        description: description.trim(),
        title: title?.trim() || null,
        priority,
      },
    });

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = `${user.id}/${item.id}/${safeName}`;

    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(VAULT_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      await db.deleteItem({ userId: user.id, id: item.id });
      return NextResponse.json({ error: uploadError.message || 'Upload failed' }, { status: 500 });
    }

    const updated = await db.attachFileToItem({
      userId: user.id,
      id: item.id,
      storage_path: storagePath,
      mime_type: file.type || 'application/octet-stream',
      title: title?.trim() || null,
    });

    await incrementUsage({ userId: user.id, action: 'items_create' });
    await incrementUsage({ userId: user.id, action: 'embeddings_enqueue' });

    return NextResponse.json(updated);
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
