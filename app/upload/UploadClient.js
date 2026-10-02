'use client';

import { useState } from 'react';
import Link from 'next/link';

const MAX_BYTES = 4 * 1024 * 1024;

async function postJSON(url, options) {
  let res;
  try {
    res = await fetch(url, { method: 'POST', ...options });
  } catch {
    throw new Error('Network error — check your connection.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    if (res.status === 504) throw new Error('The server timed out on this step.');
    if (res.status === 413) throw new Error('File too large for upload.');
    throw new Error(data?.error || `Request failed (${res.status}).`);
  }
  return data;
}

export default function UploadClient() {
  const [role, setRole] = useState('PM');
  const [items, setItems] = useState([]);
  const [running, setRunning] = useState(false);

  const update = (index, patch) => setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  function onPick(e) {
    const files = Array.from(e.target.files || []);
    setItems(files.map((file) => ({ file, status: 'waiting', step: '', error: '', id: null, name: null })));
  }

  async function processAll() {
    setRunning(true);
    // Strictly one file at a time, one step per request, to stay inside the server time limit.
    for (let i = 0; i < items.length; i++) {
      const { file } = items[i];
      if (items[i].status === 'done') continue;
      if (file.size > MAX_BYTES) {
        update(i, { status: 'error', error: 'PDF is larger than 4 MB.' });
        continue;
      }
      let id = items[i].id;
      try {
        if (!id) {
          update(i, { status: 'processing', step: 'Reading CV and removing personal details…', error: '' });
          const form = new FormData();
          form.append('file', file);
          form.append('role', role);
          const up = await postJSON('/api/upload', { body: form });
          id = up.id;
          update(i, { id, name: up.name });
        }
        update(i, { status: 'processing', step: 'Scoring against PM and SPM rubrics…' });
        await postJSON(`/api/candidates/${id}/score`);
        update(i, { step: 'Writing brief and email drafts…' });
        await postJSON(`/api/candidates/${id}/brief`);
        update(i, { status: 'done', step: '' });
      } catch (err) {
        update(i, { status: 'error', step: '', error: err.message });
      }
    }
    setRunning(false);
  }

  const done = items.filter((i) => i.status === 'done').length;
  const hasPending = items.some((i) => i.status !== 'done');

  return (
    <div>
      <h2>1. Role applied for</h2>
      <div className="role-pick">
        {[
          ['PM', 'Product Manager (PM)', '2–4 years product experience'],
          ['SPM', 'Senior Product Manager (SPM)', '5–8 years product experience'],
        ].map(([value, label, hint]) => (
          <label key={value} className={role === value ? 'active' : ''}>
            <input type="radio" name="role" value={value} checked={role === value} disabled={running}
              onChange={() => setRole(value)} />
            <strong>{label}</strong>
            <div className="muted small">{hint}</div>
          </label>
        ))}
      </div>

      <h2>2. CV files (PDF)</h2>
      <div className="dropzone">
        <input type="file" accept="application/pdf,.pdf" multiple onChange={onPick} disabled={running} />
        <p className="muted small" style={{ marginTop: 10 }}>Text-based PDFs up to 4 MB each.</p>
      </div>

      {items.length > 0 && (
        <>
          <div className="row-actions">
            <button className="btn btn-primary" onClick={processAll} disabled={running || !hasPending}>
              {running ? 'Processing…' : items.some((i) => i.status === 'error') ? 'Retry failed files' : `Process ${items.length} file${items.length > 1 ? 's' : ''} as ${role}`}
            </button>
            <span className="muted">{done} of {items.length} done</span>
            {done > 0 && !running && <Link href={`/?role=${role}`} className="btn">Go to dashboard →</Link>}
          </div>

          <table style={{ marginTop: 20 }}>
            <thead><tr><th>File</th><th>Status</th><th>Candidate</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>{it.file.name}</td>
                  <td>
                    {it.status === 'waiting' && <span className="status-waiting">Waiting</span>}
                    {it.status === 'processing' && <span className="status-processing">Processing — {it.step}</span>}
                    {it.status === 'done' && <span className="status-done">Done</span>}
                    {it.status === 'error' && <span className="status-error">Error: {it.error}</span>}
                  </td>
                  <td>{it.id ? <Link href={`/candidates/${it.id}`}>{it.name || 'Open'}</Link> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
