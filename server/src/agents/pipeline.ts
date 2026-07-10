import { supabaseAdmin } from '../lib/supabase.js';
import { runAgentA, runAgentB } from './openaiAgents.js';
import { buildAgentContextFromProfile } from './capabilities.js';
import { buildUserMissionContext } from './userContext.js';
import { sendMissionEmail } from '../integrations/email.js';
import { composeMissionEmailHtml } from '../integrations/emailComposer.js';
import { markdownToPdfBuffer } from '../integrations/reportPdf.js';
import { uploadReportPdf } from '../integrations/storage.js';
import { BRAND } from '../lib/brand.js';
import type { ReportFrequency, UserProfile } from '../types/index.js';

function getPeriodDays(frequency: ReportFrequency): number {
  switch (frequency) {
    case 'WEEKLY':
      return 7;
    case 'BIWEEKLY':
      return 14;
    case 'MONTHLY':
      return 30;
  }
}

function formatPeriodLabel(start: Date, end: Date, frequency: ReportFrequency): string {
  const freq = frequency.charAt(0) + frequency.slice(1).toLowerCase();
  return `${freq} Mission — ${start.toLocaleDateString('en-IN')} to ${end.toLocaleDateString('en-IN')}`;
}

async function getUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

export async function runReportPipeline(userId: string, reportId: string): Promise<void> {
  await supabaseAdmin
    .from('reports')
    .update({ status: 'PROCESSING', error_message: null })
    .eq('id', reportId);

  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) throw new Error('User profile not found');

    const { data: report } = await supabaseAdmin
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (!report) throw new Error('Report not found');

    const periodStart = new Date(report.period_start);
    const periodEnd = new Date(report.period_end);

    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, description, raw_message, logged_at, category')
      .eq('user_id', userId)
      .gte('logged_at', periodStart.toISOString())
      .lte('logged_at', periodEnd.toISOString())
      .order('logged_at', { ascending: true });

    if (txError) throw txError;

    const untagged = (transactions ?? []).filter((t) => !t.category);
    if (untagged.length === 0 && (transactions ?? []).length === 0) {
      throw new Error('No transactions in this period to analyze');
    }

    const toAnalyze = untagged.length > 0 ? untagged : (transactions ?? []);
    const userProfile = profile as UserProfile;

    const agentAOutput = await runAgentA(userProfile, toAnalyze);

    for (const item of agentAOutput.categorized_transactions) {
      await supabaseAdmin
        .from('transactions')
        .update({ category: item.category, tagged_at: new Date().toISOString() })
        .eq('id', item.transaction_id)
        .eq('user_id', userId);
    }

    const { data: prevInsight } = await supabaseAdmin
      .from('report_insights')
      .select('leak_percentage, essential_percentage, investment_percentage')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousBreakdown = prevInsight
      ? {
          LEAK: Number(prevInsight.leak_percentage),
          WORTHY_ESSENTIAL: Number(prevInsight.essential_percentage),
          INVESTMENT: Number(prevInsight.investment_percentage),
        }
      : null;

    const periodLabel = formatPeriodLabel(periodStart, periodEnd, profile.report_frequency);
    const agentBOutput = await runAgentB(userProfile, agentAOutput, periodLabel, previousBreakdown);

    await supabaseAdmin.from('report_insights').insert({
      report_id: reportId,
      user_id: userId,
      leak_percentage: agentAOutput.category_breakdown.LEAK,
      essential_percentage: agentAOutput.category_breakdown.WORTHY_ESSENTIAL,
      investment_percentage: agentAOutput.category_breakdown.INVESTMENT,
      total_spend: agentAOutput.total_spend,
      behavioral_summary: agentAOutput.behavioral_summary,
      saving_opportunities: agentAOutput.saving_opportunities,
      full_report_markdown: agentBOutput.markdown,
    });

    const inAppUrl = `/reports/${reportId}`;
    let emailSentAt: string | null = null;
    let pdfStoragePath: string | null = null;

    const missionCtx = buildUserMissionContext(userProfile);
    const pdfTitle = agentBOutput.title || periodLabel;
    const pdfBuffer = await markdownToPdfBuffer(pdfTitle, agentBOutput.markdown, {
      subtitle: `${BRAND.name} · ${periodLabel}`,
      footer: `Income: ${missionCtx.income_range_label}/mo · ${missionCtx.income_sources.join(', ') || '—'} · ${BRAND.tagline}`,
    });
    const dateSlug = new Date().toISOString().slice(0, 10);
    const pdfFilename = `${BRAND.pdfFilenamePrefix}_${dateSlug}.pdf`;

    try {
      pdfStoragePath = await uploadReportPdf(userId, reportId, pdfBuffer, pdfFilename);
    } catch (storageErr) {
      console.warn('[Pipeline] PDF storage upload failed:', storageErr);
    }

    const agentCtx = buildAgentContextFromProfile(userProfile);
    if (agentCtx.uses_email) {
      const toEmail = await getUserEmail(userId);
      if (toEmail) {
        const appBase = (process.env.APP_URL ?? process.env.CLIENT_URL ?? 'http://localhost:5173').replace(/\/$/, '');
        const reportUrl = `${appBase}/reports/${reportId}`;
        const subject = `🪐 ${agentBOutput.title || periodLabel} — ${BRAND.name}`;
        const html = composeMissionEmailHtml({
          profile: userProfile,
          periodLabel,
          agentAOutput,
          emailSections: agentBOutput.emailSections,
          reportUrl,
        });
        const result = await sendMissionEmail({
          to: toEmail,
          subject,
          html,
          pdfBuffer,
          pdfFilename,
        });

        const deliveryStatus = result.sent ? 'SENT' : 'FAILED';
        emailSentAt = result.sent ? new Date().toISOString() : null;

        await supabaseAdmin.from('email_deliveries').insert({
          report_id: reportId,
          user_id: userId,
          to_email: toEmail,
          subject,
          status: deliveryStatus,
          error_message: result.error ?? null,
          sent_at: emailSentAt,
        });
      } else {
        console.warn('[Pipeline] No email on auth user — skipping email delivery');
      }
    }

    await supabaseAdmin
      .from('reports')
      .update({
        status: 'COMPLETED',
        doc_url: inAppUrl,
        generated_at: new Date().toISOString(),
        email_sent_at: emailSentAt,
        pdf_storage_path: pdfStoragePath,
        error_message: null,
      })
      .eq('id', reportId);

    await supabaseAdmin
      .from('users')
      .update({ last_report_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', userId);
  } catch (err) {
    console.error('Pipeline failed:', err);
    const errorMessage = err instanceof Error ? err.message : 'Report generation failed';
    await supabaseAdmin
      .from('reports')
      .update({ status: 'FAILED', error_message: errorMessage })
      .eq('id', reportId);
    throw err;
  }
}

export async function createReportForUser(userId: string): Promise<string> {
  const { data: profile } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
  if (!profile) throw new Error('Profile not found');

  const days = getPeriodDays(profile.report_frequency as ReportFrequency);
  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - days);

  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .insert({
      user_id: userId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      frequency: profile.report_frequency,
      status: 'PENDING',
    })
    .select('id')
    .single();

  if (error || !report) throw error ?? new Error('Failed to create report');
  return report.id;
}

export { getPeriodDays };
