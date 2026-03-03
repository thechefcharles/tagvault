-- Ship Hardening: RLS for Blocks 6-8 auxiliary tables
-- embedding_queue: internal job queue, service-role only (Edge Function).
-- search_queries: shared embedding cache, authenticated read/write.

-- =============================================================================
-- 1) EMBEDDING_QUEUE: Lock down to service role only
-- =============================================================================
ALTER TABLE public.embedding_queue ENABLE ROW LEVEL SECURITY;

-- No permissive policies = deny all for anon/authenticated.
-- Edge Function uses SUPABASE_SERVICE_ROLE_KEY and bypasses RLS.

-- =============================================================================
-- 2) SEARCH_QUERIES: Allow authenticated cache read/write
-- =============================================================================
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "search_queries_select_authenticated" ON public.search_queries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "search_queries_insert_authenticated" ON public.search_queries
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "search_queries_update_authenticated" ON public.search_queries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
