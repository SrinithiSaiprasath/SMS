import { supabaseAdmin } from '../lib/supabase.js';
import { createReportForUser, runReportPipeline, getPeriodDays } from '../agents/pipeline.js';
import type { ReportFrequency } from '../types/index.js';

function periodEndFromStart(start: Date, frequency: ReportFrequency): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + getPeriodDays(frequency));
  return end;
}

function isDue(lastReportAt: string | null, frequency: ReportFrequency): boolean {
  const days = getPeriodDays(frequency);
  if (!lastReportAt) return true;
  const dueAt = new Date(lastReportAt);
  dueAt.setDate(dueAt.getDate() + days);
  return dueAt <= new Date();
}

async function hasActiveReport(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('reports')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['PENDING', 'PROCESSING'])
    .maybeSingle();
  return !!data;
}

async function hasRecentReport(userId: string, frequency: ReportFrequency): Promise<boolean> {
  const days = getPeriodDays(frequency);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await supabaseAdmin
    .from('reports')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString())
    .in('status', ['COMPLETED', 'PROCESSING', 'PENDING'])
    .maybeSingle();

  return !!data;
}

export async function dispatchScheduledReports(cronRunId?: string): Promise<{
  eligible: number;
  processed: number;
  skipped: number;
  errors: string[];
}> {
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, report_frequency, last_report_at, auto_reports_enabled')
    .eq('auto_reports_enabled', true);

  if (error) throw error;

  const eligible = (users ?? []).length;
  let processed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const user of users ?? []) {
    const frequency = user.report_frequency as ReportFrequency;

    if (!isDue(user.last_report_at, frequency)) {
      skipped++;
      continue;
    }

    if (await hasActiveReport(user.id) || (await hasRecentReport(user.id, frequency))) {
      skipped++;
      continue;
    }

    try {
      const reportId = await createReportForUser(user.id);

      await supabaseAdmin.from('report_jobs').insert({
        user_id: user.id,
        scheduled_for: new Date().toISOString(),
        status: 'RUNNING',
        report_id: reportId,
        attempts: 1,
        cron_run_id: cronRunId ?? null,
      });

      await runReportPipeline(user.id, reportId);

      await supabaseAdmin
        .from('report_jobs')
        .update({ status: 'DONE' })
        .eq('report_id', reportId)
        .eq('status', 'RUNNING');

      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${user.id}: ${message}`);

      await supabaseAdmin
        .from('report_jobs')
        .update({ status: 'FAILED', last_error: message })
        .eq('user_id', user.id)
        .eq('status', 'RUNNING');
    }
  }

  return { eligible, processed, skipped, errors };
}

export function estimateNextReportAt(
  lastReportAt: string | null,
  frequency: ReportFrequency
): Date | null {
  if (!lastReportAt) return new Date();
  const next = new Date(lastReportAt);
  next.setDate(next.getDate() + getPeriodDays(frequency));
  return next;
}

export { periodEndFromStart };
