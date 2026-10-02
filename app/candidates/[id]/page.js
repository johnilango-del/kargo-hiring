import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCandidate } from '@/lib/supabase';
import { rankOf } from '@/lib/candidates';
import { isUuid } from '@/lib/api';
import { firstName } from '@/lib/privacy';
import Flags from '@/components/Flags';
import EmailPanel from './EmailPanel';
import RetryButton from './RetryButton';

export const dynamic = 'force-dynamic';

export default async function CandidatePage({ params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  let c, rank, loadError;
  try {
    c = await getCandidate(id);
    if (c) rank = await rankOf(c);
  } catch (err) {
    loadError = err.message;
  }
  if (loadError) return <div className="notice err" style={{ marginTop: 24 }}>{loadError}</div>;
  if (!c) notFound();

  const role = c.applied_role;
  const otherRole = role === 'PM' ? 'SPM' : 'PM';
  const score = role === 'PM' ? c.pm_score : c.spm_score;
  const otherScore = role === 'PM' ? c.spm_score : c.pm_score;
  const d = c.personal_details || {};
  const scored = c.pm_score !== null && c.spm_score !== null;
  const ready = scored && c.brief && c.invite_email && c.rejection_email;

  return (
    <>
      <p style={{ marginTop: 20 }}><Link href={`/?role=${role}`}>← Back to {role} ranking</Link></p>

      <div className="hero">
        <div className="meta">
          <h1 style={{ marginTop: 0 }}>{d.name || c.file_name}</h1>
          <p className="muted">
            Applied for {role === 'PM' ? 'Product Manager' : 'Senior Product Manager'} · {c.file_name}
            {c.years_experience !== null && ` · ~${Number(c.years_experience)} yrs product experience`}
          </p>
          <div>
            {rank.rank ? (
              <>
                <span className={`badge ${rank.shortlisted ? 'shortlist' : 'reject'}`}>
                  {rank.shortlisted ? 'Shortlist' : 'Not moving forward'}
                </span>{' '}
                <span className="muted small">Ranked {rank.rank} of {rank.total} {role} candidates · recommendation only</span>
              </>
            ) : <span className="badge error">Not scored yet</span>}
          </div>
        </div>
        <div>
          <div className="muted small">{role} score</div>
          <div className="score-big">{score ?? '–'}<small>/100</small></div>
        </div>
        <div>
          <div className="muted small">{otherRole} score</div>
          <div className="score">{otherScore ?? '–'}<small>/100</small></div>
        </div>
      </div>

      {c.pipeline_error && <div className="notice err">Last processing attempt failed: {c.pipeline_error}</div>}
      {!ready && <RetryButton id={c.id} needsScore={!scored} />}

      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>Brief</h3>
          <p>{c.brief || <span className="muted">Not generated yet.</span>}</p>
          <h3 style={{ marginTop: 18 }}>Questions to probe in interview</h3>
          {Array.isArray(c.probe_questions) && c.probe_questions.length ? (
            <ol className="questions">{c.probe_questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
          ) : <p className="muted">Not generated yet.</p>}
        </div>
        <div className="card">
          <h3>Red flags <span className="muted small">(for your review — never used to score or reject)</span></h3>
          <Flags flags={c.red_flags} />
          <h3 style={{ marginTop: 18 }}>Contact details</h3>
          <dl className="kv">
            <dt>Email</dt><dd>{d.email || '—'}</dd>
            <dt>Phone</dt><dd>{d.phone || '—'}</dd>
            <dt>Links</dt>
            <dd>{d.links?.length ? d.links.map((l) => <div key={l}>{l}</div>) : '—'}</dd>
          </dl>
        </div>
      </div>

      {ready && (
        <>
          <h2>Email</h2>
          <EmailPanel
            id={c.id}
            defaultType={rank.shortlisted ? 'invite' : 'rejection'}
            shortlisted={rank.shortlisted}
            invite={c.invite_email}
            rejection={c.rejection_email}
            candidateEmail={d.email}
            firstName={firstName(d.name)}
            sent={c.email_status === 'sent'}
            sentType={c.email_type_sent}
            sentAt={c.sent_at}
          />
        </>
      )}

      <Breakdown title={`${role} breakdown (applied role)`} rows={role === 'PM' ? c.pm_breakdown : c.spm_breakdown} total={score} />
      <Breakdown title={`${otherRole} breakdown`} rows={role === 'PM' ? c.spm_breakdown : c.pm_breakdown} total={otherScore} />

      <details style={{ marginTop: 28 }}>
        <summary className="muted" style={{ cursor: 'pointer' }}>Anonymised CV text (exactly what the AI scored)</summary>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, background: 'var(--bg-soft)', padding: 16, borderRadius: 8 }}>
          {c.cv_content}
        </pre>
      </details>
    </>
  );
}

function Breakdown({ title, rows, total }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return (
    <>
      <h2>{title} <span className="muted small">· total {total}/100</span></h2>
      <table className="breakdown">
        <thead><tr><th>Criterion</th><th>Score</th><th>Points</th><th>Evidence</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td style={{ fontWeight: 600, width: 280 }}>{r.name}</td>
              <td><span className="dots">{'●'.repeat(r.score)}{'○'.repeat(5 - r.score)}</span> <span className="muted small">{r.score}/5</span></td>
              <td className="pts">{r.points} / {r.weight}</td>
              <td>{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
