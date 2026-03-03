/**
 * Distributed rate limiting via Upstash Redis (sliding window).
 * Falls back to in-memory when Redis is not configured (local dev).
 */

const WINDOW_SEC = 60;
const MAX_REQUESTS = 30;

let ratelimit: {
  limit: (identifier: string) => Promise<{ success: boolean; reset: number }>;
} | null = null;

// In-memory fallback (same behavior as before, for local dev)
const memStore = new Map<string, { count: number; resetAt: number }>();

function getMemoryLimit(identifier: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = memStore.get(identifier);

  if (!entry) {
    memStore.set(identifier, { count: 1, resetAt: now + WINDOW_SEC * 1000 });
    return { ok: true };
  }

  if (now > entry.resetAt) {
    memStore.set(identifier, { count: 1, resetAt: now + WINDOW_SEC * 1000 });
    return { ok: true };
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

async function getRedisLimit(identifier: string): Promise<{ ok: boolean; retryAfter?: number }> {
  if (!ratelimit) {
    try {
      const { Redis } = await import('@upstash/redis');
      const { Ratelimit } = await import('@upstash/ratelimit');

      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;

      if (!url || !token) {
        return getMemoryLimit(identifier);
      }

      const redis = new Redis({ url, token });
      ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(MAX_REQUESTS, `${WINDOW_SEC} s`),
      });
    } catch {
      return getMemoryLimit(identifier);
    }
  }

  try {
    const result = await ratelimit.limit(identifier);
    if (result.success) {
      return { ok: true };
    }
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  } catch {
    return getMemoryLimit(identifier);
  }
}

export async function checkRateLimit(identifier: string): Promise<{
  ok: boolean;
  retryAfter?: number;
}> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return getRedisLimit(identifier);
  }
  return getMemoryLimit(identifier);
}
