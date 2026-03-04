/**
 * Test route to verify Sentry capture.
 * - Preview: always allowed
 * - Production: only if caller's email is in ADMIN_EMAILS; otherwise 404
 */

import { getCurrentUser } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export async function GET() {
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';

  if (env === 'production') {
    const user = await getCurrentUser();
    const email = user?.email?.trim().toLowerCase();
    const admins = getAdminEmails();
    if (!email || !admins.has(email)) {
      return new Response(null, { status: 404 });
    }
  }

  throw new Error('Sentry debug: intentional test error');
}
