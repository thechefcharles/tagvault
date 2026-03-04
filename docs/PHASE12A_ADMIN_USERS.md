# Phase 12A: Admin Users Console

## Purpose

Internal ops tooling for viewing and managing users: list users with key fields, view user details, resync billing from Stripe, and override plan in emergencies. All actions are admin-only (ADMIN_EMAILS) and plan overrides are logged to `admin_audit_log`.

## Routes & Pages

| Route | Type | Description |
|-------|------|-------------|
| `/admin` | Page | Admin index; links to Billing and Users |
| `/admin/users` | Page | Users list (server component) |
| `/admin/users/[id]` | Page | User detail (read-only panels + ops buttons) |
| `POST /api/admin/users/[id]/resync-billing` | API | Resync billing_accounts from Stripe for one user |
| `POST /api/admin/users/[id]/set-plan` | API | Ops override: set plan (free \| pro); logs to admin_audit_log |

## DB Changes

- **Migration 0017** (`supabase/migrations/0017_admin_audit_log.sql`):
  - Creates `admin_audit_log` table:
    - `id` uuid PRIMARY KEY
    - `admin_email` text NOT NULL
    - `action` text NOT NULL
    - `target_user_id` uuid REFERENCES auth.users(id) ON DELETE SET NULL
    - `metadata` jsonb DEFAULT '{}'
    - `created_at` timestamptz DEFAULT now()
  - RLS enabled; no policies (service-role only via admin client)

## Security Notes

- **ADMIN_EMAILS**: Comma-separated env var; only these emails can access `/admin/*` and admin API routes.
- **Middleware**: `/admin` paths require authentication; admin gating is done in each page/route via `requireAdmin()` or `requireAdminWithEmail()`.
- **Audit log**: `set-plan` writes `admin_email`, `action`, `target_user_id`, `metadata` (plan, status) for traceability.

## Verification Checklist

- [ ] Non-admin gets 404/redirect on `/admin/users` (redirect to `/login` if unauthenticated; 403/redirect if authenticated but not admin)
- [ ] Admin sees users list populated with user_id, email, plan, status, counts, etc.
- [ ] Resync billing works for a known Pro user (Stripe customer exists)
- [ ] Plan override writes to `admin_audit_log` (check `SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 5`)
- [ ] `pnpm lint` and `pnpm typecheck` pass
