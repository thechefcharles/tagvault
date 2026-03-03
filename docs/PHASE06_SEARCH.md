# Phase 6: Indexing + Hybrid Search

## Overview

Phase 6 adds:
- **Embeddings** for semantic search (OpenAI `text-embedding-3-small`)
- **Hybrid ranking**: 65% FTS + 35% semantic
- **Background indexing** via Edge Function
- **Search UI** at `/search`

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Items CRUD  │────▶│ embedding_   │────▶│ index-embeddings│
│ (insert/    │     │ queue        │     │ Edge Function   │
│  update)    │     └──────────────┘     └────────┬────────┘
└─────────────┘                                    │
                                                   ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ /search API │────▶│ rpc_search_  │◀────│ items.embedding │
│ (Next.js)   │     │ items_hybrid │     │ (pgvector)      │
└─────────────┘     └──────────────┘     └─────────────────┘
```

## 1. Run Migration

In Supabase SQL Editor:

1. Open `supabase/migrations/0005_phase06_search.sql`
2. Copy contents
3. New query → paste → Run

## 2. Deploy Edge Function

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Project linked: `supabase link --project-ref YOUR_PROJECT_ID`

### Deploy

```bash
supabase functions deploy index-embeddings
```

### Set Secrets

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set OPENAI_EMBEDDINGS_MODEL=text-embedding-3-small
supabase secrets set BATCH_SIZE=25  # optional, default 25
```

Or in Dashboard: **Project Settings → Edge Functions → Secrets**

## 3. Schedule the Indexer

The Edge Function must be invoked every ~5 minutes to process the queue.

### Option A: Supabase Cron (pg_cron)

If pg_cron is enabled, add a scheduled job:

```sql
SELECT cron.schedule(
  'index-embeddings',
  '*/5 * * * *',  -- every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/index-embeddings',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### Option B: External Cron (Vercel Cron, GitHub Actions, etc.)

Hit the function URL on a schedule:

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/index-embeddings' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Option C: Manual Trigger

For development, invoke manually:

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/index-embeddings' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## 4. Environment Variables

### Supabase (Edge Function secrets)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `OPENAI_EMBEDDINGS_MODEL` | No | Default: `text-embedding-3-small` |
| `BATCH_SIZE` | No | Default: 25 |

### Vercel / Next.js

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | For hybrid search | Query embedding generation |
| `OPENAI_EMBEDDINGS_MODEL` | No | Same as above |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | (existing) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | (existing) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | (existing, for server) |

## 5. IVFFlat Index (Optional)

After you have 100+ rows with embeddings, create the index for faster semantic search:

```sql
CREATE INDEX CONCURRENTLY items_embedding_ivfflat
ON public.items USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

Tune `lists` as table grows: `lists ≈ rows / 1000` up to ~1M rows.

## 6. Validation Checklist

- [ ] Migration runs without errors
- [ ] Insert/update item → row appears in `embedding_queue`
- [ ] Invoke Edge Function → queue processed, `items.embedding` set
- [ ] `/search?q=...` returns ranked results
- [ ] Semantic boost toggle changes results
- [ ] User A cannot see User B's items (tenant isolation)
