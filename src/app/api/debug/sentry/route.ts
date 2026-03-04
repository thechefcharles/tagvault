/**
 * Test route to verify Sentry capture.
 * Blocked in production (VERCEL_ENV === 'production'); returns 404.
 * Allowed in development and Vercel Preview.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';
  if (env === 'production') {
    return new Response(null, { status: 404 });
  }
  throw new Error('Sentry debug: intentional test error');
}
