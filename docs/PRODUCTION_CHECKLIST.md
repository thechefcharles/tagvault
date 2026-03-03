# Production Checklist — TagVault

## Required environment variables

Set these in Vercel (and locally for production-like testing):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (for alerts cron)

## Optional (recommended for production)

- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` — Error observability
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Distributed rate limiting (falls back to in-memory if unset)
- `OPENAI_API_KEY` — Semantic search
- `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` — Source map uploads (CI)

## Supabase

- **Service role key**: Use only in server-side code (API routes, Server Components). Never in client bundles or middleware.
- **RLS**: Ensure `embedding_queue` and `search_queries` have RLS (migration `0010`).
- **Redirect URLs**: Add production URL to Supabase Auth → URL Configuration (e.g. `https://your-app.vercel.app/**`).

## Vercel Cron

Configure Vercel Cron to call the alerts endpoint:

```txt
# vercel.json (or Vercel dashboard)
{
  "crons": [
    {
      "path": "/api/alerts/process-due",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Send the secret via header:

- `x-cron-secret: <CRON_SECRET>` **or**
- `Authorization: Bearer <CRON_SECRET>`

## Redis (Upstash)

1. Create an Upstash Redis database at [upstash.com](https://upstash.com).
2. Copy REST URL and token to env vars.
3. Rate limiting uses sliding window (30 req/min per user for items write endpoints).

## Sentry

1. Create a project at [sentry.io](https://sentry.io).
2. Add `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`.
3. For source maps: set `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` in CI.
4. Verify: trigger a test error (e.g. add a temporary `/api/test-error` that throws) and confirm it appears in Sentry Issues.

## Rollback steps

1. **Revert deployment**: Vercel → Deployments → select previous → Promote to Production.
2. **Disable cron**: Remove or disable the cron job in Vercel.
3. **Disable Sentry**: Unset `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`; app continues without observability.
4. **Rate limit fallback**: Unset Upstash vars; app uses in-memory rate limiting (less accurate across serverless instances).
