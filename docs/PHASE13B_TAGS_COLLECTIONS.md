# Phase 13B: Tags + Collections (org-scoped)

## Purpose

MVP information architecture: tags for categorizing items, collections as named lists. Both are org-scoped. Tags and collections integrate with search, saved searches, and item cards.

## Schema (0025_phase13b_tags_collections.sql)

- **tags**: id, org_id, name, slug, created_at. UNIQUE (org_id, slug). RLS: is_org_member.
- **item_tags**: org_id, item_id, tag_id, created_at. PK (item_id, tag_id). CASCADE on item/tag delete. RLS: is_org_member.
- **collections**: id, org_id, name, created_at. UNIQUE (org_id, name). RLS: is_org_member.
- **collection_items**: org_id, collection_id, item_id, created_at. PK (collection_id, item_id). CASCADE. RLS: is_org_member.

Indexes on org_id, item_id, tag_id, collection_id.

## Search RPC

`rpc_search_items_hybrid` extended with `p_tag_ids uuid[]`. When provided, filters items to those having ANY of the tag_ids (via EXISTS on item_tags).

## Limits (entitlements)

| Plan   | tags | collections |
|--------|------|-------------|
| free   | 20   | 3           |
| pro    | 200  | 50          |
| team   | 500  | 200         |

Enforced at create (POST tags, POST collections). Returns 402 with upgrade CTA.

## API Endpoints

| Method | Route                           | Description                        |
|--------|---------------------------------|------------------------------------|
| GET    | /api/tags                       | List tags for active org           |
| POST   | /api/tags                       | Create tag (rate limit 30/min)     |
| PATCH  | /api/tags/[id]                  | Rename tag                         |
| DELETE | /api/tags/[id]                  | Delete tag                         |
| GET    | /api/items/[id]/tags            | List tags on item                  |
| POST   | /api/items/[id]/tags            | Set tags (body: { tag_ids: [...] })|
| DELETE | /api/items/[id]/tags            | Remove tag (body: { tag_id })      |
| GET    | /api/collections                | List collections                   |
| POST   | /api/collections                | Create collection (402 on limit)   |
| PATCH  | /api/collections/[id]           | Rename collection                  |
| DELETE | /api/collections/[id]           | Delete collection                  |
| GET    | /api/collections/[id]/items     | List items in collection           |
| POST   | /api/collections/[id]/items     | Add item (body: { item_id })       |
| DELETE | /api/collections/[id]/items     | Remove item (body: { item_id })    |

Search and list items support `tag_ids` query param (comma-separated). Saved searches filters may include `tag_ids: string[]`.

## UI

- **Vault (/app)**: Tag chips on item cards; click to filter. Tag filter in URL `?tag_ids=uuid`.
- **Item detail**: Tag chips + Manage tags (add/remove). Add to collection dropdown.
- **/tags**: List, create, rename, delete tags.
- **/collections**: List, create collections.
- **/collections/[id]**: Items in collection, remove item.
- **Search (/search)**: Tag filter chips; "Save this search" includes tag_ids in filters. Run + alerts respect tag filter.

## Manual test checklist

- [ ] Two users, two orgs: tags and collections are isolated (user A cannot see user B’s tags/collections).
- [ ] Free plan: create 20 tags → 21st returns 402. Create 3 collections → 4th returns 402.
- [ ] Assign tags to items; filter vault by tag; filter search by tag.
- [ ] Saved search with tag filter; run returns items with that tag; alert respects tag filter.
- [ ] Collection: add item from detail page; collection page shows item; remove item.
- [ ] pnpm lint and pnpm typecheck pass.
