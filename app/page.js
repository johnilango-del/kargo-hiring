import Link from 'next/link';
import { rankedCandidates } from '@/lib/candidates';
import ClickableRow from '@/components/ClickableRow';
import Flags from '@/components/Flags';

export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }) {
  const params = await searchParams;
  const role = params?.role === 'SPM' ? 'SPM' : 'PM';

  let lists;
  try {
    const [pm, spm] = await Promise.all([rankedCandidates('PM'), rankedCandidates('SPM')]);
    lists = { PM: pm, SPM: spm };
  } catch (err) {
    return (
      <>
        <h1>Dashboard</h1>
        <div className="notice err">{err.message}</div>
        <p className="muted">Check the Supabase environment variables and that supabase/schema.sql has been run.</p>
      </>
    );
  }

  const rows = lists[role];
  const scored = rows.filter((c) => c.rank);
  const unscored = rows.filter((c) => !c.rank);
  const shortlist = scored.filter((c) => c.shortlisted);
  const rest = scored.filter((c) => !c.shortlisted);

  return (
    <>
      <h1>Candidates</h1>
      <p className="muted">
        Ranked by {role === 'PM' ? 'Product Manager' : 'Senior Product Manager'} score. Top 5 are marked Shortlist.
        These are recommendations only — open a candidate to review and send an email.
      </p>

      <div className="tabs">
        {['PM', 'SPM'].map((r) => (
          <Link key={r} href={`/?role=${r}`} className={`tab ${r === role ? 'active' : ''}`}>
            {r === 'PM' ? 'Product Manager (PM)' : 'Senior Product Manager (SPM)'}
            <span className="count">{lists[r].length}</span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          No {role} candidates yet. <Link href="/upload">Upload CVs</Link>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Candidate</th>
              <th>{role} score</th>
              <th>Recommendation</th>
              <th>Red flags</th>
              <th>Brief</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {shortlist.length > 0 && <tr className="divider"><td colSpan={7}>Shortlist</td></tr>}
            {shortlist.map((c) => <Row key={c.id} c={c} role={role} />)}
            {rest.length > 0 && <tr className="divider"><td colSpan={7}>Not moving forward</td></tr>}
            {rest.map((c) => <Row key={c.id} c={c} role={role} />)}
            {unscored.length > 0 && <tr className="divider"><td colSpan={7}>Needs attention (not scored yet)</td></tr>}
            {unscored.map((c) => <Row key={c.id} c={c} role={role} />)}
          </tbody>
        </table>
      )}
    </>
  );
}

function Row({ c, role }) {
  const other = role === 'PM' ? c.spm_score : c.pm_score;
  return (
    <ClickableRow href={`/candidates/${c.id}`}>
      <td className="rank">{c.rank ?? '–'}</td>
      <td className="name">
        <Link href={`/candidates/${c.id}`}>{c.personal_details?.name || c.file_name}</Link>
        <div className="muted small">{c.file_name}</div>
      </td>
      <td>
        {c.score !== null ? (
          <>
            <div className="score">{c.score}<small>/100</small></div>
            <div className="muted small">{role === 'PM' ? 'SPM' : 'PM'}: {other ?? '–'}</div>
          </>
        ) : <span className="badge error">Not scored</span>}
      </td>
      <td>
        {c.rank === null ? (
          <span className="badge error">{c.pipeline_error ? 'Error' : 'Processing'}</span>
        ) : c.shortlisted ? (
          <span className="badge shortlist">Shortlist</span>
        ) : (
          <span className="badge reject">Not moving forward</span>
        )}
      </td>
      <td><Flags flags={c.red_flags} /></td>
      <td className="brief-cell">{c.brief || <span className="muted">—</span>}</td>
      <td>
        {c.email_status === 'sent'
          ? <span className="badge sent">{c.email_type_sent === 'invite' ? 'Invite sent' : 'Rejection sent'}</span>
          : <span className="muted small">Pending</span>}
      </td>
    </ClickableRow>
  );
}
