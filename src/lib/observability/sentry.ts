/**
 * Sentry helpers for API routes — standardize tags/extras.
 * Do NOT pass sensitive data (tokens, passwords, file contents).
 */

import * as Sentry from '@sentry/nextjs';

export type SentryContext = {
  requestId?: string;
  route?: string;
  method?: string;
  userId?: string;
  plan?: string;
  billingStatus?: string;
  [key: string]: string | number | boolean | undefined;
};

/** Capture an exception with context. Safe to call when Sentry is disabled. */
export function captureException(err: unknown, context?: SentryContext): string | undefined {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return undefined;
  return Sentry.captureException(err, {
    extra: context,
  });
}

/** Capture a message with level and context. Safe to call when Sentry is disabled. */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'error',
  context?: SentryContext,
): string | undefined {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return undefined;
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}
