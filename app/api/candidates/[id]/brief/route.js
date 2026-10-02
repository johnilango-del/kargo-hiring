import { ok, fail, isUuid } from '@/lib/api';
import { writeBriefAndEmails, recordPipelineError } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Step 4 for ONE CV: brief, probe questions, invite and rejection drafts.
export async function POST(_request, { params }) {
  const { id } = await params;
  if (!isUuid(id)) return fail('Invalid candidate id.', 400);
  try {
    return ok(await writeBriefAndEmails(id));
  } catch (err) {
    console.error('brief failed', err);
    await recordPipelineError(id, `Brief failed: ${err.message}`).catch(() => {});
    return fail(err.message || 'Brief failed.');
  }
}
