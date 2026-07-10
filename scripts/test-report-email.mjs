/**
 * Send a static CosmoSpend report email via Resend (no Groq/LLM).
 * Usage: node scripts/test-report-email.mjs you@gmail.com
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) throw new Error('.env not found');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '1') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const to = process.argv[2];
if (!to || !to.includes('@')) {
  console.error('Usage: node scripts/test-report-email.mjs your@email.com');
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.EMAIL_FROM?.trim() ?? 'CosmoSpend <onboarding@resend.dev>';
const appUrl = (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, '');

if (!apiKey) {
  console.error('RESEND_API_KEY missing in .env');
  process.exit(1);
}

const periodLabel = 'Weekly Report — Test';
const html = `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,system-ui,sans-serif;background:#1a1a2e;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:24px;text-align:center;color:white;">
      <div style="font-size:32px;">🪐</div>
      <h1 style="margin:8px 0 4px;font-size:22px;">Mission Debrief</h1>
      <p style="margin:0;opacity:0.9;font-size:14px;">${periodLabel}</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#6b7280;font-size:13px;">This is a <strong>test template</strong> — email delivery works!</p>
      <div style="display:flex;gap:8px;margin:16px 0;flex-wrap:wrap;">
        <span style="background:#fef3c7;padding:6px 12px;border-radius:20px;font-size:12px;">Leak 35%</span>
        <span style="background:#dbeafe;padding:6px 12px;border-radius:20px;font-size:12px;">Essential 45%</span>
        <span style="background:#d1fae5;padding:6px 12px;border-radius:20px;font-size:12px;">Invest 20%</span>
      </div>
      <div style="margin:16px 0;padding:16px;background:#f8f4ff;border-radius:12px;border-left:4px solid #7c3aed;">
        <h3 style="margin:0 0 8px;color:#5b21b6;">Expense coaching</h3>
        <ul style="margin:0;padding-left:20px;color:#374151;">
          <li>Sample insight: Swiggy spend was high this week.</li>
          <li>Tip: Try a ₹500/day food cap challenge.</li>
        </ul>
      </div>
      <p style="margin:24px 0 8px;text-align:center;">
        <a href="${appUrl}/reports" style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:600;">
          View in app →
        </a>
      </p>
      <p style="font-size:11px;color:#9ca3af;text-align:center;">CosmoSpend · Cosmic Animal Adventure</p>
    </div>
  </div>
</body>
</html>`;

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from,
    to: [to],
    subject: `🪐 ${periodLabel} — CosmoSpend (test)`,
    html,
  }),
});

const text = await res.text();
if (!res.ok) {
  console.error('Failed:', res.status, text);
  process.exit(1);
}

console.log('Sent test report email to', to);
console.log('Response:', text);
