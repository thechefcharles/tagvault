# Phase 12B: Org/Team Foundation

## Purpose

Minimum viable org layer that is backward-compatible with the single-user model. Uses the existing `organizations` and `org_members` tables; adds `active_org_id` to profiles, ensures every user has a personal org, and scopes items, saved searches, alerts, notifications, and billing to the active org.

## Schema Summary

- **profiles**: New column `active_org_id` (uuid, references organizations.id). Index on active_org_id.
- **organizations** (existing): id, name, slug, owner_id. No schema change.
- **org_members** (existing): org_id, user_id, role. No schema change.
- **items**: New column `org_id` (NOT NULL, references organizations). RLS by org membership.
- **billing_accounts**: New column `org_id` (NOT NULL, UNIQUE). PK changed from user_id to org_id. RLS by org membership.
- **saved_searches**, **alerts**: Backfill `org_id` for rows that had only owner_user_id. RLS allows org membership or owner.
- **notifications**: New column `org_id` (nullable). RLS remains owner-based.

## RLS Policy Summary

- **organizations**: Existing (members read; owner create; owner/admin update; owner delete).
- **org_members**: Existing (members read; owner/admin manage).
- **items**: Select/insert/update/delete allowed if `is_org_member(org_id)`; insert requires auth.uid() = user_id.
- **billing_accounts**: Select/insert/update if `is_org_member(org_id)`; insert requires auth.uid() = user_id.
- **saved_searches**, **alerts**: Select/insert/update/delete if `is_org_member(org_id)` OR owner_user_id = auth.uid().

## Backfill Notes

- **0018**: For every profile with null active_org_id, `ensure_personal_org(id)` creates an organization (name "Personal", slug personal-&lt;user_id&gt;) and sets profile.active_org_id.
- **0019**: Items: set org_id from profile.active_org_id (then fallback org where user is owner, then any org membership). Billing: set org_id from profile.active_org_id. Saved_searches and alerts: set org_id from profile.active_org_id for rows with owner_user_id. Notifications: set org_id from profile.active_org_id.

## Key Functions

- **ensure_personal_org(p_user_id)**: SECURITY DEFINER. If no org exists where owner_id = p_user_id, creates one, ensures org_members row, sets profiles.active_org_id. Returns org id.
- **ensure_my_personal_org()**: RPC for app; calls ensure_personal_org(auth.uid()).

## Routes & Pages

| Route | Description |
|-------|-------------|
| GET/POST /api/orgs | List orgs (user's memberships), create org |
| POST /api/orgs/active | Set profile.active_org_id (body: { active_org_id }) |
| /orgs | Orgs list + create form (protected) |
| /app | Vault; header includes org switcher (dropdown + "Create org") |

## Security Notes

- Admin gating unchanged (ADMIN_EMAILS + requireAdmin).
- Middleware protects /orgs (logged-in only).
- requireActiveOrg() ensures user has active_org_id (calls ensure_my_personal_org if missing).
- Billing and entitlements are per-org; checkout/portal use active org.

## Verification Checklist

- [ ] Each user gets a personal org automatically; active_org_id is set (sign up or run ensure_my_personal_org).
- [ ] Items created by User A are not visible to User B (different orgs).
- [ ] User A creates a second org and switches active org; items are scoped correctly by active org.
- [ ] Billing: upgrading while in Org X applies Pro to Org X only; switching back to personal org shows Free unless that org is upgraded.
- [ ] pnpm lint and pnpm typecheck pass.
