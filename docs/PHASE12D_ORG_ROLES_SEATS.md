# Phase 12D: Org Roles/Permissions Hardening + Seat Enforcement

## Purpose

Centralize org permission checks, add seat limits (free: 1, pro: 1), enforce seat limits before invite/create and accept, and implement role/ownership safety (owner-only role changes, transfer ownership, leave org).

## Schema / Migration

- **0022_phase12d_org_roles_seats.sql**
  - Index `idx_org_members_org_id_count` for membership counts.
  - RPC `get_invite_org_if_pending(p_token)` — returns org_id for valid pending invite (for seat check before accept).
  - RPC `transfer_org_ownership(p_org_id, p_new_owner_user_id)` — owner-only; demotes caller to admin, promotes target to owner; updates `organizations.owner_id`.

## Entitlements

- **seat_limit**: Added to `getOrgEntitlements`. Free: 1, Pro: 1 (prep for Team tiers).
- **assertSeatAvailable(orgId)**: Throws `SeatLimitExceededError` if `membersCount + pendingInvitesCount + 1 > seatLimit`.
- Seat enforcement: before POST invite, before accept invite. Returns 402 `PLAN_LIMIT_EXCEEDED` with upgrade CTA.

## Org Auth (`src/lib/server/orgAuth.ts`)

- `requireActiveOrg()` — re-exported from auth.
- `getOrgMembership(orgId)` — returns `{ role, user_id, org_id }` or null.
- `requireOrgMember(orgId)` — throws if not a member.
- `requireOrgRole(orgId, roles)` — throws if role not in list.
- `requireOrgOwner(orgId)` — throws if not owner.

## Org Seats (`src/lib/server/orgSeats.ts`)

- `getOrgSeatUsage(orgId)` — `{ membersCount, pendingInvitesCount, seatLimit, overLimit }`.
- `assertSeatAvailable(orgId)` — throws `SeatLimitExceededError` if over limit.
- `SeatLimitExceededError` — for 402 responses.

## API

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/orgs/[orgId]/invites | Seat check before create; 402 if over limit. Uses requireOrgRole. |
| POST | /api/orgs/invites/accept | Seat check (via get_invite_org_if_pending) before accept; 402 if over limit. |
| GET | /api/orgs/[orgId]/members | List members. Uses requireUser. |
| PATCH | /api/orgs/[orgId]/members/[userId] | Change role (admin/member only). Owner-only. Uses requireOrgOwner. |
| DELETE | /api/orgs/[orgId]/members/[userId] | Remove member. Owner can remove non-owner; admin can remove only members. Uses requireOrgRole. |
| POST | /api/orgs/[orgId]/transfer-ownership | Owner-only. Body: { new_owner_user_id }. Uses requireOrgOwner. |
| DELETE | /api/orgs/[orgId]/leave | Self-leave. Owner cannot leave without transfer. Uses requireOrgMember. |
| DELETE | /api/orgs/[orgId]/invites/[inviteId] | Revoke invite. Uses requireOrgRole(owner, admin). |

## UI

- **/orgs/[id]/members**: Seat usage display ("Seats: X / seatLimit (pending: Y)"). Over-limit banner with Upgrade CTA. Transfer ownership (owner-only). Leave org (non-owner). Invite form shows 402 upgrade link.
- **/invite**: Accept error shows upgrade message and link on 402.

## Verification Checklist

- [ ] Free org cannot invite/accept beyond 1 seat (402 + upgrade CTA).
- [ ] Owner can promote/demote admins/members; admin can remove members but not owner; members cannot manage others.
- [ ] Owner cannot leave without transfer; transfer-ownership works; previous owner becomes admin.
- [ ] RLS isolation holds across two users and two orgs.
- [ ] pnpm lint and pnpm typecheck pass.
