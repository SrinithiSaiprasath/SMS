-- Supabase Storage for persisted report PDFs
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_documents_user ON public.user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_report ON public.user_documents(report_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_documents_report_unique
  ON public.user_documents(report_id) WHERE report_id IS NOT NULL;

ALTER TABLE public.user_documents
  DROP CONSTRAINT IF EXISTS user_documents_report_id_key;
ALTER TABLE public.user_documents
  ADD CONSTRAINT user_documents_report_id_key UNIQUE (report_id);

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_documents_select_own" ON public.user_documents;
CREATE POLICY "user_documents_select_own" ON public.user_documents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.user_documents TO authenticated;

-- Storage RLS: users can read own folder
DROP POLICY IF EXISTS "user_documents_storage_select" ON storage.objects;
CREATE POLICY "user_documents_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'user-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
