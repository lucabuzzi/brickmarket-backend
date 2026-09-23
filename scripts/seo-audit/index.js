#!/usr/bin/env node
// CardBrix SEO / AEO audit agent.
//
//   npm run seo:audit                                  # audits https://cardbrix.com
//   npm run seo:audit -- --base=http://localhost:3000  # audits a local server
//   npm run seo:audit -- --psi --listings=15 --fail-under=70
//
// Read-only: it only issues GET requests to the audited host (it refuses any other host), never
// touches the database, and writes reports under reports/seo/<timestamp>/ (report.md, report.html,
// report.json) plus reports/seo/latest.json, which the next run diffs against.
const fs = require('fs');
const path = require('path');
const { makeFetcher, pool, UA_GOOGLEBOT } = require('./lib/fetcher');
const { parseHtml } = require('./lib/htmlParse');
const { checkPage, compareBotView } = require('./lib/pageChecks');
const S = require('./lib/siteChecks');
const { buildIssues, scoreIssues, grade, diffRuns } = require('./lib/score');
const { runPsi, summarizePsi, psiIssues } = require('./lib/psi');
const { renderMarkdown, renderHtml } = require('./lib/report');

function parseArgs(argv) {
  const opts = { base: 'https://cardbrix.com', listings: 8, max: 60, delay: 150, concurrency: 3, psi: false, out: path.join(__dirname, '..', '..', 'reports', 'seo'), failUnder: null, indexnowKey: process.env.INDEXNOW_KEY || null };
  for (const a of argv) {
    const [k, v] = a.replace(/^--/, '').split('=');
    if (k === 'base') opts.base = v.replace(/\/+$/, '');
    else if (k === 'listings') opts.listings = Number(v);
    else if (k === 'max') opts.max = Number(v);
    else if (k === 'delay') opts.delay = Number(v);
    else if (k === 'concurrency') opts.concurrency = Number(v);
    else if (k === 'out') opts.out = path.resolve(v);
    else if (k === 'fail-under') opts.failUnder = Number(v);
    else if (k === 'indexnow-key') opts.indexnowKey = v;
    else if (k === 'psi') opts.psi = true;
  }
  return opts;
}

/** Sitemap <loc> values may point at the production host even when auditing localhost: keep only the path. */
const toBaseUrl = (loc, base) => {
  const u = new URL(loc);
  return `${base}${u.pathname}${u.search}`;
};

