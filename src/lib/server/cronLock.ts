/**
 * Redis-backed cron lock to prevent duplicate execution in serverless.
 * Uses SET key value NX EX ttl; release only if token matches.
 */

import { getRedis, isRedisAvailable } from './redis';

const LOCK_PREFIX = 'lock:';

export async function withCronLock<T>(
  lockKey: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<{ acquired: boolean; result?: T }> {
  const fullKey = `${LOCK_PREFIX}${lockKey}`;
  const token = crypto.randomUUID();

  if (!isRedisAvailable()) {
    return { acquired: true, result: await fn() };
  }

  const redis = getRedis()!;
  const setResult = await redis.set(fullKey, token, { nx: true, ex: ttlSeconds });

  if (!setResult) {
    return { acquired: false };
  }

  try {
    const result = await fn();
    return { acquired: true, result };
  } finally {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(script, [fullKey], [token]);
  }
}
