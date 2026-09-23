// Optional PageSpeed Insights (Lighthouse + real-user CrUX data) integration. Off unless --psi is passed.
// Works without a key at a low rate limit; set PSI_API_KEY for regular use (free, Google Cloud console).

async function runPsi(url, { apiKey, strategy = 'mobile', timeoutMs = 90000 } = {}) {
  const params = new URLSearchParams({ url, strategy });
  ['performance', 'seo', 'accessibility', 'best-practices'].forEach((c) => params.append('category', c));
  if (apiKey) params.set('key', apiKey);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { signal: ctl.signal });
    if (!res.ok) throw new Error(`PSI HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const pct = (s) => (typeof s === 'number' ? Math.round(s * 100) : null);

function summarizePsi(json) {
  const lh = json && json.lighthouseResult;
  if (!lh) return null;
  const audit = (id) => (lh.audits && lh.audits[id] ? lh.audits[id].numericValue : null);
  const field = json.loadingExperience && json.loadingExperience.metrics;
  return {
    scores: {
      performance: pct(lh.categories.performance && lh.categories.performance.score),
      seo: pct(lh.categories.seo && lh.categories.seo.score),
      accessibility: pct(lh.categories.accessibility && lh.categories.accessibility.score),
      bestPractices: pct(lh.categories['best-practices'] && lh.categories['best-practices'].score),
    },
    lab: {
      lcpMs: Math.round(audit('largest-contentful-paint') ?? NaN) || null,
      fcpMs: Math.round(audit('first-contentful-paint') ?? NaN) || null,
      tbtMs: Math.round(audit('total-blocking-time') ?? NaN) || 0,
      cls: audit('cumulative-layout-shift') != null ? Number(audit('cumulative-layout-shift').toFixed(3)) : null,
      speedIndexMs: Math.round(audit('speed-index') ?? NaN) || null,
    },
    fieldDataAvailable: Boolean(field && Object.keys(field).length),
  };
}

function psiIssues(summary, url) {
  if (!summary || summary.scores.performance == null) return [];
  const p = summary.scores.performance;
  const detail = `performance ${p}/100 (LCP ${summary.lab.lcpMs ?? '?'}ms, TBT ${summary.lab.tbtMs}ms, CLS ${summary.lab.cls ?? '?'})`;
  if (p < 50) return [{ id: 'psi-poor', url, detail }];
  if (p < 90) return [{ id: 'psi-needs-work', url, detail }];
  return [];
}

module.exports = { runPsi, summarizePsi, psiIssues };