function localeCount() {
  try {
    return fs.readdirSync(path.join(__dirname, '..', '..', 'client', 'src', 'locales')).filter((f) => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const base = opts.base;
  const isLocal = /localhost|127\.0\.0\.1/.test(base);
  const fetcher = makeFetcher({ baseUrl: base, delayMs: opts.delay });
  const findings = [];
  const notes = [];
  const add = (list, url = null) => list.forEach((f) => findings.push({ ...f, url: f.urls ? null : url }));
  const log = (m) => console.log(m);

  log(`SEO audit → ${base}`);

  // ---- robots + sitemap (sitemap index: follow one level)
  const robotsRes = await fetcher.get(`${base}/robots.txt`);
  let sitemapRes = await fetcher.get(`${base}/sitemap.xml`);
  let { issues: smIssues, sitemap } = S.checkSitemap(sitemapRes);
  if (sitemap.isIndex) {
    const all = [];
    for (const child of sitemap.urls.slice(0, 10)) {
      const r = await fetcher.get(toBaseUrl(child.loc, base));
      all.push(...S.parseSitemap(r.body).urls);
    }
    sitemap = { isIndex: false, urls: all };
    smIssues = smIssues.filter((i) => i.id !== 'sitemap-empty');
    if (!all.length) smIssues.push({ id: 'sitemap-empty' });
  }
  add(smIssues);
  log(`sitemap: ${sitemap.urls.length} URL`);

  // ---- sample pages: every non-listing URL, plus a few listings
  const paths = sitemap.urls.map((u) => new URL(u.loc).pathname);
  const isListing = (p) => /^\/product\//.test(p);
  const staticPaths = [...new Set(paths.filter((p) => !isListing(p)))];
  const listingPaths = paths.filter(isListing).slice(0, opts.listings);
  const sample = [...new Set(['/', ...staticPaths, ...listingPaths])].slice(0, opts.max);
  if (paths.length > sample.length) notes.push(`Campione di ${sample.length} pagine su ${paths.length} in sitemap (usa --max e --listings per allargarlo).`);
  if (!listingPaths.length) notes.push('Nessun annuncio in sitemap: i controlli sullo schema Product non sono stati eseguiti.');

  const robotsCheck = S.checkRobots(robotsRes, sample);
  add(robotsCheck.issues);

  // ---- fetch + check pages
  log(`analizzo ${sample.length} pagine…`);
  const pages = await pool(sample, opts.concurrency, async (p) => {
    const res = await fetcher.get(`${base}${p}`);
    const parsed = parseHtml(res.body);
    return { path: p, url: `${base}${p}`, ...res, parsed };
  });

  // Googlebot vs browser on a small subset (cloaking / bot-specific rendering)
  const botSubset = pages.filter((p) => p.status === 200).slice(0, 6);
  const botViews = await pool(botSubset, opts.concurrency, async (p) => {
    const res = await fetcher.get(p.url, { ua: UA_GOOGLEBOT });
    return { p, bot: { ...res, parsed: parseHtml(res.body) } };
  });
  botViews.forEach(({ p, bot }) => {
    const diff = compareBotView(p, bot, base);
    if (diff) findings.push({ id: 'bot-difference', url: p.url, detail: `${p.path}: ${diff}` });
  });

  const pageIssues = new Map();
  for (const p of pages) {
    const list = checkPage(p, p.parsed, { baseUrl: base });
    pageIssues.set(p.path, list.map((i) => i.id));
    list.forEach((i) => findings.push({ ...i, url: p.url }));
  }
  add(S.checkDuplicates(pages.filter((p) => p.status === 200)));

  // ---- site-level probes
  const home = pages.find((p) => p.path === '/');
  if (home && home.status === 200) {
    add(S.checkSecurityHeaders(home.headers));
    add(S.checkHreflang(localeCount(), home.parsed));
  }
  add(S.checkLlms(await fetcher.get(`${base}/llms.txt`)));
  const inKey = opts.indexnowKey;
  const inRes = inKey ? await fetcher.get(`${base}/${inKey}.txt`) : null;
  const inCheck = S.checkIndexNow(inKey, inRes);
  add(inCheck.issues);
  if (inCheck.note) notes.push(inCheck.note);
  add(S.checkSoft404(await fetcher.get(`${base}/pagina-che-non-esiste-${Date.now().toString(36)}`)));
  if (!isLocal && base.startsWith('https://')) {
    add(S.checkHttpsRedirect(await fetcher.get(base.replace('https://', 'http://') + '/', { maxRedirects: 3 })));
  }

  // ---- PageSpeed Insights (optional)
  const psi = [];
  if (opts.psi) {
    const targets = ['/', ...listingPaths.slice(0, 1)];
    for (const t of targets) {
      const url = `${base}${t}`;
      try {
        log(`PageSpeed Insights: ${url} (può richiedere un minuto)…`);
        const summary = summarizePsi(await runPsi(url, { apiKey: process.env.PSI_API_KEY }));
        if (summary) {
          psi.push({ url, summary });
          add(psiIssues(summary, url).map((i) => ({ ...i, url: undefined })), url);
        }
      } catch (err) {
        notes.push(`PageSpeed Insights non disponibile per ${url}: ${err.message}${/429/.test(err.message) ? ' (limite di Google senza chiave: imposta PSI_API_KEY, è gratuita)' : ''}`);
      }
    }
  } else {
    notes.push('PageSpeed Insights / Core Web Vitals non misurati: rilancia con --psi.');
  }

  // ---- score + report
  const issues = buildIssues(findings, pages.length);
  const overall = scoreIssues(issues);
  // Without PageSpeed data the Performance area only reflects TTFB/size/compression: say so instead of showing a proud 100.
  if (!psi.length) overall.categories.performance.partial = true;
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: base,
    options: { listings: opts.listings, max: opts.max, psi: opts.psi },
    pagesChecked: pages.length,
    score: { overall: overall.overall, grade: grade(overall.overall), categories: overall.categories },
    issues,
    notes,
    psi,
    pages: pages.map((p) => ({ path: p.path, status: p.status, ttfbMs: p.ttfbMs, bytes: p.bytes, issueIds: pageIssues.get(p.path) || [] })),
  };

  fs.mkdirSync(opts.out, { recursive: true });
  const latestPath = path.join(opts.out, 'latest.json');
  let previous = null;
  try { previous = JSON.parse(fs.readFileSync(latestPath, 'utf8')); } catch { /* first run */ }
  report.diff = diffRuns(previous && previous.baseUrl === base ? previous : null, report);

  const stamp = report.generatedAt.replace(/[:T]/g, '-').slice(0, 16);
  const dir = path.join(opts.out, stamp);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(dir, 'report.md'), renderMarkdown(report));
  fs.writeFileSync(path.join(dir, 'report.html'), renderHtml(report));
  fs.writeFileSync(latestPath, JSON.stringify(report));

  log('');
  log(`PUNTEGGIO: ${report.score.overall}/100 (voto ${report.score.grade})`);
  Object.values(report.score.categories).forEach((c) => log(`  ${c.label.padEnd(30)} ${String(c.score).padStart(3)}/100  (${c.issues} problemi)`));
  log('');
  issues.filter((i) => i.severity !== 'info').slice(0, 8).forEach((i, n) => log(`  ${n + 1}. [${i.severity.toUpperCase()}] ${i.title} — ${i.siteWide && !i.affectedCount ? 'sito' : i.affectedCount + ' pagine'}`));
  log('');
  log(`Report: ${path.relative(process.cwd(), dir)}${path.sep}report.html`);

  if (opts.failUnder != null && report.score.overall < opts.failUnder) process.exit(2);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('SEO audit fallito:', err.message);
    process.exit(1);
  });
}

module.exports = { parseArgs, toBaseUrl };
