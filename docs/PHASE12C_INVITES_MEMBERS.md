# Phase 12C: Org Membership + Invites (MVP)

## Purpose

Make organizations multi-user: invite by email, accept via one-time link, manage members and roles. Invites are token-based (hash stored only); acceptance verifies the logged-in user’s email matches the invite.

## Schema Summary

- **profiles**: New column `email` (text, nullable). Backfilled from `auth.users`. Used for member list and invite acceptance check.
- **org_members** (existing): No schema change. Creator is already added as owner via `handle_new_organization` trigger.
- **org_invites**: New table.
  - `id` uuid PK, `org_id` → organizations(id), `email` text, `role` ('admin'|'member'), `token_hash` text UNIQUE, `expires_at` timestamptz, `accepted_at` timestamptz, `accepted_by` uuid, `created_by` uuid, `created_at` timestamptz.
  - Indexes: org_id, (org_id, email), partial (org_id WHERE pending).

## RLS

- **org_invites**: SELECT/INSERT/DELETE only for users where `is_org_admin(org_id)`. No UPDATE; acceptance is done via RPC only.
- **org_members**: Existing policies (members read; owner/admin insert/update/delete; user can leave). API enforces: only owner can change roles; cannot remove owner; admin cannot remove owner or other admins.

## RPCs (SECURITY DEFINER)

- **create_org_invite(p_org_id, p_email, p_role)**  
  Caller must be org member and owner or admin. Generates 32-byte token, stores `sha256(token)` in `token_hash`. Returns `{ invite_id, token }`. Token returned once; invite expires in 7 days.

- **accept_org_invite(p_token, p_user_email)**  
  Caller must be authenticated. Looks up invite by token hash; checks not accepted, not expired, and `invite.email` matches `p_user_email` (API passes session email). Inserts/updates `org_members`, sets `accepted_at`/`accepted_by`, sets `profiles.active_org_id` to the org. Returns `{ ok, org_id }` or `{ ok: false, error }`.

- **get_org_members(p_org_id)**  
  Returns `(user_id, role, email)` for the org; caller must be org member (RLS enforced via `is_org_member` in the function).

## Routes & API

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/orgs/[orgId]/invites | Create invite (body: email, role). Returns invite_link + token. Caller must be owner/admin. |
| GET | /api/orgs/[orgId]/members | List members (user_id, role, email). Caller must be member. |
| PATCH | /api/orgs/[orgId]/members/[userId] | Change role (body: role). Only owner. |
| DELETE | /api/orgs/[orgId]/members/[userId] | Remove member. Owner can remove anyone except self; admin can remove only members. |
| DELETE | /api/orgs/[orgId]/invites/[inviteId] | Revoke pending invite. Owner/admin. |
| POST | /api/orgs/invites/accept | Body: { token }. Accept invite (session email must match invite email). |

## Pages

- **/invite**  
  Query: `token` (required), optional `org`. If no token, show “Invalid invite link”. If not logged in, show “Log in to accept” with link to `/login?next=/invite?token=...`. If logged in, show “Accept invite” button; on success redirect to /app (active org set to invited org).

- **/orgs/[id]/members**  
  List members (email, role), invite form (email + role), pending invites with revoke. Link from /orgs list as “Members”. Only owner/admin see invite form and revoke; only owner can change roles.

## Security

- Raw invite tokens are never stored; only `token_hash` (sha256 of token) is stored.
- Acceptance requires the authenticated user’s email (from session) to match the invite email.
- Org isolation unchanged: items, saved_searches, alerts, notifications, billing remain scoped by org_id (Phase 12B).

## Verification Checklist

- [ ] Create Org A, invite User B by email, accept invite as B → B sees Org A in switcher and Org A items when active.
- [ ] B (member) cannot invite others; B as admin can invite.
- [ ] Admin cannot remove owner or change owner role; admin cannot remove another admin; owner can change roles and remove members.
- [ ] Token cannot be accepted after `expires_at`.
- [ ] User C (different email) cannot accept B’s invite token (email_mismatch).
- [ ] Not logged in: /invite shows “Log in to accept”; after login with correct email, user can accept.
- [ ] pnpm lint and `npx tsc --noEmit` pass.

## Migration note

The `profiles.email` backfill runs `UPDATE ... FROM auth.users` in a `DO` block. If your migration role cannot read `auth.users`, the backfill may fail; in that case run a one-off update with a role that has access, or add a SECURITY DEFINER function that performs the update.
