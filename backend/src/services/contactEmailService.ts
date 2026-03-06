import { env } from '../env.js';

function escapeHtml(input: string) {
  // Escape user-provided values before injecting into HTML email templates.
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type ContactEmailInput = {
  name: string;
  email: string;
  message: string;
};

const CONTACT_TO = 'support@sonuslearning.com';
const CONTACT_FROM = 'Sonus Support <support@sonuslearning.com>';

function buildContactEmailHtml(input: ContactEmailInput) {
  // Render support-friendly contact payload with explicit sender metadata.
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f3f5f7;font-family:Arial,sans-serif;color:#1f2a37;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
      <tr>
        <td>
          <h1 style="font-size:22px;line-height:1.25;margin:0 0 14px;color:#1f2a37;">New Sonus Contact Request</h1>
          <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 6px;"><strong>Name:</strong> ${escapeHtml(input.name)}</p>
          <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 18px;"><strong>Email:</strong> ${escapeHtml(input.email)}</p>
          <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 8px;"><strong>Message:</strong></p>
          <pre style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:#334155;margin:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">${escapeHtml(input.message)}</pre>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendContactEmail(input: ContactEmailInput) {
  // Sends contact submissions via Resend and returns a boolean delivery outcome.
  if (!env.RESEND_API_KEY) {
    console.error('[contact] RESEND_API_KEY is not configured; cannot send contact email.');
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: CONTACT_FROM,
      to: [CONTACT_TO],
      reply_to: input.email,
      subject: `Contact form: ${input.name}`,
      html: buildContactEmailHtml(input),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[contact] Failed to send contact email', response.status, body);
    return false;
  }

  return true;
}
