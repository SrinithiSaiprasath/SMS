import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import {
  normalizeAssistancePreferences,
  normalizeIncomeSources,
  normalizeIncomeRange,
} from '../lib/profileFields.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { estimateNextReportAt } from '../jobs/reportScheduler.js';
import type { ReportFrequency } from '../types/index.js';

const router = Router();

const LIVING_OPTIONS = ['PG_RENTAL', 'RENTED_APARTMENT', 'OWN_HOME', 'FAMILY_HOME'];
const FREQ_OPTIONS = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'];

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', userId).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Profile not found' });

  const nextReportAt = estimateNextReportAt(
    data.last_report_at,
    data.report_frequency as ReportFrequency
  );

  res.json({
    profile: data,
    next_report_at: nextReportAt?.toISOString() ?? null,
  });
});

router.patch('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const body = req.body as Record<string, unknown>;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.city !== undefined) {
    if (typeof body.city !== 'string' || !body.city.trim() || body.city.length > 100) {
      return res.status(400).json({ error: 'Invalid city' });
    }
    updates.city = body.city.trim();
  }

  if (body.living_situation !== undefined) {
    if (typeof body.living_situation !== 'string' || !LIVING_OPTIONS.includes(body.living_situation)) {
      return res.status(400).json({ error: 'Invalid living situation' });
    }
    updates.living_situation = body.living_situation;
  }

  if (body.report_frequency !== undefined) {
    if (typeof body.report_frequency !== 'string' || !FREQ_OPTIONS.includes(body.report_frequency)) {
      return res.status(400).json({ error: 'Invalid report frequency' });
    }
    updates.report_frequency = body.report_frequency;
  }

  if (body.income_sources !== undefined) {
    const income = normalizeIncomeSources(body.income_sources);
    if ('error' in income) return res.status(400).json({ error: income.error });
    updates.income_sources = income;
  }

  if (body.agent_assistance_preferences !== undefined) {
    updates.agent_assistance_preferences = normalizeAssistancePreferences(body.agent_assistance_preferences);
  }

  if (body.auto_reports_enabled !== undefined) {
    if (typeof body.auto_reports_enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid auto_reports_enabled' });
    }
    updates.auto_reports_enabled = body.auto_reports_enabled;
  }

  if (body.income_lower_inr !== undefined || body.income_upper_inr !== undefined) {
    const { data: current } = await supabaseAdmin
      .from('users')
      .select('income_lower_inr, income_upper_inr')
      .eq('id', userId)
      .single();
    const range = normalizeIncomeRange(
      body.income_lower_inr ?? current?.income_lower_inr ?? 5000,
      body.income_upper_inr ?? current?.income_upper_inr ?? 15000
    );
    if ('error' in range) return res.status(400).json({ error: range.error });
    updates.income_lower_inr = range.lower;
    updates.income_upper_inr = range.upper;
  }

  if (Object.keys(updates).length === 1) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    if (
      error.message?.includes('income_sources') ||
      error.message?.includes('agent_assistance') ||
      error.message?.includes('income_lower') ||
      error.message?.includes('income_upper')
    ) {
      return res.status(500).json({
        error: 'Database missing columns. Run migrations 004 and 005 (npm run migrate)',
      });
    }
    return res.status(500).json({ error: error.message });
  }

  res.json({
    profile: data,
    next_report_at: estimateNextReportAt(
      data.last_report_at,
      data.report_frequency as ReportFrequency
    )?.toISOString() ?? null,
  });
});

export default router;
