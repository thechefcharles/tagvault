# Phase 12E: Team Plan + Seat Entitlements

## Purpose

Add a paid Team plan with `seat_limit=5`, wire it end-to-end through Stripe checkout, webhook, billing_accounts, and entitlements. Source of truth remains `billing_accounts.plan`; plan is derived from Stripe subscription `price_id`.

## Schema

- **0023_phase12e_team_plan.sql**: Extend `billing_accounts.plan` CHECK to include `'team'`.

## Env Vars

| Variable | Description |
|----------|-------------|
| `STRIPE_PRICE_PRO_MONTHLY` | Existing; Stripe Price ID for Pro |
| `STRIPE_PRICE_TEAM_MONTHLY` | New; Stripe Price ID for Team |

## Plan Mapping (Webhook)

- `price_id === STRIPE_PRICE_PRO_MONTHLY` → `plan=pro`
- `price_id === STRIPE_PRICE_TEAM_MONTHLY` → `plan=team`
- Unknown price → `plan=free` (with Sentry breadcrumb)

## Seat Limits (Entitlements)

| Plan | seats |
|------|-------|
| free | 1 |
| pro | 1 |
| team | 5 |

## API

- **POST /api/billing/checkout**: Accepts `plan` in body or `?plan=team` query. Uses `STRIPE_PRICE_TEAM_MONTHLY` for team, `STRIPE_PRICE_PRO_MONTHLY` for pro.

## UI

- **/pricing**: New page with Pro and Team plans; each has UpgradeButton with `plan` prop.
- **/orgs/[id]/members**: Seat usage display already uses `getOrgSeatUsage` → `getOrgEntitlements`; seat_limit is 5 when org is Team.
- Upgrade CTAs link to `/pricing`.

## Admin

- **POST /api/admin/users/[id]/set-plan**: Accepts `plan: 'free' | 'pro' | 'team'`.
- Resync from Stripe maps `price_id` to plan (pro or team).

## Verification Checklist

- [ ] Team checkout creates/updates org billing row with `plan='team'`
- [ ] Seat checks allow up to 5 members + pending invites for Team org
- [ ] Switching from Pro→Team (via Stripe portal) updates plan correctly via webhook
- [ ] Cancel-at-period-end + grace behavior remains unchanged
- [ ] pnpm lint and pnpm typecheck pass
