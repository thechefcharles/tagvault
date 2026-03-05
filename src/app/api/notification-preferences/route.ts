import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireActiveOrg } from '@/lib/server/auth';
import { apiOk, apiError } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';

const patchSchema = z.object({
  push_enabled: z.boolean().optional(),
  push_alerts: z.boolean().optional(),
  push_digest: z.boolean().optional(),
});

export async function GET() {
  try {
    const { user, activeOrgId } = await requireActiveOrg();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('push_enabled, push_alerts, push_digest, digest_frequency, timezone')
      .eq('user_id', user.id)
      .eq('org_id', activeOrgId)
      .maybeSingle();

    if (error) {
      return apiError('INTERNAL_ERROR', 'Failed to load preferences', undefined, 500);
    }

    const prefs = data ?? {
      push_enabled: true,
      push_alerts: true,
      push_digest: false,
      digest_frequency: 'none' as const,
      timezone: 'UTC',
    };
    return apiOk(prefs);
  } catch {
    return apiError('UNAUTHORIZED', 'Unauthorized', undefined, 401);
  }
}

export async function PATCH(request: NextRequest) {
  let user: { id: string };
  let activeOrgId: string;
  try {
    const ctx = await requireActiveOrg();
    user = ctx.user;
    activeOrgId = ctx.activeOrgId;
  } catch {
    return apiError('UNAUTHORIZED', 'Unauthorized', undefined, 401);
  }

  const raw = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', parsed.error.message, undefined, 400);
  }

  const { push_enabled, push_alerts, push_digest } = parsed.data;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (push_enabled !== undefined) updates.push_enabled = push_enabled;
  if (push_alerts !== undefined) updates.push_alerts = push_alerts;
  if (push_digest !== undefined) updates.push_digest = push_digest;
  if (Object.keys(updates).length <= 1) {
    return apiOk({ ok: true });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      {
        user_id: user.id,
        org_id: activeOrgId,
        ...updates,
      },
      { onConflict: 'user_id,org_id' },
    );

  if (error) {
    return apiError('INTERNAL_ERROR', 'Failed to update preferences', undefined, 500);
  }
  return apiOk({ ok: true });
}
