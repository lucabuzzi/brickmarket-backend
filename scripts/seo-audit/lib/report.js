// Renders the audit result as Markdown (for reading/pasting) and a single self-contained HTML file.
const { CATEGORIES } = require('./catalog');

const SEV_LABEL = { critical: 'CRITICO', high: 'ALTO', medium: 'MEDIO', low: 'BASSO', info: 'INFO' };
const SEV_COLOR = { critical: '#dc2626', high: '#ea580c', medium: '#ca8a04', low: '#2563eb', info: '#6b7280' };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function affectedText(i) {
  if (i.siteWide && !i.affectedCount) return 'tutto il sito';
  return `${i.affectedCount} pagine`;
}

function renderMarkdown(r) {
  const L = [];
  L.push(`# Report SEO / AEO — ${r.baseUrl}`);
  L.push('');
  L.push(`Generato: ${r.generatedAt} · Pagine analizzate: ${r.pagesChecked}`);
  L.push('');
  L.push(`## Punteggio complessivo: **${r.score.overall}/100** (voto ${r.score.grade})`);
  L.push('');
  L.push('| Area | Punteggio | Problemi |');
  L.push('|---|---|---|');
  for (const c of Object.values(r.score.categories)) L.push(`| ${c.label}${c.partial ? ' *(parziale: solo TTFB e compressione, senza PageSpeed)*' : ''} | ${c.score}/100 | ${c.issues} |`);
  L.push('');
  if (r.diff) {
    L.push(`### Rispetto all'analisi precedente (${r.diff.previousDate})`);
    L.push(`- Punteggio: ${r.diff.scoreDelta >= 0 ? '+' : ''}${r.diff.scoreDelta}`);
    L.push(`- Nuovi problemi: ${r.diff.newIssues.length ? r.diff.newIssues.join(', ') : 'nessuno'}`);
    L.push(`- Risolti: ${r.diff.resolvedIssues.length ? r.diff.resolvedIssues.join(', ') : 'nessuno'}`);
    L.push('');
  }
  L.push('## Da fare, in ordine di priorità');
  L.push('(gravità, poi sforzo minore, poi diffusione)');
  L.push('');
  r.issues.forEach((i, n) => {
    L.push(`### ${n + 1}. [${SEV_LABEL[i.severity]}] ${i.title}`);
    L.push(`- Area: ${CATEGORIES[i.category]} · Sforzo: ${i.effort} · Colpisce: ${affectedText(i)}`);
    if (i.examples.length) L.push(`- Esempi: ${i.examples.join(' | ')}`);
    if (i.affected.length) L.push(`- Pagine: ${i.affected.slice(0, 6).join(', ')}${i.affected.length > 6 ? ` … (+${i.affected.length - 6})` : ''}`);
    L.push(`- **Come risolvere**: ${i.fix}`);
    L.push('');
  });
  if (r.psi && r.psi.length) {
    L.push('## PageSpeed Insights (mobile)');
    r.psi.forEach((p) => L.push(`- ${p.url}: performance ${p.summary.scores.performance}, SEO ${p.summary.scores.seo}, accessibilità ${p.summary.scores.accessibility}, LCP ${p.summary.lab.lcpMs}ms, TBT ${p.summary.lab.tbtMs}ms, CLS ${p.summary.lab.cls}`));
    L.push('');
  }
  if (r.notes.length) {
    L.push('## Note');
    r.notes.forEach((n) => L.push(`- ${n}`));
    L.push('');
  }
  L.push('## Pagine analizzate');
  L.push('| URL | Stato | TTFB | Peso | Problemi |');
  L.push('|---|---|---|---|---|');
  r.pages.forEach((p) => L.push(`| ${p.path} | ${p.status} | ${p.ttfbMs ?? '-'}ms | ${Math.round(p.bytes / 1024)}KB | ${p.issueIds.join(', ') || '—'} |`));
  return L.join('\n') + '\n';
}

