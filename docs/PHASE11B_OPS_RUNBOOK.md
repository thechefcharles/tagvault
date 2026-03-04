# Phase 11B: Ops Runbook

## Overview

Health checks, cron heartbeat, and operational runbook for TagVault production.

## Required Environment Variables

| Category | Variable | Notes |
|----------|----------|-------|
| Supabase | NEXT_PUBLIC_SUPABASE_URL | Project URL |
| Supabase | NEXT_PUBLIC_SUPABASE_ANON_KEY | Anon key |
| Supabase | SUPABASE_SERVICE_ROLE_KEY | Server-side only |
| Stripe | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO_MONTHLY | Billing |
| Cron | CRON_SECRET | For /api/alerts/process-due |
| Upstash | UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | Rate limiting + cron lock |
| Sentry | SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN | Error observability |

## Vercel Cron Configuration

Configure in `vercel.json` or Vercel Dashboard:

```json
{
  "crons": [
    {
      "path": "/api/alerts/process-due",
      "schedule": "0 12 * * *"
    }
  ]
}
```

Send header: `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.

## Health Endpoint

`GET /api/health` — Public, no auth. Returns:

- **200** when DB is OK: `{ ok: true, time, version, checks: { db, redis, sentry }, ms }`
- **503** when DB check fails: `{ ok: false, time, version, checks: { db: { ok: false, error }, ... }, ms }`

Use for load balancer health checks, uptime monitors, and pre-deploy verification.

## Sentry: Where to Look

| Issue | Sentry Location |
|-------|-----------------|
| Billing webhook errors | **Issues** → filter `area:billing` or `route:webhook` |
| Cron failures | **Issues** → filter `area:cron` or `job:alerts_process_due` |
| Search / items errors | **Issues** → filter `area:search` or `area:items` |
| Performance traces | **Performance** → transaction `billing.webhook.process` |

## Quick Triage

### Stripe webhook failing

1. Check Sentry for `area:billing` errors; note `event_id` and `event_type`.
2. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard webhook signing secret.
3. Check `stripe_webhook_events` for `status='failed'` and `error_message`.
4. Confirm Stripe webhook URL is correct and reachable.

### Cron lock / process-due issues

1. Check `cron_runs` table: `SELECT * FROM cron_runs WHERE job = 'alerts:process-due'`.
2. Inspect `last_ok`, `last_error`, `last_finished_at` to see if cron is running.
3. If `last_error = 'skipped: lock_not_acquired'`, a previous run is still holding the lock (TTL 120s).
4. Verify Redis (Upstash) is available if using cron lock.
5. Check Sentry for `area:cron` exceptions.

### Rate limit false positives

1. Confirm `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.
2. If Redis is down, rate limiting falls back to permissive (no 429).
3. Check response headers: `X-RateLimit-Remaining` — if 0, user hit limit.
4. Set `RATE_LIMIT_ENABLED=0` to disable if needed for debugging.
