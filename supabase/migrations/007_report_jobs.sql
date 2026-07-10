-- Scheduled report job queue + auto-reports toggle
DO $$ BEGIN
  CREATE TYPE report_job_status AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.report_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status report_job_status NOT NULL DEFAULT 'PENDING',
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_jobs_pending ON public.report_jobs (scheduled_for)
  WHERE status = 'PENDING';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auto_reports_enabled BOOLEAN NOT NULL DEFAULT TRUE;
