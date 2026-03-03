# Phase 8: Alerts + In-App Notifications

## Overview

Phase 8 adds saved-search monitoring (alerts) and in-app notifications. Alerts periodically re-run a saved search and create notifications when new matching items appear.

## Database

- **alerts** — Links to a saved search; schedule (frequency_minutes), enabled, last/next run
- **alert_runs** — Audit log of each run (status, new_match_count, error)
- **alert_item_state** — Tracks which items have already been notified (dedupe)
- **notifications** — In-app notification feed (type, title, body, meta, read)

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/alerts` | GET | List alerts (current user) |
| `/api/alerts` | POST | Create alert |
| `/api/alerts/[id]` | GET, PATCH, DELETE | Single alert CRUD |
| `/api/alerts/[id]/run` | POST | Run alert now (owner only) |
| `/api/alerts/process-due` | POST | Cron: process due alerts (requires `x-cron-secret`) |
| `/api/notifications` | GET | List notifications (supports `?unread=true`, `limit`, `offset`) |
| `/api/notifications` | PATCH | Mark read (`ids` or `all`) |
| `/api/notifications/count` | GET | Unread count (for bell badge) |

## UI

- **/alerts** — List alerts, create/edit via modal, “Run now”
- **/notifications** — Notification feed, mark read
- **Bell icon** — In main Vault header, shows unread count
- **Saved search view** — “Create alert” button

## Setup

1. **Run migration**
   ```bash
   supabase db push
   # or: supabase migration up
   ```

2. **Environment**
   - `CRON_SECRET` — Long random string; required for `/api/alerts/process-due`
   - `SUPABASE_SERVICE_ROLE_KEY` — Already required; used by process-due

3. **Scheduling** (pick one)
   - **Vercel Cron**: Add to `vercel.json`:
     ```json
     { "crons": [{ "path": "/api/alerts/process-due", "schedule": "*/15 * * * *" }] }
     ```
     Vercel sends `x-vercel-cron-secret`; wire it or use `CRON_SECRET` in your route.
   - **GitHub Actions / external cron**: POST every 5–15 min:
     ```bash
     curl -X POST -H "x-cron-secret: $CRON_SECRET" https://your-app.vercel.app/api/alerts/process-due
     ```

## Validation

- [ ] Create alert for a saved search
- [ ] Run alert manually → notification appears only for new matches
- [ ] Run alert again immediately → no duplicate notifications
- [ ] Cron endpoint processes due alerts and advances next_run_at
- [ ] Tenant isolation: user cannot run/edit another user’s alerts
