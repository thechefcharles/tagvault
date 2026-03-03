# Phase 7: Saved Searches

## Overview

Saved Searches let users store a query plus filters/sort/semantic settings and re-run them instantly as a "view."

## Table Definition

```sql
saved_searches
├── id uuid PK
├── owner_user_id uuid (personal scope)
├── org_id uuid (org scope, TODO)
├── name text NOT NULL
├── query text DEFAULT ''
├── filters jsonb DEFAULT '{}'
├── sort text DEFAULT 'best_match'
├── semantic_enabled boolean DEFAULT true
├── pinned boolean DEFAULT false
├── created_at, updated_at
└── CHECK: exactly one of owner_user_id, org_id set
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/saved-searches` | List current user's saved searches |
| POST | `/api/saved-searches` | Create saved search |
| GET | `/api/saved-searches/[id]` | Fetch one |
| PATCH | `/api/saved-searches/[id]` | Update |
| DELETE | `/api/saved-searches/[id]` | Delete |
| GET | `/api/saved-searches/[id]/run` | Execute search, return items |

## Example Payloads

**Create (POST)**
```json
{
  "name": "React notes",
  "query": "React hooks",
  "filters": {},
  "sort": "best_match",
  "semantic_enabled": true,
  "pinned": false
}
```

**Update (PATCH)**
```json
{
  "name": "React + Next",
  "query": "React Next.js",
  "pinned": true
}
```

**Filters (future-proof)**
```json
{
  "type": ["note", "link"],
  "tags": ["work", "important"],
  "date_from": "2024-01-01",
  "date_to": "2024-12-31"
}
```

Filters are stored and passed through. Type filter is applied when running; other filters can be wired later.

## Extending Filters

1. Update `rpc_search_items_hybrid` (or equivalent) to accept filter params
2. In `/api/saved-searches/[id]/run`, parse `filters` and pass to search
3. Add UI in `SavedSearchModal` for type/tags/date chips instead of raw JSON
