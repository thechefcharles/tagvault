import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { resyncBillingFromStripe } from '@/lib/server/admin/billing';
import { apiOk, apiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return apiError('FORBIDDEN', 'Admin access required', undefined, 403);
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  if (!userId) {
    return apiError('BAD_REQUEST', 'user_id required', undefined, 400);
  }

  const result = await resyncBillingFromStripe(userId);

  if (!result.ok) {
    return apiError('NOT_FOUND', result.error, undefined, 404);
  }

  const payload =
    result.plan === 'free'
      ? { ok: true, plan: result.plan, message: result.message }
      : { ok: true, plan: result.plan, status: result.status };
  return apiOk(payload);
}
