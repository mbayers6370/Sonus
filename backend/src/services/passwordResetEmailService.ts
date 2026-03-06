import { env } from '../env.js';

function escapeHtml(input: string) {
  // Escape values embedded in reset-email HTML.
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildResetEmailHtml(resetUrl: string) {
  // Render password reset email with branded CTA and token expiry guidance.
  const logoUrl =
    env.RESET_EMAIL_LOGO_URL ||
    (env.RESET_URL_BASE
      ? `${env.RESET_URL_BASE.replace(/\/$/, '')}/branding/logo_name_solo.png`
      : null);
  const safeUrl = escapeHtml(resetUrl);
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
          <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px;color:#1f2a37;">Reset your password</h1>
          <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 16px;">
            We received a request to reset your Sonus password.
          </p>
          <p style="text-align:center;margin:20px 0;">
            <a href="${safeUrl}" style="display:inline-block;background:#1f2a37;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">Reset Password</a>
          </p>
          <p style="font-size:13px;line-height:1.6;color:#64748b;margin:0 0 8px;">
            If you didn’t request this, you can safely ignore this email.
          </p>
          <p style="font-size:13px;line-height:1.6;color:#64748b;margin:0;">
            This link expires in ${env.RESET_TOKEN_TTL_MINUTES} minutes.
          </p>
          <p style="font-size:14px;line-height:1.6;color:#334155;margin:18px 0 0;">
            Thanks,<br/>The Sonus Team
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

type ResetEmailInput = {
  to: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail(input: ResetEmailInput) {
  // Sends reset email through Resend; in no-email environments logs and succeeds.
  const html = buildResetEmailHtml(input.resetUrl);

  if (!env.RESEND_API_KEY) {
    console.info('[auth] Password reset link (email disabled):', {
      to: input.to,
      resetUrl: input.resetUrl,
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
      subject: 'Reset your Sonus password',
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[auth] Failed to send reset email', response.status, body);
    return false;
  }
  return true;
}
