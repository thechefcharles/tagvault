-- Fix: embedding_queue has RLS (no policies = deny all).
-- The embedding_enqueue_after trigger runs as the invoking user, so its INSERT
-- into embedding_queue fails. Use SECURITY DEFINER so the function runs as the
-- table owner and can insert into embedding_queue.

CREATE OR REPLACE FUNCTION public.embedding_enqueue_after()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.embedding_queue (item_id)
  VALUES (NEW.id)
  ON CONFLICT (item_id) DO UPDATE SET requested_at = now();
  RETURN NEW;
END;
$$;
