# Phase 9A: Observability + Rate Limiting + Healthcheck

## Overview

Phase 9A hardens production with Sentry for error visibility, Upstash Redis-backed rate limiting, structured API logging, and a safe health endpoint.

## Sentry

### Setup

1. Create a project at [sentry.io](https://sentry.io).
2. Add `NEXT_PUBLIC_SENTRY_DSN` (client) and optionally `SENTRY_DSN` (server/edge) to env.
3. For source maps in CI, set `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN`.
4. Sentry is **enabled only in production** when DSN is set.

### Env vars

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SENTRY_DSN` | Client DSN; public |
| `SENTRY_DSN` | Server/edge DSN (optional; falls back to `NEXT_PUBLIC_SENTRY_DSN`) |
| `SENTRY_ENVIRONMENT` | Override env label (optional) |
| `SENTRY_RELEASE` | Release identifier (optional) |
| `SENTRY_AUTH_TOKEN` | For source map uploads (CI only) |

### Verify

Trigger a test error in production and confirm it appears in Sentry Issues.

---

## Upstash Redis

### Setup

1. Create an Upstash Redis database at [upstash.com](https://upstash.com).
2. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to env.
3. When Redis is **not** configured (local dev), rate limiting is disabled and a warning is logged once.

### Rate limits (per route)

| Route | Limit |
|-------|-------|
| `/api/search` | 60/min per user |
| `/api/items` (POST) | 30/min per user |
| `/api/items/upload` | 10/min per user |
| `/api/billing/checkout` | 10/min per user |
| `/api/billing/portal` | 10/min per user |
| `/api/alerts/process-due` | 120/min (cron) |

---

## Cron secret

`/api/alerts/process-due` requires `CRON_SECRET`. Send via:

- Header: `x-cron-secret: <CRON_SECRET>`
- Or: `Authorization: Bearer <CRON_SECRET>`

Without the secret, the endpoint returns 401.

---

## Health endpoint

`GET /api/health` returns:

```json
{
  "status": "ok",
  "env": "production",
  "time": "2026-03-03T...",
  "checks": {
    "db": "ok",
    "redis": "ok",
    "stripe": "ok"
  }
}
```

- **db**: Lightweight Supabase query; `ok` or `fail`
- **redis**: Upstash ping when configured; `ok`, `skip`, or `fail`
- **stripe**: Env var presence only; `ok` or `skip`

Do **not** expose secrets. Use for load balancer health checks.

---

## Structured API logging

`src/lib/apiLog.ts` provides `logApi()` which logs JSON:

```json
{"type":"api","requestId":"...","path":"/api/search","method":"GET","status":200,"ms":45,"userId":"..."}
```

Logs are emitted for success and error responses on updated endpoints. Do **not** log secrets or full request bodies.

---

## Verification checklist

- [ ] Set Sentry DSN in Vercel; trigger error in prod → event in Sentry
- [ ] Set Upstash URL/token; hit `/api/search` repeatedly → 429 after 60 req/min
- [ ] Hit `/api/health` → status ok, checks correct (redis/stripe skip when env missing)
- [ ] Call `/api/alerts/process-due` without `x-cron-secret` when `CRON_SECRET` set → 401
