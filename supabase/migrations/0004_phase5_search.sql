-- Phase 5: FTS + Trigram search
-- Migration: 0004

-- =============================================================================
-- 1) EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- 2) SEARCH COLUMN + INDEXES
-- Title = weight A (higher), description = weight B
-- =============================================================================
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS search_tsv tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B')
) STORED;

CREATE INDEX IF NOT EXISTS items_search_tsv_gin ON public.items USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS items_title_trgm ON public.items USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS items_description_trgm ON public.items USING gin (description gin_trgm_ops);

-- =============================================================================
-- 3) SEARCH FUNCTION
-- p_q: search query (empty = normal list)
-- p_type: 'link'|'file'|'note'|null (all)
-- p_sort: 'best_match'|'priority'|'recent'
-- =============================================================================
CREATE OR REPLACE FUNCTION public.search_items(
  p_q text,
  p_type text,
  p_sort text,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
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
  relevance real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_query tsquery;
  v_q_trim text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_q_trim := trim(coalesce(p_q, ''));

  -- Empty query: normal list (delegate to simple select)
  IF v_q_trim = '' THEN
    RETURN QUERY
    SELECT
      i.id, i.user_id, i.type, i.title, i.description, i.priority,
      i.url, i.storage_path, i.mime_type, i.created_at, i.updated_at,
      NULL::real AS relevance
    FROM public.items i
    WHERE i.user_id = v_uid
      AND (p_type IS NULL OR p_type = '' OR i.type = p_type)
    ORDER BY
      CASE WHEN p_sort = 'priority' THEN i.priority END ASC NULLS LAST,
      i.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
    RETURN;
  END IF;

  -- Build tsquery (websearch style: handles phrases and AND)
  BEGIN
    v_query := websearch_to_tsquery('english', v_q_trim);
  EXCEPTION WHEN OTHERS THEN
    v_query := plainto_tsquery('english', v_q_trim);
  END;

  -- FTS first
  RETURN QUERY
  WITH fts_results AS (
    SELECT
      i.id, i.user_id, i.type, i.title, i.description, i.priority,
      i.url, i.storage_path, i.mime_type, i.created_at, i.updated_at,
      ts_rank_cd(i.search_tsv, v_query)::real AS rel
    FROM public.items i
    WHERE i.user_id = v_uid
      AND (p_type IS NULL OR p_type = '' OR i.type = p_type)
      AND i.search_tsv @@ v_query
  )
  SELECT
    r.id, r.user_id, r.type, r.title, r.description, r.priority,
    r.url, r.storage_path, r.mime_type, r.created_at, r.updated_at,
    r.rel AS relevance
  FROM fts_results r
  ORDER BY
    CASE WHEN p_sort = 'best_match' THEN r.rel END DESC NULLS LAST,
    CASE WHEN p_sort = 'priority' THEN r.priority END ASC NULLS LAST,
    r.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;

  -- If FTS returned rows, we're done
  IF FOUND THEN
    RETURN;
  END IF;

  -- Trigram fallback
  RETURN QUERY
  SELECT
    i.id, i.user_id, i.type, i.title, i.description, i.priority,
    i.url, i.storage_path, i.mime_type, i.created_at, i.updated_at,
    (
      greatest(
        similarity(coalesce(i.title, ''), v_q_trim),
        similarity(coalesce(i.description, ''), v_q_trim),
        word_similarity(v_q_trim, coalesce(i.title, '')),
        word_similarity(v_q_trim, coalesce(i.description, ''))
      )
    )::real AS relevance
  FROM public.items i
  WHERE i.user_id = v_uid
    AND (p_type IS NULL OR p_type = '' OR i.type = p_type)
    AND (
      coalesce(i.title, '') % v_q_trim
      OR coalesce(i.description, '') % v_q_trim
      OR word_similarity(v_q_trim, coalesce(i.title, '')) > 0.1
      OR word_similarity(v_q_trim, coalesce(i.description, '')) > 0.1
    )
  ORDER BY
    CASE WHEN p_sort = 'best_match' THEN (
      greatest(
        similarity(coalesce(i.title, ''), v_q_trim),
        similarity(coalesce(i.description, ''), v_q_trim),
        word_similarity(v_q_trim, coalesce(i.title, '')),
        word_similarity(v_q_trim, coalesce(i.description, ''))
      )
    ) END DESC NULLS LAST,
    CASE WHEN p_sort = 'priority' THEN i.priority END ASC NULLS LAST,
    i.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
