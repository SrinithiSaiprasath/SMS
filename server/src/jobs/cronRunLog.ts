import { supabaseAdmin } from '../lib/supabase.js';

export type CronRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'UNAUTHORIZED';

export interface CronRunMetadata {
  source?: string;
  github_run_id?: string;
  github_run_attempt?: string;
  github_workflow?: string;
  user_agent?: string;
  ip?: string;
}

export async function startCronRun(input: {
  jobName?: string;
  triggeredBy: string;
  metadata?: CronRunMetadata;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('cron_runs')
    .insert({
      job_name: input.jobName ?? 'dispatch-reports',
      triggered_by: input.triggeredBy,
      status: 'RUNNING',
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[CronRun] Failed to start log row:', error?.message);
    throw new Error('Failed to record cron run start');
  }

  return data.id;
}

export async function finishCronRun(
  runId: string,
  input: {
    status: Exclude<CronRunStatus, 'RUNNING' | 'UNAUTHORIZED'>;
    usersEligible?: number;
    usersProcessed: number;
    usersSkipped: number;
    errors: string[];
    startedAt: number;
  }
): Promise<void> {
  const finishedAt = Date.now();
  const { error } = await supabaseAdmin
    .from('cron_runs')
    .update({
      status: input.status,
      finished_at: new Date(finishedAt).toISOString(),
      duration_ms: finishedAt - input.startedAt,
      users_eligible: input.usersEligible ?? input.usersProcessed + input.usersSkipped,
      users_processed: input.usersProcessed,
      users_skipped: input.usersSkipped,
      error_count: input.errors.length,
      errors: input.errors,
    })
    .eq('id', runId);

  if (error) {
    console.error('[CronRun] Failed to finish log row:', error.message);
  }
}

export async function logUnauthorizedCronAttempt(input: {
  triggeredBy: string;
  metadata?: CronRunMetadata;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('cron_runs').insert({
    job_name: 'dispatch-reports',
    triggered_by: input.triggeredBy,
    status: 'UNAUTHORIZED',
    finished_at: new Date().toISOString(),
    duration_ms: 0,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error('[CronRun] Failed to log unauthorized attempt:', error.message);
  }
}
