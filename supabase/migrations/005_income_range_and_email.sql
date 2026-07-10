-- Income slab + email delivery tracking
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS income_lower_inr INTEGER NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS income_upper_inr INTEGER NOT NULL DEFAULT 15000;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_income_range_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_income_range_check
    CHECK (income_lower_inr >= 500 AND income_upper_inr >= income_lower_inr AND income_upper_inr <= 10000000);

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

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
