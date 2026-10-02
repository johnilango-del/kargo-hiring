import { ok, fail, isUuid } from '@/lib/api';
import { db, getCandidate } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import { firstName } from '@/lib/privacy';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SUBJECTS = {
  invite: 'Your application at Kargo – interview invitation',
  rejection: 'Your application at Kargo',
};

// The ONLY place an email is sent. Called solely when Arjun clicks Confirm for this candidate.
export async function POST(request, { params }) {
  const { id } = await params;
  if (!isUuid(id)) return fail('Invalid candidate id.', 400);

  let claimed = false;
  try {
    const { type, body } = await request.json();
    if (type !== 'invite' && type !== 'rejection') return fail('Unknown email type.', 400);
    if (typeof body !== 'string' || !body.trim()) return fail('Email text is empty.', 400);

    const cand = await getCandidate(id);
    if (!cand) return fail('Candidate not found.', 404);
    if (cand.email_status === 'sent') return fail('An email has already been sent to this candidate.', 409);

    // Claim the send atomically: only one request can flip pending -> sent, so it can never go out twice.
    const sentAt = new Date().toISOString();
    const column = type === 'invite' ? 'invite_email' : 'rejection_email';
    const { data: claimedRows, error: claimErr } = await db()
      .from('candidates')
      .update({ email_status: 'sent', email_type_sent: type, sent_at: sentAt, [column]: body.trim() })
      .eq('id', id).eq('email_status', 'pending')
      .select('id');
    if (claimErr) throw new Error(`Could not update status: ${claimErr.message}`);
    if (!claimedRows?.length) return fail('An email has already been sent to this candidate.', 409);
    claimed = true;

    const text = body.trim().replace(/\[NAME\]/g, firstName(cand.personal_details?.name));
    const result = await sendEmail({ realEmail: cand.personal_details?.email, subject: SUBJECTS[type], text });
    return ok({ sent_at: sentAt, email_type_sent: type, to: result.to, subject: result.subject });
  } catch (err) {
    console.error('send failed', err);
    // Sending failed after the claim: release it so Arjun can retry.
    if (claimed) {
      await db().from('candidates')
        .update({ email_status: 'pending', email_type_sent: null, sent_at: null }).eq('id', id)
        .then(() => {}, () => {});
    }
    return fail(err.message || 'Could not send email.');
  }
}
