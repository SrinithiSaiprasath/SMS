-- Prerequisites: report_jobs (from 007) — safe if already applied
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

-- Audit log: every invocation of POST /api/internal/cron/dispatch-reports
CREATE TABLE IF NOT EXISTS public.cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL DEFAULT 'dispatch-reports',
  triggered_by TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'RUNNING'
    CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'UNAUTHORIZED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INT,
  users_eligible INT NOT NULL DEFAULT 0,
  users_processed INT NOT NULL DEFAULT 0,
  users_skipped INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_started_at ON public.cron_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_name ON public.cron_runs (job_name, started_at DESC);

ALTER TABLE public.report_jobs
  ADD COLUMN IF NOT EXISTS cron_run_id UUID REFERENCES public.cron_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_report_jobs_cron_run ON public.report_jobs(cron_run_id)
  WHERE cron_run_id IS NOT NULL;

COMMENT ON TABLE public.cron_runs IS 'One row per cron trigger (GitHub Actions, manual curl, etc.)';
