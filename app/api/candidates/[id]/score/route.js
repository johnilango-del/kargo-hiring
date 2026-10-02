import { ok, fail, isUuid } from '@/lib/api';
import { scoreCandidate, recordPipelineError } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Step 3 for ONE CV: score on both rubrics.
export async function POST(_request, { params }) {
  const { id } = await params;
  if (!isUuid(id)) return fail('Invalid candidate id.', 400);
  try {
    return ok(await scoreCandidate(id));
  } catch (err) {
    console.error('score failed', err);
    await recordPipelineError(id, `Scoring failed: ${err.message}`).catch(() => {});
    return fail(err.message || 'Scoring failed.');
  }
}
