# Phase 15C: Automated Backups (Pro/Team)

## Overview

Phase 15C adds nightly automated backups for Pro and Team orgs. Backups are stored in Supabase Storage; retention applies (Pro: 30 days, Team: 90 days). Users can list, download, and restore from backups in Settings → Data.

## Cron Setup (Vercel)

Add to `vercel.json` (or Vercel Dashboard):

```json
{
  "crons": [
    {
      "path": "/api/backups/process-nightly",
      "schedule": "0 3 * * *"
    }
  ]
}
```

- **Schedule**: `0 3 * * *` = 3:00 AM UTC daily.
- **Auth**: Send `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.

Vercel Cron Jobs automatically send the `CRON_SECRET` when configured in project environment variables.

## Retention Rules

| Plan | Retention |
|------|-----------|
| Free | No backups |
| Pro | 30 days |
| Team | 90 days |

Older backups are deleted when the cron runs (both storage object and `org_backups` row).

## Restore Behavior

- **Merge**: Same as manual import merge — adds/updates data without deleting existing.
- **Replace**: Same as manual import replace — deletes all org data first, then imports. **Owner-only.**

## Database

- **org_backups**: `id`, `org_id`, `created_at`, `storage_path`, `size_bytes`, `sha256`, `status`, `error_message`
- **Storage bucket**: `org-backups` (private). Path: `backups/<org_id>/<YYYY-MM-DD>/<backup_id>.json`

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/backups | requireActiveOrg | List backups for active org |
| GET | /api/backups/[id]/download | requireActiveOrg | Redirect to signed download URL |
| POST | /api/backups/[id]/restore | requireActiveOrg | Restore; body `{ mode: "merge" \| "replace" }` |
| POST | /api/backups/process-nightly | CRON_SECRET | Cron: create backups + retention cleanup |

## Manual Test Checklist

1. **Pro org backup**
   - As Pro org: `POST /api/backups/process-nightly` with `x-cron-secret: <CRON_SECRET>`
   - Check Settings → Data → Backups: backup appears with date, size, status OK.

2. **Free org**
   - Free org: run cron. No backups created for free orgs.

3. **Retention**
   - Create backups for multiple dates (or mock `created_at`).
   - Run cron; verify backups older than retention are removed.

4. **Restore merge**
   - Restore from a backup with Merge. Verify no duplicates; data merged correctly.

5. **Restore replace (owner)**
   - As owner: Restore Replace. Confirm modal; verify existing data cleared and backup data applied.

6. **Restore replace (non-owner)**
   - As member (not owner): Replace button should not appear or should return 403 if called via API.
