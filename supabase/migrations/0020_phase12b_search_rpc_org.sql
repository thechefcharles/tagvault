-- Phase 12B: Scope hybrid search RPC by org_id

CREATE OR REPLACE FUNCTION public.rpc_search_items_hybrid(
  p_query text,
  p_owner uuid,
  p_org_id uuid,
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
  IF p_org_id IS NULL THEN
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
    WHERE i.org_id = p_org_id
      AND (p_type IS NULL OR p_type = '' OR i.type = p_type)
    ORDER BY
      CASE WHEN p_sort = 'priority' THEN i.priority END ASC NULLS LAST,
      i.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
    RETURN;
  END IF;

  BEGIN
    v_tsquery := websearch_to_tsquery('english', v_q_trim);
  EXCEPTION WHEN OTHERS THEN
    v_tsquery := plainto_tsquery('english', v_q_trim);
  END;

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
      WHERE i.org_id = p_org_id
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

  RETURN QUERY
  SELECT
    i.id, i.user_id, i.type, i.title, i.description, i.priority,
    i.url, i.storage_path, i.mime_type, i.created_at, i.updated_at,
    ts_rank_cd(i.search_tsv, v_tsquery)::real AS score
  FROM public.items i
  WHERE i.org_id = p_org_id
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