function renderHtml(r) {
  const gradeColor = r.score.overall >= 75 ? '#16a34a' : r.score.overall >= 50 ? '#ca8a04' : '#dc2626';
  const cats = Object.values(r.score.categories)
    .map((c) => `<div class="cat"><div class="cs" style="color:${c.score >= 75 ? '#16a34a' : c.score >= 50 ? '#ca8a04' : '#dc2626'}">${c.score}</div><div>${esc(c.label)}<br><small>${c.issues} problemi${c.partial ? ' · parziale (senza PageSpeed)' : ''}</small></div></div>`)
    .join('');
  const issues = r.issues
    .map(
      (i, n) => `<details ${i.severity === 'critical' || i.severity === 'high' ? 'open' : ''}>
  <summary><span class="sev" style="background:${SEV_COLOR[i.severity]}">${SEV_LABEL[i.severity]}</span> <b>${n + 1}. ${esc(i.title)}</b> <small>· ${esc(CATEGORIES[i.category])} · sforzo ${i.effort} · ${esc(affectedText(i))}</small></summary>
  <div class="body">
    <p><b>Come risolvere:</b> ${esc(i.fix)}</p>
    ${i.examples.length ? `<p><b>Esempi:</b> ${i.examples.map(esc).join(' | ')}</p>` : ''}
    ${i.affected.length ? `<p><b>Pagine:</b> ${i.affected.slice(0, 8).map((u) => `<code>${esc(u)}</code>`).join(' ')}${i.affected.length > 8 ? ` … +${i.affected.length - 8}` : ''}</p>` : ''}
  </div>
</details>`
    )
    .join('');
  const diff = r.diff
    ? `<p class="diff">Rispetto al ${esc(r.diff.previousDate)}: punteggio <b>${r.diff.scoreDelta >= 0 ? '+' : ''}${r.diff.scoreDelta}</b> · nuovi: ${esc(r.diff.newIssues.join(', ') || 'nessuno')} · risolti: ${esc(r.diff.resolvedIssues.join(', ') || 'nessuno')}</p>`
    : '';
  const psi = r.psi && r.psi.length
    ? `<h2>PageSpeed Insights (mobile)</h2><table>${r.psi.map((p) => `<tr><td>${esc(p.url)}</td><td>perf ${p.summary.scores.performance}</td><td>SEO ${p.summary.scores.seo}</td><td>LCP ${p.summary.lab.lcpMs}ms</td><td>TBT ${p.summary.lab.tbtMs}ms</td><td>CLS ${p.summary.lab.cls}</td></tr>`).join('')}</table>`
    : '';
  const pages = r.pages
    .map((p) => `<tr><td><code>${esc(p.path)}</code></td><td>${p.status}</td><td>${p.ttfbMs ?? '-'}ms</td><td>${Math.round(p.bytes / 1024)}KB</td><td>${esc(p.issueIds.join(', ') || '—')}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Report SEO — ${esc(r.baseUrl)}</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#111827;--mut:#6b7280;--line:#e5e7eb;--card:#f9fafb}
@media(prefers-color-scheme:dark){:root{--bg:#0b0f17;--fg:#e5e7eb;--mut:#9ca3af;--line:#1f2937;--card:#111827}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 64px}h1{margin:0 0 4px;font-size:22px}h2{margin-top:36px}small,.mut{color:var(--mut)}
.hero{display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin:20px 0}.big{font-size:64px;font-weight:900;line-height:1;color:${gradeColor}}
.cats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.cat{display:flex;gap:12px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.cs{font-size:28px;font-weight:800}
details{border:1px solid var(--line);border-radius:12px;margin:10px 0;background:var(--card)}summary{padding:12px 14px;cursor:pointer}.body{padding:0 14px 12px}
.sev{color:#fff;font-size:11px;font-weight:800;padding:2px 8px;border-radius:99px;letter-spacing:.04em}code{background:var(--line);padding:1px 5px;border-radius:4px;font-size:12px;word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}.diff{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
</style></head><body><main>
<h1>Report SEO / AEO</h1><div class="mut">${esc(r.baseUrl)} · ${esc(r.generatedAt)} · ${r.pagesChecked} pagine analizzate</div>
<div class="hero"><div class="big">${r.score.overall}</div><div><b>Voto ${r.score.grade}</b><br><span class="mut">punteggio complessivo su 100</span></div></div>
<div class="cats">${cats}</div>${diff}
<h2>Da fare, in ordine di priorità</h2><p class="mut">Gravità, poi sforzo minore, poi diffusione.</p>${issues}
${psi}${r.notes.length ? `<h2>Note</h2><ul>${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
<h2>Pagine analizzate</h2><table><tr><th>URL</th><th>Stato</th><th>TTFB</th><th>Peso</th><th>Problemi</th></tr>${pages}</table>
</main></body></html>`;
}

module.exports = { renderMarkdown, renderHtml };
