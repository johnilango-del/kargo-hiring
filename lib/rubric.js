// Criterion keys and weights mirror rubric.txt. The model scores 0-5; totals are computed here, not by the model.
export const CRITERIA = {
  PM: [
    { key: 'ops_experience', name: 'Ground-floor operations experience', weight: 25 },
    { key: 'unasked_fixes', name: 'Builds unasked fixes that others adopt', weight: 20 },
    { key: 'owns_decisions', name: 'Owns decisions without a layer above', weight: 20 },
    { key: 'kills_failures', name: "Kills what doesn't work and owns failures", weight: 20 },
    { key: 'field_discovery', name: 'Discovery in the field, not from a desk', weight: 15 },
  ],
  SPM: [
    { key: 'consequential_calls', name: 'Owns consequential calls with no committee', weight: 25 },
    { key: 'ops_experience', name: 'Ground-floor operations experience', weight: 20 },
    { key: 'kills_own_ideas', name: 'Kills own ideas and owns failures', weight: 20 },
    { key: 'sets_standards', name: 'Sets standards others adopt', weight: 20 },
    { key: 'integration_data', name: 'Integration and data depth from real use', weight: 15 },
  ],
};

export const ROLE_YEARS = { PM: [2, 4], SPM: [5, 8] };
export const SHORTLIST_SIZE = 5;

// Turns the model's raw criterion list into a validated breakdown and total out of 100.
export function buildBreakdown(role, rawCriteria) {
  const byKey = new Map((Array.isArray(rawCriteria) ? rawCriteria : []).map((c) => [c?.key, c]));
  const breakdown = CRITERIA[role].map((c) => {
    const raw = byKey.get(c.key);
    let score = Math.round(Number(raw?.score));
    if (!Number.isFinite(score)) score = 0;
    score = Math.min(5, Math.max(0, score));
    const points = Math.round((score / 5) * c.weight * 10) / 10;
    const reason = typeof raw?.reason === 'string' && raw.reason.trim() ? raw.reason.trim() : 'No evidence in the CV.';
    return { key: c.key, name: c.name, weight: c.weight, score, points, reason };
  });
  const total = Math.round(breakdown.reduce((sum, c) => sum + c.points, 0) * 10) / 10;
  return { breakdown, total };
}

export function criteriaPromptList(role) {
  return CRITERIA[role].map((c) => `- "${c.key}": ${c.name} (weight ${c.weight})`).join('\n');
}
