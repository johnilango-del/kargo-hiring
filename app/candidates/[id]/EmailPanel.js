'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SUBJECTS = {
  invite: 'Your application at Kargo – interview invitation',
  rejection: 'Your application at Kargo',
};

export default function EmailPanel({
  id, defaultType, shortlisted, invite, rejection, candidateEmail, firstName, sent, sentType, sentAt,
}) {
  const router = useRouter();
  const [type, setType] = useState(sent ? sentType || defaultType : defaultType);
  const [drafts, setDrafts] = useState({ invite, rejection });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [isSent, setIsSent] = useState(sent);
  const [sentInfo, setSentInfo] = useState({ type: sentType, at: sentAt });

  const body = drafts[type] || '';
  const subject = `[To: ${candidateEmail || 'no email found on CV'}] ${SUBJECTS[type]}`;
  const recommended = shortlisted ? 'invite' : 'rejection';

  async function call(path) {
    const res = await fetch(`/api/candidates/${id}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, body }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      const err = new Error(data?.error || `Request failed (${res.status}).`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function saveDraft() {
    setBusy(true); setMsg(null);
    try {
      await call('draft');
      setMsg({ kind: 'ok', text: 'Draft saved. Nothing was sent.' });
    } catch (err) {
      setMsg({ kind: 'err', text: err.message });
    } finally { setBusy(false); }
  }

  async function confirmSend() {
    setBusy(true); setMsg(null);
    try {
      const data = await call('send');
      setIsSent(true);
      setSentInfo({ type: data.email_type_sent, at: data.sent_at });
      setMsg({ kind: 'ok', text: `Sent (test mode) to ${data.to}. Subject: ${data.subject}` });
      router.refresh();
    } catch (err) {
      if (err.status === 409) setIsSent(true);
      setMsg({ kind: 'err', text: err.message });
    } finally { setBusy(false); }
  }

  if (isSent) {
    return (
      <div className="card">
        <div className="notice ok" style={{ marginTop: 0 }}>
          {sentInfo.type === 'invite' ? 'Interview invite' : 'Rejection email'} sent
          {sentInfo.at ? ` on ${new Date(sentInfo.at).toLocaleString()}` : ''}. An email cannot be sent twice.
        </div>
        {msg && <div className={`notice ${msg.kind}`}>{msg.text}</div>}
        <div className="subject">{`[To: ${candidateEmail || 'no email found on CV'}] ${SUBJECTS[sentInfo.type] || ''}`}</div>
        <textarea value={drafts[sentInfo.type] || ''} readOnly />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="row-actions" style={{ marginTop: 0, justifyContent: 'space-between' }}>
        <div className="segmented">
          {['invite', 'rejection'].map((t) => (
            <button key={t} className={type === t ? 'active' : ''} onClick={() => { setType(t); setMsg(null); }} disabled={busy}>
              {t === 'invite' ? 'Interview invite' : 'Rejection'}{t === recommended ? ' (recommended)' : ''}
            </button>
          ))}
        </div>
        <span className="muted small">[NAME] will be replaced with “{firstName}” when sent.</span>
      </div>

      {type !== recommended && (
        <div className="notice info">
          You're overriding the recommendation: this candidate is {shortlisted ? 'on the shortlist' : 'not on the shortlist'}.
        </div>
      )}

      <div className="subject" style={{ marginTop: 14 }}><strong>Subject:</strong> {subject}</div>
      <textarea value={body} onChange={(e) => setDrafts({ ...drafts, [type]: e.target.value })} disabled={busy} />

      {msg && <div className={`notice ${msg.kind}`}>{msg.text}</div>}

      <div className="row-actions">
        <button className="btn-confirm" onClick={confirmSend} disabled={busy || !body.trim()}>
          {busy ? 'Working…' : `Confirm & send ${type === 'invite' ? 'invite' : 'rejection'}`}
        </button>
        <button className="btn" onClick={saveDraft} disabled={busy || !body.trim()}>Save draft</button>
        <span className="muted small">Test mode: goes to your test inbox, not the candidate.</span>
      </div>
    </div>
  );
}
