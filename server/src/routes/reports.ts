import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { createReportForUser, runReportPipeline } from '../agents/pipeline.js';
import { getSignedDownloadUrl } from '../integrations/storage.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const { data: reports, error } = await supabaseAdmin
    .from('reports')
    .select(`
      *,
      report_insights (
        leak_percentage,
        essential_percentage,
        investment_percentage,
        total_spend,
        behavioral_summary
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ reports: reports ?? [] });
});

router.get('/deliveries/recent', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const { data, error } = await supabaseAdmin
    .from('email_deliveries')
    .select('id, report_id, to_email, subject, status, error_message, sent_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ deliveries: data ?? [] });
});

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const reportId = String(req.params.id);

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select(`
      *,
      report_insights (*)
    `)
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!report) return res.status(404).json({ error: 'Report not found' });

  const { data: delivery } = await supabaseAdmin
    .from('email_deliveries')
    .select('status, error_message, sent_at, to_email')
    .eq('report_id', reportId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  res.json({ report, delivery: delivery ?? null });
});

router.get('/:id/pdf', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const reportId = String(req.params.id);

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('pdf_storage_path, status')
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (report.status !== 'COMPLETED' || !report.pdf_storage_path) {
    return res.status(404).json({ error: 'PDF not available for this report' });
  }

  try {
    const url = await getSignedDownloadUrl(report.pdf_storage_path);
    res.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate download link';
    res.status(500).json({ error: message });
  }
});

router.post('/generate', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const { data: processing } = await supabaseAdmin
    .from('reports')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'PROCESSING')
    .maybeSingle();

  if (processing) {
    return res.status(409).json({ error: 'A report is already being generated' });
  }

  try {
    const reportId = await createReportForUser(userId);

    runReportPipeline(userId, reportId).catch((err) =>
      console.error('Background pipeline error:', err)
    );

    res.json({ reportId, status: 'PROCESSING', message: 'Report generation started!' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to start report';
    res.status(500).json({ error: message });
  }
});

router.post('/:id/retry', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const reportId = String(req.params.id);

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('id, status')
    .eq('id', reportId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (report.status !== 'FAILED') {
    return res.status(400).json({ error: 'Only failed reports can be retried' });
  }

  const { data: processing } = await supabaseAdmin
    .from('reports')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'PROCESSING')
    .maybeSingle();

  if (processing) {
    return res.status(409).json({ error: 'A report is already being generated' });
  }

  runReportPipeline(userId, reportId).catch((err) => console.error('Retry pipeline error:', err));
  res.json({ reportId, status: 'PROCESSING', message: 'Retrying report generation...' });
});

export default router;
