# Phase 11: Sentry Observability

## Overview

Production-grade Sentry setup for Next.js 14 App Router: client, server, edge, with explicit instrumentation for high-risk endpoints (billing webhook, cron, search, items upload).

## Vercel Setup

1. Create a project at [sentry.io](https://sentry.io) (or use existing).
2. In Vercel: **Project → Settings → Environment Variables**:
   - `SENTRY_DSN` — DSN from Sentry project (Client Keys)
   - `NEXT_PUBLIC_SENTRY_DSN` — Same value (client-side errors)
   - `SENTRY_AUTH_TOKEN` — Auth token with `project:releases` scope (CI/source maps only)
   - `SENTRY_ENVIRONMENT` — Optional; overrides VERCEL_ENV / NODE_ENV
   - `SENTRY_RELEASE` — Optional; overrides VERCEL_GIT_COMMIT_SHA
3. Add env vars for **Production** and **Preview** as needed.

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| SENTRY_DSN | Yes (prod) | Server/edge error capture |
| NEXT_PUBLIC_SENTRY_DSN | Yes (prod) | Client error capture |
| SENTRY_AUTH_TOKEN | CI only | Source map uploads |
| SENTRY_ORG | If using auth token | Sentry org slug |
| SENTRY_PROJECT | If using auth token | Sentry project slug |
| SENTRY_ENVIRONMENT | No | Overrides VERCEL_ENV / NODE_ENV |
| SENTRY_RELEASE | No | Overrides VERCEL_GIT_COMMIT_SHA |

## What Is Captured

- **Errors**: Unhandled exceptions, `Sentry.captureException` from high-risk routes
- **Performance**: Traces (10% sample in prod), Session Replay (10% session, 100% on error)
- **Tags per area**: `area:billing`, `area:cron`, `area:search`, `area:items`
- **Billing webhook**: Transaction span, event_id and event_type on errors
- **Cron**: `lock_acquired`, `processed`, `job:alerts_process_due`
- **User context**: `user_id` as non-PII id when available (no emails, no query text)

## What Is Scrubbed

- Request cookies
- Request headers (including Authorization)
- Request bodies
- Passwords, tokens, API keys
- Raw query text and file contents

## Instrumented Endpoints

| Route | Tags | Extras |
|-------|------|--------|
| POST /api/billing/webhook | area:billing, route:webhook | event_id, event_type |
| POST /api/alerts/process-due | area:cron, job:alerts_process_due | lock_acquired, processed, duration_ms |
| GET /api/search | area:search | user_id (when available) |
| POST /api/items/upload | area:items | route, user_id (when available) |

## Verification Checklist

1. **Deploy** to Vercel Preview or Production with DSN set.
2. **Debug route**: Visit `GET /api/debug/sentry` (Preview) or as admin in Production → expect error in Sentry.
3. **Error**: Sentry **Issues** → new error appears; verify tags (area, route, etc.).
4. **Performance**: Sentry **Performance** → transactions (billing.webhook.process, HTTP) with spans.
5. **Replay**: Sentry **Replays** → session replay for client errors (when captured).

## Debug Route

`GET /api/debug/sentry` throws an intentional error to verify capture.

- **Preview**: Always allowed
- **Production**: Only allowed if requester’s email is in `ADMIN_EMAILS`; otherwise 404
