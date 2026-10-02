'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

async function post(url) {
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
}

export default function RetryButton({ id, needsScore }) {
  const router = useRouter();
  const [state, setState] = useState({ busy: false, step: '', error: '' });

  async function run() {
    try {
      if (needsScore) {
        setState({ busy: true, step: 'Scoring…', error: '' });
        await post(`/api/candidates/${id}/score`);
      }
      setState({ busy: true, step: 'Writing brief and email drafts…', error: '' });
      await post(`/api/candidates/${id}/brief`);
      setState({ busy: false, step: '', error: '' });
      router.refresh();
    } catch (err) {
      setState({ busy: false, step: '', error: err.message });
    }
  }

  return (
    <div className="notice info">
      This candidate hasn't been fully processed yet.{' '}
      <button className="btn btn-primary" onClick={run} disabled={state.busy} style={{ marginLeft: 8 }}>
        {state.busy ? state.step : needsScore ? 'Run scoring and brief' : 'Generate brief and emails'}
      </button>
      {state.error && <div className="status-error" style={{ marginTop: 8 }}>{state.error}</div>}
    </div>
  );
}
