import { extractText, getDocumentProxy } from 'unpdf';
import { db, getRubricText } from './supabase';
import { geminiJSON } from './gemini';
import { ROLE_YEARS, buildBreakdown, criteriaPromptList } from './rubric';
import {
  normalizeDetails, scrubPersonalDetails, linkNameMismatches, similarity, DUPLICATE_THRESHOLD,
} from './privacy';

// ---------- Step 1 + 2: PDF text -> personal details + anonymised CV ----------

export async function pdfToText(buffer) {
  let text;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    ({ text } = await extractText(pdf, { mergePages: true }));
  } catch (err) {
    throw new Error(`Could not read this PDF (${err.message}). Is it a valid, unlocked PDF?`);
  }
  text = String(text || '').replace(/\u0000/g, '').trim();
  if (text.length < 100) {
    throw new Error('This PDF has almost no selectable text (it may be a scanned image). Please upload a text-based PDF.');
  }
  return text.slice(0, 60000);
}

export async function extractAndStore({ buffer, fileName, role }) {
  const rawText = await pdfToText(buffer);

  const result = await geminiJSON(`You are a privacy filter for a hiring system.
From the CV text below, do two things and return ONLY JSON in this exact shape:
{
  "personal_details": { "name": string|null, "email": string|null, "phone": string|null, "links": string[] },
  "cv_content": string
}
- personal_details: the candidate's full name, email address, phone number, and every URL / profile link (LinkedIn, GitHub, portfolio, personal site, etc.).
- cv_content: the FULL CV text, unchanged and unsummarised, but with the candidate's name, email, phone number and all links removed.
  Keep everything else exactly: job titles, companies, dates, numbers, achievements, education, skills.
  Do not add commentary.

CV TEXT:
"""
${rawText}
"""`, { temperature: 0 });

  const details = normalizeDetails(result?.personal_details);
  if (typeof result?.cv_content !== 'string' || result.cv_content.trim().length < 50) {
    throw new Error('Extraction step did not return usable CV content.');
  }
  // Belt and braces: strip anything that still looks like the extracted details or generic PII.
  const cvContent = scrubPersonalDetails(result.cv_content, details);

  const { data, error } = await db()
    .from('candidates')
    .insert({ applied_role: role, file_name: fileName, personal_details: details, cv_content: cvContent })
    .select('id')
    .single();
  if (error) throw new Error(`Could not save candidate to Supabase: ${error.message}`);
  return { id: data.id, name: details.name };
}

// ---------- Step 3: score on both rubrics (cv_content only) ----------

export async function scoreCandidate(id) {
  const { data: cand, error } = await db()
    .from('candidates').select('id, applied_role, cv_content, personal_details').eq('id', id).maybeSingle();
  if (error) throw new Error(`Could not load candidate: ${error.message}`);
  if (!cand) throw new Error('Candidate not found.');

  const rubric = await getRubricText();

  // PRIVACY: only cv_content and the rubric go to the AI. personal_details never leave this server.
  const result = await geminiJSON(`You are scoring a job candidate for Kargo, a logistics SaaS startup.
Follow the rubric below EXACTLY. Score against BOTH the PM rubric and the SPM rubric.

RULES
- Score each criterion as an integer 0-5 using ONLY evidence written in the CV. No evidence = 0. Do not infer.
- Use the score anchors and the caps written in each criterion (e.g. "scores at most 1", "at most 2", "up to 3").
- Pedigree (college, MBA brand, certifications, talks, PRD templates, frameworks) earns nothing on its own.
- "reason" is ONE line that quotes or points to the specific CV evidence (or says what is missing).
- Red flags are listed for a human reviewer only; they never lower a score.
- Do NOT compute totals; just give the 0-5 scores.

Return ONLY JSON in this exact shape:
{
  "years_product_experience": number|null,   // total years in product management roles, from the CV dates
  "pm":  [ { "key": string, "score": 0-5, "reason": string } ],
  "spm": [ { "key": string, "score": 0-5, "reason": string } ],
  "red_flags": [ { "type": "vague_claims" | "other", "detail": string } ]
}
Use these keys for "pm":
${criteriaPromptList('PM')}
Use these keys for "spm":
${criteriaPromptList('SPM')}
For red_flags, only report: claims with no specifics (no numbers, no named outcome) repeated across the CV,
or anything else from the rubric's RED FLAGS list that is visible in the CV text itself. Return [] if none.

RUBRIC
"""
${rubric}
"""

CANDIDATE CV (personal details removed)
"""
${cand.cv_content}
"""`);

  const pm = buildBreakdown('PM', result?.pm);
  const spm = buildBreakdown('SPM', result?.spm);
  let years = Number(result?.years_product_experience);
  years = Number.isFinite(years) && years >= 0 ? Math.round(years * 10) / 10 : null;

  const flags = [];
  const aiFlags = Array.isArray(result?.red_flags) ? result.red_flags : [];
  for (const f of aiFlags) {
    if (f && typeof f.detail === 'string' && f.detail.trim()) {
      flags.push({ type: f.type === 'vague_claims' ? 'vague_claims' : 'other', detail: f.detail.trim() });
    }
  }

  const [lo, hi] = ROLE_YEARS[cand.applied_role];
  if (years === null) {
    flags.push({ type: 'years_out_of_range', detail: `Could not determine years of product experience (${cand.applied_role} range is ${lo}-${hi}).` });
  } else if (years < lo || years > hi) {
    flags.push({ type: 'years_out_of_range', detail: `About ${years} years of product experience; ${cand.applied_role} range is ${lo}-${hi}.` });
  }

  // Deterministic checks that use personal details stay on the server, with no AI involved.
  flags.push(...linkNameMismatches(cand.personal_details));
  flags.push(...(await findDuplicates(cand)));

  const { error: upErr } = await db().from('candidates').update({
    pm_score: pm.total, spm_score: spm.total,
    pm_breakdown: pm.breakdown, spm_breakdown: spm.breakdown,
    red_flags: flags, years_experience: years, pipeline_error: null,
  }).eq('id', id);
  if (upErr) throw new Error(`Could not save scores: ${upErr.message}`);

  return { pm_score: pm.total, spm_score: spm.total, red_flags: flags };
}

