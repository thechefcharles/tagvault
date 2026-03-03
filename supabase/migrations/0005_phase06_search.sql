-- Phase 6: Indexing + Hybrid Search (FTS + Embeddings)
-- Migration: 0005
-- Prerequisites: items table, search_tsv column (Phase 4/5)

-- =============================================================================
-- 1) EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 2) ITEMS: EMBEDDING COLUMNS
-- =============================================================================
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz,
ADD COLUMN IF NOT EXISTS needs_embedding boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS embedding_error text,
ADD COLUMN IF NOT EXISTS embedding_error_at timestamptz;

-- IVFFlat index: create after table has rows (e.g. 100+). Run manually if migration fails:
-- CREATE INDEX items_embedding_ivfflat ON items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- 3) EMBEDDING QUEUE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.embedding_queue (
  id bigserial PRIMARY KEY,
  item_id uuid UNIQUE NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  attempt_count int NOT NULL DEFAULT 0,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS embedding_queue_pending
ON public.embedding_queue (requested_at)
WHERE processed_at IS NULL AND locked_at IS NULL;

-- =============================================================================
-- 4) TRIGGERS: ENQUEUE ON INSERT/UPDATE
-- =============================================================================
CREATE OR REPLACE FUNCTION public.embedding_enqueue_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.needs_embedding := true;
  INSERT INTO public.embedding_queue (item_id)
  VALUES (NEW.id)
  ON CONFLICT (item_id) DO UPDATE SET requested_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_embedding_enqueue ON public.items;
CREATE TRIGGER items_embedding_enqueue
  BEFORE INSERT OR UPDATE OF title, description
  ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.embedding_enqueue_trigger();

-- Backfill queue for existing items
INSERT INTO public.embedding_queue (item_id)
SELECT id FROM public.items
ON CONFLICT (item_id) DO NOTHING;

-- =============================================================================
-- 5) QUERY EMBEDDING CACHE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.search_queries (
  query text PRIMARY KEY,
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 6) HYBRID SEARCH RPC
-- p_query_embedding: pass from API; null = FTS only
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_search_items_hybrid(
  p_query text,
  p_owner uuid,
  p_query_embedding vector(1536),
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_use_semantic boolean DEFAULT true,
  p_type text DEFAULT NULL,
  p_sort text DEFAULT 'best_match'
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  type text,
  title text,
  description text,
  priority int,
  url text,
  storage_path text,
  mime_type text,
  created_at timestamptz,
  updated_at timestamptz,
  score real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tsquery tsquery;
  v_q_trim text;
BEGIN
  IF p_owner IS NULL THEN
    RETURN;
  END IF;

  v_q_trim := trim(coalesce(p_query, ''));

  -- Empty query: return recent items (fallback)
  IF v_q_trim = '' THEN
    RETURN QUERY
    SELECT
      i.id, i.user_id, i.type, i.title, i.description, i.priority,
      i.url, i.storage_path, i.mime_type, i.created_at, i.updated_at,
      NULL::real AS score
    FROM public.items i
    WHERE i.user_id = p_owner
      AND (p_type IS NULL OR p_type = '' OR i.type = p_type)
    ORDER BY
      CASE WHEN p_sort = 'priority' THEN i.priority END ASC NULLS LAST,
      i.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
    RETURN;
  END IF;

  -- Build tsquery
  BEGIN
    v_tsquery := websearch_to_tsquery('english', v_q_trim);
  EXCEPTION WHEN OTHERS THEN
    v_tsquery := plainto_tsquery('english', v_q_trim);
  END;

  -- Hybrid: FTS + semantic
  IF p_use_semantic AND p_query_embedding IS NOT NULL THEN
    RETURN QUERY
    WITH scored AS (
      SELECT
        i.id, i.user_id, i.type, i.title, i.description, i.priority,
        i.url, i.storage_path, i.mime_type, i.created_at, i.updated_at,
        (
          0.65 * coalesce(ts_rank_cd(i.search_tsv, v_tsquery), 0)::real +
          0.35 * CASE WHEN i.embedding IS NOT NULL
            THEN (1 - (i.embedding <=> p_query_embedding))::real
            ELSE 0
          END
        ) AS sc
      FROM public.items i
      WHERE i.user_id = p_owner
        AND (p_type IS NULL OR p_type = '' OR i.type = p_type)
        AND (
          i.search_tsv @@ v_tsquery
          OR (i.embedding IS NOT NULL AND (1 - (i.embedding <=> p_query_embedding)) > 0.3)
        )
    )
    SELECT s.id, s.user_id, s.type, s.title, s.description, s.priority,
      s.url, s.storage_path, s.mime_type, s.created_at, s.updated_at,
      s.sc AS score
    FROM scored s
    WHERE s.sc > 0
    ORDER BY
      CASE WHEN p_sort = 'priority' THEN s.priority END ASC NULLS LAST,
      CASE WHEN p_sort IN ('best_match', 'recent') THEN s.sc END DESC NULLS LAST,
      s.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
    RETURN;
  END IF;

  -- FTS only (no semantic)
  RETURN QUERY
  SELECT
    i.id, i.user_id, i.type, i.title, i.description, i.priority,
    i.url, i.storage_path, i.mime_type, i.created_at, i.updated_at,
    ts_rank_cd(i.search_tsv, v_tsquery)::real AS score
  FROM public.items i
  WHERE i.user_id = p_owner
    AND (p_type IS NULL OR p_type = '' OR i.type = p_type)
    AND i.search_tsv @@ v_tsquery
  ORDER BY
    CASE WHEN p_sort = 'priority' THEN i.priority END ASC NULLS LAST,
    CASE WHEN p_sort IN ('best_match', 'recent') THEN ts_rank_cd(i.search_tsv, v_tsquery) END DESC NULLS LAST,
    i.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
