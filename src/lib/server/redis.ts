/**
 * Upstash Redis singleton. Falls back to null when env vars missing (permissive mode).
 */

import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;
let redisWarned = false;

function hasRedisEnv(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return !!(url && token);
}

function isRateLimitEnabled(): boolean {
  if (!hasRedisEnv()) return false;
  const v = process.env.RATE_LIMIT_ENABLED;
  if (v === '0' || v === 'false') return false;
  return true;
}

export function getRedis(): Redis | null {
  if (!hasRedisEnv()) {
    if (!redisWarned) {
      redisWarned = true;
      console.warn('[redis] UPSTASH_REDIS_REST_URL/TOKEN not set; Redis features disabled');
    }
    return null;
  }
  if (!redisInstance) {
    redisInstance = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisInstance;
}

export function isRedisAvailable(): boolean {
  return isRateLimitEnabled() && getRedis() !== null;
}
