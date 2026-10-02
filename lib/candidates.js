import { db } from './supabase';
import { SHORTLIST_SIZE } from './rubric';

const LIST_FIELDS = 'id, created_at, applied_role, file_name, personal_details, pm_score, spm_score, red_flags, brief, email_status, email_type_sent, sent_at, pipeline_error';

// Candidates who applied for `role`, ranked by that role's score. Top 5 scored = Shortlist.
export async function rankedCandidates(role) {
  const scoreCol = role === 'PM' ? 'pm_score' : 'spm_score';
  const { data, error } = await db()
    .from('candidates').select(LIST_FIELDS).eq('applied_role', role)
    .order(scoreCol, { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Could not load candidates: ${error.message}`);

  let rank = 0;
  return (data || []).map((c) => {
    const score = c[scoreCol];
    if (score === null || score === undefined) return { ...c, score: null, rank: null, shortlisted: false };
    rank += 1;
    return { ...c, score: Number(score), rank, shortlisted: rank <= SHORTLIST_SIZE };
  });
}

export async function rankOf(candidate) {
  const list = await rankedCandidates(candidate.applied_role);
  const me = list.find((c) => c.id === candidate.id);
  return { rank: me?.rank ?? null, total: list.filter((c) => c.rank).length, shortlisted: !!me?.shortlisted };
}
