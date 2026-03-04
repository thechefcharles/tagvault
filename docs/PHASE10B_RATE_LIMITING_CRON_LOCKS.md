# Phase 10B: Redis Rate Limiting + Cron Locks

## Overview

Production-grade Redis-backed rate limiting (Upstash) and cron locking to prevent duplicate execution in serverless.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| UPSTASH_REDIS_REST_URL | Yes (for Redis) | — | Upstash Redis REST URL |
| UPSTASH_REDIS_REST_TOKEN | Yes (for Redis) | — | Upstash Redis REST token |
| RATE_LIMIT_ENABLED | No | 1 | Set to 0 or false to disable rate limiting |

When Redis env vars are missing, the app runs in permissive mode (no rate limiting, no cron lock) and logs a warning once.

## Protected Routes and Limits

| Route | Key | Limit | Window |
|-------|-----|-------|--------|
| GET /api/search | search:u:\<userId\> | 60 | 60s |
| POST /api/items | items:u:\<userId\> | 30 | 60s |
| POST /api/items/upload | items:upload:u:\<userId\> | 10 | 60s |
| PATCH /api/items/[id] | items:u:\<userId\> | 30 | 60s |
| DELETE /api/items/[id] | items:u:\<userId\> | 30 | 60s |
| POST /api/billing/checkout | billing:checkout:u:\<userId\> | 10 | 60s |
| POST /api/billing/portal | billing:portal:u:\<userId\> | 10 | 60s |
| POST /api/billing/webhook | billing:webhook:ip:\<ip\> | 200 | 60s |
| POST /api/alerts/process-due | cron lock only | — | — |

Unauthenticated endpoints (webhook) use IP from `x-forwarded-for` (first value).

## Rate Limit Response

- Status: 429
- Body: `{ ok: false, error: { code: "RATE_LIMITED", message, details: { retry_after_seconds } } }`
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Cron Lock

- Lock key: `lock:cron:alerts:process-due`
- TTL: 120 seconds
- When lock not acquired: returns 200 with `{ ok: true, skipped: "lock_not_acquired" }` so Vercel cron doesn’t retry as failure

## Verification Checklist

1. **429 after N requests**: Hit a rate-limited route N+1 times within the window; expect 429 on the last request.
2. **Headers present**: Check 429 response has X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.
3. **Cron lock**: Send two POST requests to process-due within seconds; second should return `{ ok: true, skipped: "lock_not_acquired" }`.
4. **Permissive fallback**: Unset UPSTASH vars; app should run without rate limiting (no crash).
