import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/server/auth';
import { resyncBillingFromStripe } from '@/lib/server/admin/billing';
import { apiOk, apiError } from '@/lib/api/response';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return apiError('FORBIDDEN', 'Admin access required', undefined, 403);
  }

  const { id: userId } = await params;
  if (!userId) {
    return apiError('BAD_REQUEST', 'user id required', undefined, 400);
  }

  const result = await resyncBillingFromStripe(userId);

  if (!result.ok) {
    return apiError('NOT_FOUND', result.error, undefined, 404);
  }

  return apiOk({ ok: true });
}
