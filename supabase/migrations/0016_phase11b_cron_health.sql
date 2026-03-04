-- Phase 11B: Cron heartbeat / status for alerts process-due

CREATE TABLE public.cron_runs (
  job text PRIMARY KEY,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_ok boolean,
  last_error text,
  last_duration_ms int,
  last_processed_count int,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Service-role only; no policies for anon/authenticated (admin reads via service client)
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
