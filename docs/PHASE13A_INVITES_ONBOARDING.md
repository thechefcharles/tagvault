# Phase 13A: Invitations v2 + Onboarding

## Purpose

Production-grade invite lifecycle (resend, revoke, expiry, audit) and a first-run onboarding flow so teams are usable: pending invites surface in-app, accept flow handles edge cases, and post-login routes users to an onboarding choice.

## DB Migration (0024_phase13a_invites_onboarding.sql)

- **org_invites**: Added `revoked_at` (timestamptz, nullable). Added UPDATE policy so owner/admin can set `revoked_at` (soft revoke).
- **get_invite_org_if_pending**: Now excludes rows where `revoked_at IS NOT NULL`.
- **resend_org_invite(p_invite_id)**: New RPC. Rotates token and sets `expires_at = now() + 7 days`. Caller must be owner/admin; invite must be pending (not accepted/revoked). Returns `{ token, expires_at }`.
- **get_pending_invites_for_user()**: New RPC. Returns pending invites for the current user’s email (id, org_id, org_name, role, expires_at). Used for onboarding and banner.
- **get_org_id_for_invite_id_if_recipient(p_invite_id)**: Returns org_id if the invite is for the current user and still pending. Used for seat check before accept-by-id.
- **accept_org_invite_by_id(p_invite_id)**: Accepts by invite id when invite email matches current user. Same semantics as token-based accept (idempotent, sets accepted_at).
- **Indexes**: `idx_org_invites_pending` updated to exclude revoked; `idx_org_invites_email_pending` added for pending-by-email.

## Audit (admin_audit_log)

Invite actions are logged with `action` and `metadata`:

- **invite_sent**: POST create invite (metadata: org_id, invite_id, invite_email).
- **invite_resent**: POST resend (metadata: org_id, invite_id, invite_email).
- **invite_revoked**: DELETE invite → UPDATE revoked_at (metadata: org_id, invite_id, invite_email).
- **invite_accepted**: After token accept or accept-by-id (metadata: org_id, accepted_by_user_id).

Actor is the acting user’s email (`admin_email`).

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/orgs/[orgId]/invites | Create invite. Rate limit 10/min. Audit: invite_sent. |
| POST | /api/orgs/[orgId]/invites/[inviteId]/resend | Resend (new token, 7-day expiry). Owner/admin. Rate limit 10/min. Audit: invite_resent. |
| DELETE | /api/orgs/[orgId]/invites/[inviteId] | Revoke (set revoked_at). Owner/admin. Audit: invite_revoked. |
| GET | /api/orgs/invites/pending | Pending invites for current user’s email. For onboarding/banner. |
| POST | /api/orgs/invites/accept | Accept by token. Handles expired, email_mismatch, already_used, 402. Audit: invite_accepted. |
| POST | /api/orgs/invites/accept-by-id | Accept by invite_id (for onboarding “Join”). Same checks. Audit: invite_accepted. |

## Accept Flow (statuses)

- **Expired**: 400, code `EXPIRED` — “This invite has expired. Ask your admin to resend it.”
- **Seat limit**: 402, `PLAN_LIMIT_EXCEEDED`, `upgrade: true` — Upgrade CTA.
- **Already used**: 400, code `ALREADY_USED`.
- **Wrong email**: 403, code `EMAIL_MISMATCH` — “This invite was sent to a different email address.”
- **Invalid token**: 400, code `INVALID_TOKEN`.

Accept is idempotent: already-a-member re-accept updates role and sets accepted_at.

## UI

- **Members page (/orgs/[id]/members)**: Pending list shows email, role, expires_at, “Copy link”, “Resend”, “Revoke”. Expiry warning when &lt;48h. Resend/Copy link call resend API and show new link.
- **Invite page (/invite)**: Explicit states for expired, email mismatch, already used, 402 with upgrade link.
- **Onboarding (/onboarding)**: Pending invites with “Join”, “Continue with Personal org”, “Create new org”. Join uses accept-by-id.
- **Banner**: When user has pending invites, banner appears (app group layout): “You have N pending invite(s). View and join” → /onboarding.

## Post-login routing

- Auth callback: when `next` is `/app` (or empty), redirect to `/onboarding?next=/app` so users see onboarding first; “Continue with Personal org” goes to /app.

## Rate limits

- Invite create + resend: `orgs:invites` key, 10 requests/minute per user.

## Observability

- Sentry breadcrumbs in invite create (on error), resend (on error), revoke (on error), accept (on RPC rejection and in catch).
- Tags/extra: `area: orgs`, `action: invite_sent | invite_resend | invite_accept`, org_id, invite_id, status.

## Manual test checklist

- [ ] **Resend**: As owner/admin, resend a pending invite; new link works; old token no longer works; audit log has invite_resent.
- [ ] **Revoke**: Revoke invite; accept with that token returns invalid/expired; audit log has invite_revoked. Pending list no longer shows it.
- [ ] **Expiry**: Invite &lt;48h shows expiry warning on members page. Expired invite: accept returns EXPIRED and UI shows “ask admin to resend”.
- [ ] **Seat limit**: Org at seat limit; accept (or resend if that would over-count) returns 402 and upgrade CTA.
- [ ] **Already member**: User already in org; accept with token still succeeds (idempotent), adds/updates membership.
- [ ] **Wrong email**: Log in as A, open invite link for B’s email; accept returns EMAIL_MISMATCH and clear message.
- [ ] **Onboarding**: After login, redirect to /onboarding; pending invites show “Join”; Join adds to org and redirects to /app. “Continue with Personal org” and “Create new org” work.
- [ ] **Banner**: User with pending invites sees banner; “View and join” goes to /onboarding.
- [ ] **Rate limit**: 11 invite creates or resends in 1 min → 429.
- [ ] `pnpm lint` and `pnpm typecheck` pass.
