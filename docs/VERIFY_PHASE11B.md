# Phase 11B Verification

## Health Endpoint

### Expected 200 (DB OK)

```bash
curl -s https://your-app.vercel.app/api/health | jq
```

Example response:

```json
{
  "ok": true,
  "time": "2025-03-02T12:00:00.000Z",
  "version": "abc123",
  "checks": {
    "db": { "ok": true },
    "redis": "ok",
    "sentry": true
  },
  "ms": 50
}
```

- `redis`: `"ok"` if Upstash env vars set and ping succeeds; `"skip"` if env not set; `"fail"` if Redis unreachable.
- `sentry`: `true` if SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN is set.

### Expected 503 (DB down)

Simulate by pointing to a broken DB or unsetting Supabase vars:

```json
{
  "ok": false,
  "time": "...",
  "version": null,
  "checks": {
    "db": { "ok": false, "error": "..." },
    "redis": "skip",
    "sentry": true
  },
  "ms": 10
}
```

## Cron Heartbeat

1. Run the cron: `curl -X POST -H "x-cron-secret: $CRON_SECRET" https://your-app.vercel.app/api/alerts/process-due`
2. Query `cron_runs`: `SELECT * FROM cron_runs WHERE job = 'alerts:process-due'`
3. Expect `last_ok = true`, `last_finished_at` set, `last_processed_count` filled.
