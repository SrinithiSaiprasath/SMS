-- Launch readiness: failed report errors, email delivery RLS, legacy skill remap

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_deliveries_select_own" ON public.email_deliveries;
CREATE POLICY "email_deliveries_select_own" ON public.email_deliveries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.email_deliveries TO authenticated;

-- Remap legacy skill id to current id
UPDATE public.users
SET agent_assistance_preferences = (
  SELECT COALESCE(jsonb_agg(
    to_jsonb(CASE WHEN value = 'MISSION_DOCS' THEN 'EMAIL_MISSION_REPORTS' ELSE value END)
  ), '[]'::jsonb)
  FROM jsonb_array_elements_text(agent_assistance_preferences) AS value
)
WHERE agent_assistance_preferences::text LIKE '%MISSION_DOCS%';
