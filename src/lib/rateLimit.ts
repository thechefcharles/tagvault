/**
 * Distributed rate limiting via Upstash Redis.
 * When Redis is not configured (dev), allows requests and logs a warning once.
 */

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

let redisWarned = false;
const limiterCache = new Map<string, Ratelimit>();

function hasRedis(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return !!(url && token);
}

function warnRedisOnce(): void {
  if (!redisWarned && !hasRedis()) {
    redisWarned = true;
    console.warn('[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set; rate limiting disabled in dev');
  }
}

function getRatelimit(limit: number, windowSec: number): Ratelimit {
  const cacheKey = `rl:${limit}:${windowSec}`;
  let rl = limiterCache.get(cacheKey);
  if (!rl) {
    const url = process.env.UPSTASH_REDIS_REST_URL!;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
    const redis = new Redis({ url, token });
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    });
    limiterCache.set(cacheKey, rl);
  }
  return rl;
}

/** Extract client IP from request headers (x-forwarded-for, x-real-ip). */
export function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return null;
}

/** Ensure request is within rate limit; throws RateLimitError if exceeded. */
export async function rateLimitOrThrow(opts: {
  key: string;
  limit: number;
  windowSec: number;
}): Promise<void> {
  const { key, limit, windowSec } = opts;

  if (!hasRedis()) {
    warnRedisOnce();
    return;
  }

  const rl = getRatelimit(limit, windowSec);
  const result = await rl.limit(key);
  if (!result.success) {
    const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    throw new RateLimitError('Too many requests', retryAfter);
  }
}

/** Check rate limit; returns { ok, retryAfter } for backward compatibility. */
export async function checkRateLimit(
  identifier: string,
  options?: { limit?: number; windowSec?: number },
): Promise<{ ok: boolean; retryAfter?: number }> {
  const limit = options?.limit ?? 30;
  const windowSec = options?.windowSec ?? 60;
  try {
    await rateLimitOrThrow({ key: identifier, limit, windowSec });
    return { ok: true };
  } catch (e) {
    if (e instanceof RateLimitError) {
      return { ok: false, retryAfter: e.retryAfter };
    }
    throw e;
  }
}
