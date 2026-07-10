import { BRAND } from '../lib/brand.js';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  pdfBuffer?: Buffer;
  pdfFilename?: string;
}

export async function sendMissionEmail(input: SendEmailInput): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() ?? BRAND.emailFromDefault;

  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not set — skipping send (dev mode)');
    console.warn(`[Email] Would send to ${input.to}: ${input.subject}`);
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  const attachments = input.pdfBuffer
    ? [
        {
          filename: input.pdfFilename ?? `${BRAND.pdfFilenamePrefix}.pdf`,
          content: input.pdfBuffer.toString('base64'),
        },
      ]
    : undefined;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        attachments,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[Email] Resend error:', text);
      return { sent: false, error: text };
    }

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed';
    console.error('[Email]', message);
    return { sent: false, error: message };
  }
}
