import * as Sentry from '@sentry/nextjs';

export async function register() {
  try {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('./lib/env');
      await import('../sentry.server.config');
    }
    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('../sentry.edge.config');
    }
  } catch (err) {
    console.error('[instrumentation] Failed to load:', err);
  }
}

export const onRequestError = Sentry.captureRequestError;
