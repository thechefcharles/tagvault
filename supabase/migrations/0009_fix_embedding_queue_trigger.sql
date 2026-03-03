-- Fix: embedding_queue insert ran in BEFORE INSERT trigger, causing FK violation
-- because the item row didn't exist yet. Split into:
-- - BEFORE: set needs_embedding
-- - AFTER: enqueue (item exists by then)

CREATE OR REPLACE FUNCTION public.embedding_set_needs_flag()
RETURNS TRIGGER AS $$
BEGIN
  NEW.needs_embedding := true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.embedding_enqueue_after()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.embedding_queue (item_id)
  VALUES (NEW.id)
  ON CONFLICT (item_id) DO UPDATE SET requested_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_embedding_enqueue ON public.items;
DROP TRIGGER IF EXISTS items_embedding_set_needs ON public.items;

CREATE TRIGGER items_embedding_set_needs
  BEFORE INSERT OR UPDATE OF title, description
  ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.embedding_set_needs_flag();

CREATE TRIGGER items_embedding_enqueue
  AFTER INSERT OR UPDATE OF title, description
  ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.embedding_enqueue_after();
