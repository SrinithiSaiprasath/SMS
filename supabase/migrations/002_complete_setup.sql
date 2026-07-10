-- =============================================================================
-- CosmoSpend — Complete Supabase Setup
-- Run this entire script in: Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONS (pg_cron is optional — skip if it errors on free tier)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Uncomment next line only if your project supports pg_cron (Pro plan):
-- CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------

-- Profile (created after onboarding; links to Supabase Auth user)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 16 AND 100),
  city TEXT NOT NULL,
  living_situation TEXT NOT NULL CHECK (living_situation IN (
    'PG_RENTAL', 'RENTED_APARTMENT', 'OWN_HOME', 'FAMILY_HOME'
  )),
  report_frequency TEXT NOT NULL CHECK (report_frequency IN (
    'WEEKLY', 'BIWEEKLY', 'MONTHLY'
  )),
  income_sources JSONB NOT NULL DEFAULT '[]',
  agent_assistance_preferences JSONB NOT NULL DEFAULT '[]',
  income_lower_inr INTEGER NOT NULL DEFAULT 5000,
  income_upper_inr INTEGER NOT NULL DEFAULT 15000,
  last_report_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial onboarding (before profile exists in public.users)
CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step INTEGER NOT NULL DEFAULT 0,
  collected_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  raw_message TEXT NOT NULL,
  category TEXT CHECK (category IN ('LEAK', 'WORTHY_ESSENTIAL', 'INVESTMENT')),
  is_split BOOLEAN NOT NULL DEFAULT FALSE,
  total_bill NUMERIC(10, 2),
  split_count INTEGER,
  currency TEXT NOT NULL DEFAULT 'INR',
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tagged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_logged_at ON public.transactions(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category);

CREATE TABLE IF NOT EXISTS public.pending_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_bill NUMERIC(10, 2) NOT NULL,
  your_share NUMERIC(10, 2) NOT NULL,
  split_count INTEGER NOT NULL,
  description TEXT NOT NULL,
  raw_message TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  frequency TEXT NOT NULL,
  doc_url TEXT,
  email_sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
  )),
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);

CREATE TABLE IF NOT EXISTS public.report_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leak_percentage NUMERIC(5, 2),
  essential_percentage NUMERIC(5, 2),
  investment_percentage NUMERIC(5, 2),
  total_spend NUMERIC(10, 2),
  behavioral_summary TEXT,
  saving_opportunities JSONB,
  full_report_markdown TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_report ON public.email_deliveries(report_id);

-- PDF storage + scheduled reports (006–008)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-documents', 'user-documents', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_documents_report_id_key UNIQUE (report_id)
);

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auto_reports_enabled BOOLEAN NOT NULL DEFAULT TRUE;

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

ALTER TABLE public.report_jobs
  ADD COLUMN IF NOT EXISTS cron_run_id UUID REFERENCES public.cron_runs(id) ON DELETE SET NULL;

-- Income range constraint (005)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_income_range_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_income_range_check
  CHECK (income_lower_inr >= 500 AND income_upper_inr >= income_lower_inr AND income_upper_inr <= 10000000);

-- -----------------------------------------------------------------------------
-- 2. UPDATED_AT TRIGGER (optional but useful)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS onboarding_sessions_updated_at ON public.onboarding_sessions;
CREATE TRIGGER onboarding_sessions_updated_at
  BEFORE UPDATE ON public.onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running this script
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "onboarding_all_own" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "transactions_all_own" ON public.transactions;
DROP POLICY IF EXISTS "pending_all_own" ON public.pending_confirmations;
DROP POLICY IF EXISTS "reports_all_own" ON public.reports;
DROP POLICY IF EXISTS "insights_all_own" ON public.report_insights;
DROP POLICY IF EXISTS "email_deliveries_select_own" ON public.email_deliveries;
DROP POLICY IF EXISTS "user_documents_select_own" ON public.user_documents;
DROP POLICY IF EXISTS "user_documents_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "users_own" ON public.users;
DROP POLICY IF EXISTS "onboarding_own" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "transactions_own" ON public.transactions;
DROP POLICY IF EXISTS "pending_own" ON public.pending_confirmations;
DROP POLICY IF EXISTS "reports_own" ON public.reports;
DROP POLICY IF EXISTS "insights_own" ON public.report_insights;

-- users: logged-in user can read/update only their row; insert own row on onboarding complete
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- onboarding: tied to auth.users (before public.users row exists)
CREATE POLICY "onboarding_all_own" ON public.onboarding_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- transactions, pending, reports, insights: only after profile exists
CREATE POLICY "transactions_all_own" ON public.transactions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pending_all_own" ON public.pending_confirmations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reports_all_own" ON public.reports
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "insights_all_own" ON public.report_insights
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "email_deliveries_select_own" ON public.email_deliveries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_documents_select_own" ON public.user_documents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_documents_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'user-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- 4. GRANTS (so authenticated JWT can access tables + Realtime)
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_confirmations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_insights TO authenticated;
GRANT SELECT ON public.email_deliveries TO authenticated;
GRANT SELECT ON public.user_documents TO authenticated;

-- anon role: no direct table access (auth signup/login uses auth schema, not these tables)
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.onboarding_sessions FROM anon;
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.pending_confirmations FROM anon;
REVOKE ALL ON public.reports FROM anon;
REVOKE ALL ON public.report_insights FROM anon;

-- -----------------------------------------------------------------------------
-- 5. REALTIME (Reports page listens for new reports)
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;

-- If the line above errors with "already member of publication", ignore it.
-- Alternative via Dashboard: Database → Replication → enable "reports" table

-- -----------------------------------------------------------------------------
-- 6. VERIFY
-- -----------------------------------------------------------------------------
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
