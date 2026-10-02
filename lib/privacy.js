// Deterministic privacy helpers. None of these call an AI.

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|medium\.com|twitter\.com|x\.com)\/\S*/gi;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?){2,4}\d{3,5}/g;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function nameParts(name) {
  return String(name || '')
    .split(/[\s.,'-]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);
}

export function firstName(name) {
  const first = String(name || '').trim().split(/\s+/)[0];
  return first || 'there';
}

// Second line of defence after the AI extraction: strip anything that still looks like PII.
export function scrubPersonalDetails(text, details) {
  let out = String(text || '');
  const literals = [details?.email, details?.phone, ...(details?.links || [])].filter(Boolean);
  for (const lit of literals) out = out.replace(new RegExp(escapeRe(String(lit)), 'gi'), '');
  out = out.replace(EMAIL_RE, '').replace(URL_RE, '');
  // Only strip phone-like digit runs (10+ digits) that are not just a run of years, so dates and metrics survive.
  out = out.replace(PHONE_RE, (m) => {
    if (m.replace(/\D/g, '').length < 10) return m;
    if (/^\s*(?:19|20)\d{2}(?:[\s.-]+(?:19|20)\d{2})+\s*$/.test(m)) return m;
    return '';
  });
  const parts = nameParts(details?.name);
  if (details?.name) out = out.replace(new RegExp(escapeRe(details.name.trim()), 'gi'), '');
  for (const p of parts) out = out.replace(new RegExp(`\\b${escapeRe(p)}\\b`, 'gi'), '');
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizeDetails(raw) {
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const links = Array.isArray(raw?.links) ? raw.links.map(str).filter(Boolean) : [];
  return { name: str(raw?.name), email: str(raw?.email), phone: str(raw?.phone), links: [...new Set(links)] };
}

// Red flag: a profile link whose handle shares nothing with the candidate's name.
export function linkNameMismatches(details) {
  const parts = nameParts(details?.name).map((p) => p.toLowerCase());
  if (!parts.length) return [];
  const initials = String(details.name).split(/\s+/).map((p) => p[0]?.toLowerCase() || '').join('');
  const flags = [];
  for (const link of details.links || []) {
    const handle = linkHandle(link);
    if (!handle) continue;
    const h = handle.toLowerCase().replace(/[^a-z]/g, '');
    if (!h) continue;
    const matches = parts.some((p) => h.includes(p.replace(/[^a-z]/g, ''))) || (initials.length >= 2 && h.startsWith(initials));
    if (!matches) flags.push({ type: 'link_name_mismatch', detail: `Link "${link}" does not match the candidate's name.` });
  }
  return flags;
}

function linkHandle(link) {
  try {
    const url = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`);
    const segs = url.pathname.split('/').filter(Boolean);
    const host = url.hostname.replace(/^www\./, '');
    if (/linkedin\.com$/.test(host)) return segs[0] === 'in' || segs[0] === 'pub' ? segs[1] : null;
    if (segs.length) return segs[0].replace(/^@/, '');
    // Personal domain, e.g. janedoe.com
    const label = host.split('.')[0];
    return label && !['github', 'gitlab', 'medium', 'behance', 'dribbble', 'twitter', 'x'].includes(label) ? label : null;
  } catch {
    return null;
  }
}

// Word 5-gram Jaccard similarity, used to spot near-identical CVs under different names.
function shingles(text) {
  const words = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + 5 <= words.length; i++) set.add(words.slice(i, i + 5).join(' '));
  return set;
}

export function similarity(a, b) {
  const A = shingles(a);
  const B = shingles(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const s of A) if (B.has(s)) inter++;
  return inter / (A.size + B.size - inter);
}

export const DUPLICATE_THRESHOLD = 0.6;
