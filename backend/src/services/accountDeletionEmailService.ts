import { env } from '../env.js';

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type AccountDeletionEmailInput = {
  to: string;
  deletedAtIso: string;
};

function buildAccountDeletionEmailHtml(input: AccountDeletionEmailInput) {
  const logoUrl =
    env.RESET_EMAIL_LOGO_URL ||
    (env.RESET_URL_BASE
      ? `${env.RESET_URL_BASE.replace(/\/$/, '')}/branding/logo_name_solo.png`
      : null);
  const logoHtml = logoUrl
    ? `<div style="text-align:center;margin:0 0 20px;">
         <img src="${escapeHtml(logoUrl)}" alt="Sonus" style="height:40px;width:auto;display:inline-block;" />
       </div>`
    : `<h2 style="margin:0 0 16px;text-align:center;font-family:Arial,sans-serif;color:#1f2a37;letter-spacing:0.2em;">SONUS</h2>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f3f5f7;font-family:Arial,sans-serif;color:#1f2a37;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
      <tr>
        <td>
          ${logoHtml}
          <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px;color:#1f2a37;">Account permanently deleted</h1>
          <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 16px;">
            This is a confirmation that your Sonus account and associated learning records were permanently deleted.
          </p>
          <p style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 8px;">
            <strong>Deletion timestamp (UTC):</strong> ${escapeHtml(input.deletedAtIso)}
          </p>
          <p style="font-size:13px;line-height:1.6;color:#64748b;margin:14px 0 0;">
            If you did not request this deletion, contact support immediately at
            <a href="mailto:support@sonuslearning.com" style="color:#0f172a;">support@sonuslearning.com</a>.
          </p>
          <p style="font-size:14px;line-height:1.6;color:#334155;margin:18px 0 0;">
            Sonus Support
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendAccountDeletionConfirmationEmail(input: AccountDeletionEmailInput) {
  if (!env.RESEND_API_KEY) {
    console.info('[auth] Account deletion email skipped (RESEND_API_KEY not configured):', {
      to: input.to,
      deletedAtIso: input.deletedAtIso,
    });
    return true;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESET_EMAIL_FROM,
      to: [input.to],
      subject: 'Your Sonus account has been permanently deleted',
      html: buildAccountDeletionEmailHtml(input),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[auth] Failed to send account deletion email', response.status, body);
    return false;
  }

  return true;
}
