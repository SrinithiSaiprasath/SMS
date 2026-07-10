import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../lib/supabase';
import { CosmicCard, Mascot } from '../components/CosmicUI';

function renderMarkdown(md: string) {
  return md
    .replace(/^### (.*$)/gim, '<h3 class="font-display text-lg text-cosmos-amber mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="font-display text-xl text-cosmos-mint mt-6 mb-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="font-display text-2xl text-cosmos-mint mb-4">$1</h1>')
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hubl]|<blockquote)(.+)$/gim, '<p>$1</p>');
}

interface DeliveryInfo {
  status: string;
  error_message: string | null;
  sent_at: string | null;
  to_email: string;
}

export default function ReportDetailPage() {
  const { id } = useParams();
  const [markdown, setMarkdown] = useState('');
  const [emailSentAt, setEmailSentAt] = useState<string | null>(null);
  const [hasPdf, setHasPdf] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/reports/${id}`)
      .then((d) => {
        const report = d.report;
        const insights = report?.report_insights;
        const md = Array.isArray(insights) ? insights[0]?.full_report_markdown : insights?.full_report_markdown;
        setMarkdown(md ?? 'Report content not available.');
        setEmailSentAt(report?.email_sent_at ?? null);
        setHasPdf(Boolean(report?.pdf_storage_path));
        setDelivery(d.delivery ?? null);
      })
      .catch(() => setMarkdown('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownloadPdf = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      const { url } = await apiFetch(`/api/reports/${id}/pdf`);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'PDF download failed');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <p className="text-center text-white/50 py-12">Loading report...</p>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Link to="/reports" className="text-cosmos-mint text-sm hover:underline">
          ← Back to Reports
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {emailSentAt && (
            <span className="text-sm text-cosmos-mint">
              Emailed {new Date(emailSentAt).toLocaleString('en-IN')}
            </span>
          )}
          {delivery?.status === 'FAILED' && (
            <span className="text-sm text-cosmos-pink">
              Email failed{delivery.error_message ? `: ${delivery.error_message}` : ''}
            </span>
          )}
          {hasPdf && (
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="btn-cosmic-secondary text-sm py-2 px-4"
            >
              {downloading ? 'Opening...' : 'Download PDF'}
            </button>
          )}
        </div>
      </div>

      <CosmicCard>
        <div className="text-center mb-6">
          <Mascot animal="owl" message="Here's your report debrief!" />
        </div>
        <div
          className="markdown-report prose-invert"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
        />
      </CosmicCard>
    </div>
  );
}
