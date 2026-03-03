# Environment Variables

## Required

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (safe for client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Bypasses RLS. Never expose to client. |

## Optional (features)

| Variable | Notes |
|----------|-------|
| `OPENAI_API_KEY` | For semantic search (hybrid search). FTS works without it. |
| `OPENAI_EMBEDDINGS_MODEL` | Default: `text-embedding-3-small` |

## Production hardening (Phase 7)

| Variable | Notes |
|----------|-------|
| `CRON_SECRET` | Required for `/api/alerts/process-due`. Vercel Cron must send `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`. |
| `SENTRY_DSN` | Server-side Sentry DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side Sentry DSN (for error monitoring) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL (distributed rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `SENTRY_ORG` | Sentry org slug (for source maps) |
| `SENTRY_PROJECT` | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | Sentry auth token (CI source map uploads) |

## Local development

Copy `.env.example` to `.env.local` and fill in values. Rate limiting falls back to in-memory when Upstash vars are unset. Sentry is disabled when DSN is unset.
