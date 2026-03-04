# Phase 10A: Sentry Observability + Production Readiness

## Overview

Sentry end-to-end setup for Next.js 14 App Router on Vercel, with tagged errors and a deployment checklist.

## Sentry Setup in Vercel

1. Create a project at [sentry.io](https://sentry.io) (or use existing).
2. In Vercel: Project → Settings → Environment Variables:
   - **SENTRY_DSN** — DSN from Sentry project settings (Client Keys).
   - **NEXT_PUBLIC_SENTRY_DSN** — Same value; required for client-side errors.
3. For source maps (optional, CI only):
   - **SENTRY_ORG** — Sentry org slug
   - **SENTRY_PROJECT** — Project slug
   - **SENTRY_AUTH_TOKEN** — Auth token with `project:releases` scope (set in Vercel, not in repo)

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| SENTRY_DSN | Yes (prod) | Server/edge error capture |
| NEXT_PUBLIC_SENTRY_DSN | Yes (prod) | Client error capture |
| SENTRY_AUTH_TOKEN | CI only | Source map uploads |
| SENTRY_ORG | If using auth token | Sentry org slug |
| SENTRY_PROJECT | If using auth token | Sentry project slug |

`VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA` are set by Vercel and used for environment and release.

## Verify Events Locally

1. Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in `.env.local` (use a test DSN or real project).
2. Ensure `NODE_ENV=production` for local testing (Sentry is disabled when DSN unset or NODE_ENV=development).
3. Run: `npm run build && npm run start`
4. Visit `GET /api/debug/sentry` — should throw and report to Sentry (blocked in production; allowed in preview).

## Verify Events on Preview / Prod

1. Deploy to Vercel Preview or Production.
2. Ensure `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are set in Vercel.
3. On **Preview** only: visit `https://your-preview-url.vercel.app/api/debug/sentry` to trigger a test error.
4. Check Sentry Issues for the new event.
5. On **Production**: the debug route returns 404; verify by triggering a real error (e.g. invalid request to a protected endpoint).

## What We Capture

- **Errors**: Unhandled exceptions, `apiError` calls (when context is passed), `captureException` / `captureMessage` from `src/lib/observability/sentry.ts`.
- **Context tags**: `request_id`, `route`, `method`, `user_id`, `plan`, `billing_status` (when available).
- **Environment**: `VERCEL_ENV` or `NODE_ENV`.
- **Release**: `VERCEL_GIT_COMMIT_SHA` (Vercel builds).

## What We Do NOT Capture

- Raw request/response bodies.
- Passwords, tokens, API keys.
- File contents or upload payloads.
- PII beyond `user_id` (no emails in tags).

## Debug Route

`GET /api/debug/sentry` throws an error to verify Sentry capture. **Blocked in production** (`VERCEL_ENV === 'production'`); returns 404. Allowed in development and Vercel Preview.

## See Also

- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) — Full preflight checklist
