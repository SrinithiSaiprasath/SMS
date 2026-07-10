import { Router } from 'express';
import { dispatchScheduledReports } from '../jobs/reportScheduler.js';
import { startCronRun, finishCronRun, logUnauthorizedCronAttempt, } from '../jobs/cronRunLog.js';
const router = Router();
function verifyCronSecret(req) {
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected)
        return false;
    const header = req.headers['x-cron-secret'];
    const auth = req.headers.authorization;
    const provided = (typeof header === 'string' ? header : undefined) ??
        (typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : undefined);
    return provided === expected;
}
function headerString(req, name) {
    const v = req.headers[name.toLowerCase()];
    return typeof v === 'string' ? v : undefined;
}
function extractCronMetadata(req) {
    return {
        source: headerString(req, 'x-cron-source') ?? 'unknown',
        github_run_id: headerString(req, 'x-github-run-id'),
        github_run_attempt: headerString(req, 'x-github-run-attempt'),
        github_workflow: headerString(req, 'x-github-workflow'),
        user_agent: headerString(req, 'user-agent'),
        ip: req.ip,
    };
}
function triggeredByLabel(metadata) {
    if (metadata.source === 'github-actions') {
        return metadata.github_run_id
            ? `github-actions#${metadata.github_run_id}`
            : 'github-actions';
    }
    return metadata.source ?? 'unknown';
}
router.post('/cron/dispatch-reports', async (req, res) => {
    const metadata = extractCronMetadata(req);
    const triggeredBy = triggeredByLabel(metadata);
    if (!verifyCronSecret(req)) {
        await logUnauthorizedCronAttempt({ triggeredBy, metadata });
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const startedAt = Date.now();
    let runId = null;
    try {
        runId = await startCronRun({ triggeredBy, metadata });
        const result = await dispatchScheduledReports(runId);
        await finishCronRun(runId, {
            status: result.errors.length > 0 ? 'FAILED' : 'SUCCESS',
            usersEligible: result.eligible,
            usersProcessed: result.processed,
            usersSkipped: result.skipped,
            errors: result.errors,
            startedAt,
        });
        res.json({ ok: true, cron_run_id: runId, ...result });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Scheduler failed';
        if (runId) {
            await finishCronRun(runId, {
                status: 'FAILED',
                usersProcessed: 0,
                usersSkipped: 0,
                errors: [message],
                startedAt,
            });
        }
        res.status(500).json({ error: message, cron_run_id: runId });
    }
});
export default router;