async function findDuplicates(cand) {
  const { data: others, error } = await db()
    .from('candidates').select('id, file_name, personal_details, cv_content, red_flags').neq('id', cand.id);
  if (error || !others) return [];
  const flags = [];
  for (const other of others) {
    const sim = similarity(cand.cv_content, other.cv_content);
    if (sim < DUPLICATE_THRESHOLD) continue;
    const pct = Math.round(sim * 100);
    const otherName = other.personal_details?.name || other.file_name;
    flags.push({ type: 'duplicate_cv', detail: `CV text is ${pct}% identical to ${otherName} (${other.file_name}).`, other_id: other.id });

    // Mark the earlier candidate too, so the flag shows on both.
    const existing = Array.isArray(other.red_flags) ? other.red_flags : [];
    if (!existing.some((f) => f.type === 'duplicate_cv' && f.other_id === cand.id)) {
      const thisName = cand.personal_details?.name || 'another candidate';
      await db().from('candidates').update({
        red_flags: [...existing, { type: 'duplicate_cv', detail: `CV text is ${pct}% identical to ${thisName}.`, other_id: cand.id }],
      }).eq('id', other.id);
    }
  }
  return flags;
}

// ---------- Step 4: brief, probe questions, invite + rejection drafts ----------

export async function writeBriefAndEmails(id) {
  const { data: cand, error } = await db()
    .from('candidates')
    .select('id, applied_role, cv_content, pm_score, spm_score, pm_breakdown, spm_breakdown')
    .eq('id', id).maybeSingle();
  if (error) throw new Error(`Could not load candidate: ${error.message}`);
  if (!cand) throw new Error('Candidate not found.');
  if (cand.pm_score === null || cand.spm_score === null) throw new Error('Candidate has not been scored yet.');

  const role = cand.applied_role;
  const roleName = role === 'PM' ? 'Product Manager' : 'Senior Product Manager';
  const fmt = (b) => b.map((c) => `- ${c.name}: ${c.score}/5 (${c.points}/${c.weight} pts) — ${c.reason}`).join('\n');

  // PRIVACY: only cv_content and scores go to the AI. The model never sees the name or contact details.
  const result = await geminiJSON(`You support Arjun, founder of Kargo (a logistics SaaS startup), who is hiring a ${roleName} (${role}).
The candidate applied for ${role}. Their ${role} score is the one that matters for ranking.

SCORES
PM score: ${cand.pm_score}/100
${fmt(cand.pm_breakdown)}

SPM score: ${cand.spm_score}/100
${fmt(cand.spm_breakdown)}

CANDIDATE CV (personal details removed)
"""
${cand.cv_content}
"""

Write the following and return ONLY JSON:
{
  "brief": string,
  "probe_questions": string[],
  "invite_email": string,
  "rejection_email": string
}
- brief: exactly 3 sentences. (1) Who they are professionally. (2) The strongest evidence behind their ${role} score. (3) The biggest gap that held the score back.
- probe_questions: 2 or 3 specific interview questions Arjun should ask to test the weakest or least-evidenced criteria. Reference their actual experience.
- invite_email: a warm, specific invitation to interview for the ${roleName} role. Mention one or two concrete things from their CV that stood out. Ask them to reply with a few times that work for a 45-minute conversation. Sign off as "Arjun" with "Founder, Kargo" on the next line.
- rejection_email: a respectful, human rejection for the ${roleName} role. Thank them sincerely, mention something specific from their CV you appreciated, say clearly but kindly that you are not moving forward for this role, and wish them well. It must not sound automated or templated. Sign off the same way.
- Both emails: plain text, no subject line, start with "Hi [NAME]," on the first line. Use [NAME] as the ONLY placeholder. Do not mention scores, rubrics, or red flags. Under 180 words each.`, { temperature: 0.6 });

  const brief = typeof result?.brief === 'string' ? result.brief.trim() : '';
  const questions = (Array.isArray(result?.probe_questions) ? result.probe_questions : [])
    .filter((q) => typeof q === 'string' && q.trim()).map((q) => q.trim()).slice(0, 3);
  const invite = typeof result?.invite_email === 'string' ? result.invite_email.trim() : '';
  const rejection = typeof result?.rejection_email === 'string' ? result.rejection_email.trim() : '';
  if (!brief || !invite || !rejection || questions.length < 2) {
    throw new Error('Brief step returned incomplete content. Try again.');
  }

  const { error: upErr } = await db().from('candidates').update({
    brief, probe_questions: questions, invite_email: invite, rejection_email: rejection, pipeline_error: null,
  }).eq('id', id);
  if (upErr) throw new Error(`Could not save brief: ${upErr.message}`);
  return { brief };
}

export async function recordPipelineError(id, message) {
  if (!id) return;
  await db().from('candidates').update({ pipeline_error: String(message).slice(0, 500) }).eq('id', id);
}

