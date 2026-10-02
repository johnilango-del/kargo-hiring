import { ok, fail } from '@/lib/api';
import { extractAndStore } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Step 1-2 for ONE CV: read PDF, separate personal details, store anonymised CV.
export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const role = form.get('role');
    if (role !== 'PM' && role !== 'SPM') return fail('Role must be PM or SPM.', 400);
    if (!file || typeof file === 'string') return fail('No file received.', 400);
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return fail('Only PDF files are accepted.', 400);
    if (file.size > 4 * 1024 * 1024) return fail('PDF is larger than 4 MB.', 400);

    const buffer = await file.arrayBuffer();
    const { id, name } = await extractAndStore({ buffer, fileName: file.name, role });
    return ok({ id, name });
  } catch (err) {
    console.error('upload failed', err);
    return fail(err.message || 'Upload failed.');
  }
}
