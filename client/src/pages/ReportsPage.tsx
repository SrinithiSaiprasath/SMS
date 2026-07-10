import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiFetch, supabase } from '../lib/supabase';
import { CosmicCard, Mascot } from '../components/CosmicUI';
import { formatINR } from '../lib/cosmicTheme';

interface Report {
  id: string;
  period_start: string;
  period_end: string;
  frequency: string;
  status: string;
  generated_at: string | null;
  doc_url: string | null;
  email_sent_at: string | null;
  error_message: string | null;
  report_insights: Array<{
    leak_percentage: number;
    essential_percentage: number;
    investment_percentage: number;
    total_spend: number;
    behavioral_summary: string;
  }>;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [generating, setGenerating] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadReports = () => {
    apiFetch('/api/reports')
      .then((d) => setReports(d.reports ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports();

    const channel = supabase
      .channel('reports-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        loadReports();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setMessage('');
    try {
      const result = await apiFetch('/api/reports/generate', { method: 'POST' });
      setMessage(result.message ?? 'Report generation started!');
      loadReports();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  };

  const handleRetry = async (reportId: string) => {
    setRetryingId(reportId);
    setMessage('');
    try {
      const result = await apiFetch(`/api/reports/${reportId}/retry`, { method: 'POST' });
      setMessage(result.message ?? 'Retrying report...');
      loadReports();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  const processing = reports.some((r) => r.status === 'PROCESSING' || r.status === 'PENDING');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Reports</h1>
          <p className="text-white/50">AI coaching debriefs from your crew</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || processing}
          className="btn-cosmic-primary whitespace-nowrap"
        >
          {generating || processing ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {message && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-cosmos-mint text-sm mb-4">
          {message}
        </motion.p>
      )}

      {loading ? (
        <p className="text-center text-white/50 py-12">Loading reports...</p>
      ) : reports.length === 0 ? (
        <CosmicCard className="text-center py-12">
          <Mascot animal="owl" message="No reports yet! Log some expenses and generate your first debrief." />
          <p className="text-white/50 mt-4">Your AI crew will analyze spending and deliver actionable insights.</p>
        </CosmicCard>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const insight = report.report_insights?.[0];
            const isProcessing = report.status === 'PROCESSING' || report.status === 'PENDING';
            const isFailed = report.status === 'FAILED';

            return (
              <CosmicCard key={report.id}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xl">
                        {isProcessing ? '⏳' : isFailed ? '⚠️' : '📊'}
                      </span>
                      <h3 className="font-display font-bold text-lg">
                        {report.frequency.charAt(0) + report.frequency.slice(1).toLowerCase()} Report
                      </h3>
                      {isProcessing && (
                        <span className="text-xs bg-cosmos-amber/20 text-cosmos-amber px-2 py-0.5 rounded-full animate-pulse">
                          Processing
                        </span>
                      )}
                      {isFailed && (
                        <span className="text-xs bg-cosmos-pink/20 text-cosmos-pink px-2 py-0.5 rounded-full">
                          Failed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/50">
                      {new Date(report.period_start).toLocaleDateString('en-IN')} — {new Date(report.period_end).toLocaleDateString('en-IN')}
                    </p>
                    {isFailed && report.error_message && (
                      <p className="text-sm text-cosmos-pink mt-2">{report.error_message}</p>
                    )}
                    {insight && !isFailed && (
                      <>
                        <div className="flex gap-2 mt-3 flex-wrap">
                          <span className="badge-leak text-xs px-2 py-1 rounded-full">
                            Leak {Number(insight.leak_percentage).toFixed(0)}%
                          </span>
                          <span className="badge-essential text-xs px-2 py-1 rounded-full">
                            Essential {Number(insight.essential_percentage).toFixed(0)}%
                          </span>
                          <span className="badge-investment text-xs px-2 py-1 rounded-full">
                            Invest {Number(insight.investment_percentage).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-sm text-white/60 mt-2 line-clamp-2">{insight.behavioral_summary}</p>
                        <p className="text-sm text-cosmos-mint mt-1">Total: {formatINR(Number(insight.total_spend))}</p>
                      </>
                    )}
                  </div>
                  {report.status === 'COMPLETED' && (
                    <div className="flex flex-col gap-2 shrink-0">
                      {report.email_sent_at && (
                        <span className="text-xs text-cosmos-mint text-center">Emailed to you</span>
                      )}
                      <Link to={`/reports/${report.id}`} className="btn-cosmic-primary text-center whitespace-nowrap">
                        View Report →
                      </Link>
                    </div>
                  )}
                  {isFailed && (
                    <button
                      onClick={() => handleRetry(report.id)}
                      disabled={retryingId === report.id || processing}
                      className="btn-cosmic-secondary whitespace-nowrap shrink-0"
                    >
                      {retryingId === report.id ? 'Retrying...' : 'Retry'}
                    </button>
                  )}
                </div>
              </CosmicCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
