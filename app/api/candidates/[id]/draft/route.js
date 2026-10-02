import { ok, fail, isUuid } from '@/lib/api';
import { db, getCandidate } from '@/lib/supabase';

export const runtime = 'nodejs';

// Saves Arjun's edits to a draft. Does NOT send anything.
export async function POST(request, { params }) {
  const { id } = await params;
  if (!isUuid(id)) return fail('Invalid candidate id.', 400);
  try {
    const { type, body } = await request.json();
    if (type !== 'invite' && type !== 'rejection') return fail('Unknown email type.', 400);
    if (typeof body !== 'string' || !body.trim()) return fail('Email text is empty.', 400);
    const cand = await getCandidate(id);
    if (!cand) return fail('Candidate not found.', 404);
    if (cand.email_status === 'sent') return fail('An email has already been sent to this candidate.', 409);
    const column = type === 'invite' ? 'invite_email' : 'rejection_email';
    const { error } = await db().from('candidates').update({ [column]: body.trim() }).eq('id', id);
    if (error) throw new Error(error.message);
    return ok({});
  } catch (err) {
    return fail(err.message || 'Could not save draft.');
  }
}
