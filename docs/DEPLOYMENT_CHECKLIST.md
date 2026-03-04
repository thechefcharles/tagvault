# Deployment Checklist — TagVault Preflight

Pre-deploy verification for production and preview environments.

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| NEXT_PUBLIC_SUPABASE_URL | ✓ | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✓ | Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | ✓ | Server-side only; never in client |
| CRON_SECRET | ✓ | For alerts cron job |
| STRIPE_SECRET_KEY | ✓ | Billing |
| STRIPE_WEBHOOK_SECRET | ✓ | Billing webhook verification |
| STRIPE_PRICE_PRO_MONTHLY | ✓ | Pro plan price ID |
| SENTRY_DSN | Recommended | Error observability |
| NEXT_PUBLIC_SENTRY_DSN | Recommended | Client-side errors |
| SENTRY_AUTH_TOKEN | CI only | Source map uploads |
| SENTRY_ORG | If auth token | Sentry org slug |
| SENTRY_PROJECT | If auth token | Sentry project slug |
| UPSTASH_REDIS_REST_URL | Optional | Rate limiting (otherwise in-memory) |
| UPSTASH_REDIS_REST_TOKEN | Optional | Rate limiting |
| OPENAI_API_KEY | Optional | Semantic search |
| BILLING_GRACE_DAYS | Optional | Default 7 |
| ADMIN_EMAILS | Optional | Comma-separated admin emails |

## Stripe Webhook

1. In Stripe Dashboard → Developers → Webhooks, add endpoint: `https://your-app.vercel.app/api/billing/webhook`
2. Select events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
3. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`

## Cron Endpoint

Configure Vercel Cron (vercel.json or dashboard):

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

Send `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.

## Supabase Migrations

1. Apply migrations: `supabase db push` or run migrations manually.
2. Ensure migrations 0001–0015 are applied (schema, billing, entitlements, RLS, etc.).

## RLS Sanity Check

- `profiles`, `items`, `saved_searches`, `alerts`, `billing_accounts`: users access only own rows.
- `stripe_webhook_events`: no policies (service-role only).
- `embedding_queue`, `search_queries`: RLS per migration 0010.

## Sentry Verification

1. Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in Vercel.
2. Deploy to Preview.
3. Visit `GET /api/debug/sentry` on the Preview URL.
4. Confirm the error appears in Sentry Issues.

## Health Check

1. Deploy.
2. Visit `GET /api/health`.
3. Expect `{ ok: true, env, time, checks: { db, redis, stripe } }`.
4. `checks.db` should be `ok`; `redis`/`stripe` may be `ok` or `skip`.
