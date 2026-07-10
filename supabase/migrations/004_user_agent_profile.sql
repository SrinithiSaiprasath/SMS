-- New onboarding fields: income sources + agent assistance preferences
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS income_sources JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS agent_assistance_preferences JSONB NOT NULL DEFAULT '[]';
