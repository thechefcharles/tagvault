/**
 * Redis-backed rate limiting (fixed window). Returns standard headers.
 * Falls back to permissive when Redis unavailable.
 */

import { getRedis, isRedisAvailable } from './redis';

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  headers: Headers;
};

/** Extract client IP from x-forwarded-for (first value). */
export function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return null;
}

/** Build a stable rate limit key: <route>:u:<userId> or <route>:ip:<ip> */
export function getRateLimitKey(
  route: string,
  request: Request,
  userId?: string | null,
): string {
  if (userId) return `${route}:u:${userId}`;
  const ip = getClientIp(request);
  return `${route}:ip:${ip ?? 'unknown'}`;
}

function buildHeaders(limit: number, remaining: number, resetAt: number): Headers {
  const h = new Headers();
  h.set('X-RateLimit-Limit', String(limit));
  h.set('X-RateLimit-Remaining', String(remaining));
  h.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
  return h;
}

/**
 * Check rate limit. Uses INCR + EXPIRE (fixed window).
 * When Redis unavailable, returns ok: true with remaining=limit.
 */
export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowSeconds } = opts;

  if (!isRedisAvailable()) {
    const headers = buildHeaders(limit, limit, Date.now() + windowSeconds * 1000);
    return { ok: true, remaining: limit, resetAt: Date.now() + windowSeconds * 1000, headers };
  }

  const redis = getRedis()!;
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSec / windowSeconds) * windowSeconds;
  const redisKey = `rl:${key}:${windowStart}`;

  const pipe = redis.pipeline();
  pipe.incr(redisKey);
  pipe.expire(redisKey, windowSeconds + 1);
  const results = await pipe.exec();
  const count = (Array.isArray(results) ? results[0] : results) as number | undefined;
  const countNum = typeof count === 'number' ? count : 0;

  const resetAt = (windowStart + windowSeconds) * 1000;
  const remaining = Math.max(0, limit - countNum);
  const ok = countNum <= limit;
  const retryAfter = ok ? undefined : Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  const headers = buildHeaders(limit, remaining, resetAt);

  return { ok, remaining, resetAt, retryAfter, headers };
}
