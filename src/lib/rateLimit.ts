/**
 * Distributed rate limiting via Upstash Redis.
 * Uses server/rateLimit (INCR + EXPIRE) and server/redis.
 * When Redis is not configured, allows requests and logs a warning once.
 */

import {
  rateLimit as serverRateLimit,
  getRateLimitKey,
  getClientIp,
  type RateLimitResult,
} from '@/lib/server/rateLimit';

export { getClientIp, getRateLimitKey };

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter: number,
    public readonly headers: Headers,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** Ensure request is within rate limit; throws RateLimitError if exceeded. */
export async function rateLimitOrThrow(opts: {
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult | void> {
  const result = await serverRateLimit({
    key: opts.key,
    limit: opts.limit,
    windowSeconds: opts.windowSec,
  });
  if (!result.ok) {
    throw new RateLimitError(
      'Too many requests',
      result.retryAfter ?? 60,
      result.headers,
    );
  }
  return result as RateLimitResult;
}

/** Check rate limit; returns { ok, retryAfter, headers }. */
export async function checkRateLimit(
  identifier: string,
  options?: { limit?: number; windowSec?: number },
): Promise<{ ok: boolean; retryAfter?: number; headers: Headers }> {
  const limit = options?.limit ?? 30;
  const windowSec = options?.windowSec ?? 60;
  const result = await serverRateLimit({
    key: identifier,
    limit,
    windowSeconds: windowSec,
  });
  if (result.ok) {
    return { ok: true, headers: result.headers };
  }
  return {
    ok: false,
    retryAfter: result.retryAfter,
    headers: result.headers,
  };
}
