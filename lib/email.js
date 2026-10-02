import { requireEnv } from './env';

const FROM = 'Kargo Hiring <onboarding@resend.dev>';

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// TEST MODE: every email goes to EMAIL_TEST_RECIPIENT; the real address is shown in the subject.
export async function sendEmail({ realEmail, subject, text }) {
  const to = requireEnv('EMAIL_TEST_RECIPIENT');
  const fullSubject = `[To: ${realEmail || 'no email found on CV'}] ${subject}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111">${
    escapeHtml(text).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
  }</div>`;

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${requireEnv('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject: fullSubject, text, html }),
    });
  } catch (err) {
    throw new Error(`Could not reach Resend: ${err.message}`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${body?.message || 'unknown error'}`);
  return { id: body?.id, to, subject: fullSubject };
}
