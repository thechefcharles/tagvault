-- Phase 13B: Tags + Collections (org-scoped MVP)

-- =============================================================================
-- 1) TAGS
-- =============================================================================
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE INDEX idx_tags_org_id ON public.tags(org_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_org_member" ON public.tags
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "tags_insert_org_member" ON public.tags
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "tags_update_org_member" ON public.tags
  FOR UPDATE USING (public.is_org_member(org_id));

CREATE POLICY "tags_delete_org_member" ON public.tags
  FOR DELETE USING (public.is_org_member(org_id));

-- =============================================================================
-- 2) ITEM_TAGS (many-to-many)
-- =============================================================================
CREATE TABLE public.item_tags (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, tag_id)
);

CREATE INDEX idx_item_tags_org_id ON public.item_tags(org_id);
CREATE INDEX idx_item_tags_item_id ON public.item_tags(item_id);
CREATE INDEX idx_item_tags_tag_id ON public.item_tags(tag_id);

ALTER TABLE public.item_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_tags_select_org_member" ON public.item_tags
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "item_tags_insert_org_member" ON public.item_tags
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "item_tags_delete_org_member" ON public.item_tags
  FOR DELETE USING (public.is_org_member(org_id));

-- =============================================================================
-- 3) COLLECTIONS
-- =============================================================================
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX idx_collections_org_id ON public.collections(org_id);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collections_select_org_member" ON public.collections
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "collections_insert_org_member" ON public.collections
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "collections_update_org_member" ON public.collections
  FOR UPDATE USING (public.is_org_member(org_id));

CREATE POLICY "collections_delete_org_member" ON public.collections
  FOR DELETE USING (public.is_org_member(org_id));

-- =============================================================================
-- 4) COLLECTION_ITEMS
-- =============================================================================
CREATE TABLE public.collection_items (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, item_id)
);

CREATE INDEX idx_collection_items_org_id ON public.collection_items(org_id);
CREATE INDEX idx_collection_items_collection_id ON public.collection_items(collection_id);
CREATE INDEX idx_collection_items_item_id ON public.collection_items(item_id);

ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collection_items_select_org_member" ON public.collection_items
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "collection_items_insert_org_member" ON public.collection_items
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "collection_items_delete_org_member" ON public.collection_items
  FOR DELETE USING (public.is_org_member(org_id));

-- =============================================================================
-- 5) Search RPC: add p_tag_ids filter (ANY match)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rpc_search_items_hybrid(
  p_query text,
  p_owner uuid,
  p_org_id uuid,
  p_query_embedding vector(1536),
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_use_semantic boolean DEFAULT true,
  p_type text DEFAULT NULL,
  p_sort text DEFAULT 'best_match',
  p_tag_ids uuid[] DEFAULT NULL
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
  v_tag_filter boolean;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN;
  END IF;

  v_tag_filter := p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0;
  v_q_trim := trim(coalesce(p_query, ''));

  -- Empty query: return recent items (fallback)
  IF v_q_trim = '' THEN
    IF v_tag_filter THEN
      RETURN QUERY
      SELECT
        i.id, i.user_id, i.type, i.title, i.description, i.priority,
        i.url, i.storage_path, i.mime_type, i.created_at, i.updated_at,
        NULL::real AS score
      FROM public.items i
      WHERE i.org_id = p_org_id
        AND (p_type IS NULL OR p_type = '' OR i.type = p_type)
        AND EXISTS (
          SELECT 1 FROM public.item_tags it
          WHERE it.item_id = i.id AND it.tag_id = ANY(p_tag_ids)
        )
      ORDER BY i.created_at DESC
      LIMIT p_limit
      OFFSET p_offset;
    ELSE
      RETURN QUERY
      SELECT
        i.id, i.user_id, i.type, i.title, i.description, i.priority,
        i.url, i.storage_path, i.mime_type, i.created_at, i.updated_at,
        NULL::real AS score
      FROM public.items i
      WHERE i.org_id = p_org_id
        AND (p_type IS NULL OR p_type = '' OR i.type = p_type)
      ORDER BY i.created_at DESC
      LIMIT p_limit
      OFFSET p_offset;
    END IF;
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
        AND (NOT v_tag_filter OR EXISTS (
          SELECT 1 FROM public.item_tags it
          WHERE it.item_id = i.id AND it.tag_id = ANY(p_tag_ids)
        ))
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
    AND (NOT v_tag_filter OR EXISTS (
      SELECT 1 FROM public.item_tags it
      WHERE it.item_id = i.id AND it.tag_id = ANY(p_tag_ids)
    ))
    AND i.search_tsv @@ v_tsquery
  ORDER BY
    CASE WHEN p_sort = 'priority' THEN i.priority END ASC NULLS LAST,
    CASE WHEN p_sort IN ('best_match', 'recent') THEN ts_rank_cd(i.search_tsv, v_tsquery) END DESC NULLS LAST,
    i.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
