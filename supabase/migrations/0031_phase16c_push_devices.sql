-- Phase 16C: Push devices table for OneSignal player registration

CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('onesignal')),
  player_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, player_id)
);

CREATE INDEX IF NOT EXISTS idx_push_devices_org_user
  ON public.push_devices(org_id, user_id);

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_devices_select_org_member" ON public.push_devices
  FOR SELECT USING (public.is_org_member(org_id));

CREATE POLICY "push_devices_insert_org_member" ON public.push_devices
  FOR INSERT WITH CHECK (
    public.is_org_member(org_id) AND user_id = auth.uid()
  );

CREATE POLICY "push_devices_update_org_member" ON public.push_devices
  FOR UPDATE USING (
    public.is_org_member(org_id) AND user_id = auth.uid()
  );

CREATE POLICY "push_devices_delete_org_member" ON public.push_devices
  FOR DELETE USING (
    public.is_org_member(org_id) AND user_id = auth.uid()
  );
