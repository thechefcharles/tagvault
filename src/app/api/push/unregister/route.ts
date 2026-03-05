import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireActiveOrg } from '@/lib/server/auth';
import { apiOk, apiError } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  player_id: z.string().min(1, 'player_id required'),
});

export async function POST(request: NextRequest) {
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
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', parsed.error.message, undefined, 400);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('push_devices')
    .delete()
    .eq('org_id', activeOrgId)
    .eq('user_id', user.id)
    .eq('provider', 'onesignal')
    .eq('player_id', parsed.data.player_id);

  if (error) {
    return apiError('INTERNAL_ERROR', 'Failed to unregister device', undefined, 500);
  }

  return apiOk({ ok: true });
}
