-- Fix: Add missing INSERT policies for notifications, alert_item_state, alert_runs
-- Without these, Run Now and process-due could not create notifications

-- Allow users to insert alert_runs for alerts they own
CREATE POLICY "alert_runs_insert_via_alert" ON public.alert_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.alerts
      WHERE alerts.id = alert_runs.alert_id AND alerts.owner_user_id = auth.uid()
    )
  );

-- Allow users to receive notifications (inserted by API on their behalf)
CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

-- Allow users to insert alert_item_state for alerts they own (when running an alert)
CREATE POLICY "alert_item_state_insert_via_alert" ON public.alert_item_state
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.alerts
      WHERE alerts.id = alert_item_state.alert_id AND alerts.owner_user_id = auth.uid()
    )
  );
