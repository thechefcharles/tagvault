# TagVault Database Schema (Baseline)

## Entity Relationships

```
auth.users (Supabase Auth)
    │
    ├── 1:1 ──► profiles (id)
    │
    ├── 1:N ──► organizations (owner_id)
    │
    └── N:M ──► org_members ◄──► organizations
                      │
                      └── vault_items (created_by)
                            │
                            └── belongs to org (org_id)
```

### Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profile data, 1:1 with `auth.users`. Auto-created on signup. |
| `organizations` | Workspace/team. Has an owner (`owner_id`). |
| `org_members` | Membership linking users to orgs. Roles: `owner`, `admin`, `member`. |
| `vault_items` | Core entity. Items belong to an org and have a creator. |

### Triggers

- **on_auth_user_created**: After a new `auth.users` row, inserts a corresponding `profiles` row.
- **on_organization_created**: After a new org, inserts the owner into `org_members` with role `owner`.
- **set_*_updated_at**: Sets `updated_at = now()` on row update for all tables that have it.

---

## Access Control (RLS Summary)

| Table | Select | Insert | Update | Delete |
|-------|--------|--------|--------|--------|
| `profiles` | Own only | (trigger) | Own only | (cascade) |
| `organizations` | Org members | Auth user as `owner_id` | Admin/owner | Owner only |
| `org_members` | Org members | Admin/owner | Admin/owner | Admin/owner or self (leave) |
| `vault_items` | Org members | Org members, `created_by = auth.uid()` | Admin/owner or creator | Admin/owner only |

### Helper Functions

- `is_org_member(org_id)` – user is in the org
- `is_org_admin(org_id)` – user is owner or admin
- `is_org_owner(org_id)` – user is owner

These rely on `auth.uid()` and `org_members`.

---

## Client-Side vs Server-Side

| Context | Safe | Not Safe |
|---------|------|----------|
| **Client** | Anon key, `auth.uid()` via Supabase client, RLS-protected queries | Service role key, raw SQL |
| **Server** | Anon key (RLS enforced) or service role (bypasses RLS) for admin ops | Exposing service role to browser |

All application queries use the **anon key** and are constrained by RLS. The **service role key** is only for server-side admin operations when you need to bypass RLS.

---

## Future Expansions (Not Implemented Yet)

- **pgvector**: Embeddings for semantic search on vault items
- **Full-text search**: `tsvector` / GIN indexes for text search
- **Alerts / notifications**: Tables for reminders or activity
- **Billing / subscriptions**: Stripe or similar

The current schema is designed to support these later without breaking changes.
