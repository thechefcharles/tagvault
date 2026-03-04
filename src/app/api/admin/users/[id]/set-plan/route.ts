import { NextRequest } from 'next/server';
import { requireAdminWithEmail } from '@/lib/server/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiOk, apiError } from '@/lib/api/response';
import { z } from 'zod';

const bodySchema = z.object({
  plan: z.enum(['free', 'pro', 'team']),
  status: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let adminEmail: string;
  try {
    const { email } = await requireAdminWithEmail();
    adminEmail = email;
  } catch {
    return apiError('FORBIDDEN', 'Admin access required', undefined, 403);
  }

  const { id: targetUserId } = await params;
  if (!targetUserId) {
    return apiError('BAD_REQUEST', 'user id required', undefined, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON body', undefined, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError('BAD_REQUEST', parsed.error.message, undefined, 400);
  }

  const { plan, status } = parsed.data;
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('active_org_id')
    .eq('id', targetUserId)
    .single();
  const orgId = profile?.active_org_id as string | null;
  if (!orgId) {
    return apiError('BAD_REQUEST', 'User has no active org', undefined, 400);
  }

  const { data: org } = await admin.from('organizations').select('owner_id').eq('id', orgId).single();
  const ownerId = (org?.owner_id as string) ?? targetUserId;

  const { error: updateError } = await admin
    .from('billing_accounts')
    .upsert(
      {
        org_id: orgId,
        user_id: ownerId,
        plan,
        ...(typeof status === 'string' ? { status } : {}),
      },
      { onConflict: 'org_id' },
    );

  if (updateError) {
    return apiError('INTERNAL_ERROR', updateError.message, undefined, 500);
  }

  await admin.from('admin_audit_log').insert({
    admin_email: adminEmail,
    action: 'set_plan',
    target_user_id: targetUserId,
    metadata: { plan, status: status ?? null },
  });

  return apiOk({ ok: true });
}
