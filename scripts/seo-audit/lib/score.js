// Turns raw findings into grouped issues, category scores and an overall score.
//
// Scoring is intentionally simple and explainable:
//   penalty(issue) = severityWeight * (0.5 + 0.5 * affectedRatio)      (site-wide issues: ratio = 1)
//   category score = 100 - sum of its penalties (min 0)
//   overall        = weighted average of the category scores (CATEGORY_WEIGHT)
//   critical cap   = while any CRITICAL issue is open, overall cannot exceed CRITICAL_CAP: a site that is
//                    blocked from indexing is not a "B" just because its page speed is fine
// so one critical problem hurts a lot, a problem present on every page hurts more than on one page,
// and a single weak area cannot be hidden by the others nor drag the whole score to zero.
const { CATALOG, CATEGORIES, CATEGORY_WEIGHT, SEVERITY_WEIGHT, SEVERITY_ORDER, EFFORT_ORDER } = require('./catalog');

const CRITICAL_CAP = 55;

/**
 * findings: [{ id, url|null, detail, urls? }]  (url null = site-wide)
 * pagesChecked: number of pages sampled (denominator for the affected ratio)
 */
function buildIssues(findings, pagesChecked) {
  const byId = new Map();
  for (const f of findings) {
    const meta = CATALOG[f.id];
    if (!meta) throw new Error(`Unknown issue id: ${f.id}`);
    if (!byId.has(f.id)) byId.set(f.id, { id: f.id, ...meta, siteWide: false, affected: new Set(), examples: [] });
    const issue = byId.get(f.id);
    if (f.url == null && !f.urls) issue.siteWide = true;
    (f.urls || (f.url ? [f.url] : [])).forEach((u) => issue.affected.add(u));
    if (f.detail && issue.examples.length < 3 && !issue.examples.includes(f.detail)) issue.examples.push(f.detail);
  }

  const issues = [...byId.values()].map((i) => {
    const affectedCount = i.affected.size;
    const ratio = i.siteWide || !pagesChecked ? 1 : Math.min(1, affectedCount / pagesChecked);
    const penalty = SEVERITY_WEIGHT[i.severity] * (0.5 + 0.5 * ratio);
    return { ...i, affected: [...i.affected], affectedCount, ratio: Number(ratio.toFixed(2)), penalty: Number(penalty.toFixed(1)) };
  });

  // most important first: severity, then cheapest fix first, then how widespread
  issues.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort] ||
      b.ratio - a.ratio
  );
  return issues;
}

function scoreIssues(issues) {
  const categories = {};
  for (const key of Object.keys(CATEGORIES)) categories[key] = { label: CATEGORIES[key], score: 100, issues: 0 };
  for (const i of issues) {
    categories[i.category].score -= i.penalty;
    categories[i.category].issues += 1;
  }
  for (const c of Object.values(categories)) c.score = Math.max(0, Math.round(c.score));
  const overall = Object.entries(categories).reduce((sum, [key, c]) => sum + (c.score * CATEGORY_WEIGHT[key]) / 100, 0);
  const capped = issues.some((i) => i.severity === 'critical') && overall > CRITICAL_CAP;
  return { overall: capped ? CRITICAL_CAP : Math.round(overall), categories, capped };
}

function grade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

/** Compares two runs by issue id: what appeared, what got fixed, score delta. */
function diffRuns(prev, curr) {
  if (!prev) return null;
  const before = new Set(prev.issues.map((i) => i.id));
  const after = new Set(curr.issues.map((i) => i.id));
  return {
    previousDate: prev.generatedAt,
    scoreDelta: curr.score.overall - prev.score.overall,
    newIssues: [...after].filter((id) => !before.has(id)),
    resolvedIssues: [...before].filter((id) => !after.has(id)),
  };
}

module.exports = { buildIssues, scoreIssues, grade, diffRuns };
