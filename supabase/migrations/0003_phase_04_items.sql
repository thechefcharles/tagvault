-- Phase 4: Items CRUD + Storage
-- Migration: 0003

-- =============================================================================
-- 1) ITEMS TABLE
-- =============================================================================
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('link', 'file', 'note')),
  title text,
  description text NOT NULL,
  priority int CHECK (priority >= 1 AND priority <= 20),
  url text,
  storage_path text,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_user_id ON public.items(user_id);
CREATE INDEX idx_items_user_type ON public.items(user_id, type);
CREATE INDEX idx_items_created_at ON public.items(user_id, created_at DESC);

CREATE TRIGGER set_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2) RLS
-- =============================================================================
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_own" ON public.items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "items_insert_own" ON public.items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "items_update_own" ON public.items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "items_delete_own" ON public.items
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- 3) STORAGE BUCKET (vault, private, 50MB limit)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('vault', 'vault', false, 52428800)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- Storage policies: user-scoped path <user_id>/...
CREATE POLICY "vault_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vault' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "vault_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'vault' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "vault_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vault' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
