// Tests for the SEO audit engine (scripts/seo-audit). Everything here is pure: HTML/response fixtures
// in, findings out. No network and no database.
const { parseHtml, jsonLdNodes } = require('../scripts/seo-audit/lib/htmlParse');
const { checkPage, compareBotView, normalizeUrl } = require('../scripts/seo-audit/lib/pageChecks');
const S = require('../scripts/seo-audit/lib/siteChecks');
const { buildIssues, scoreIssues, grade, diffRuns } = require('../scripts/seo-audit/lib/score');
const { CATALOG, CATEGORY_WEIGHT } = require('../scripts/seo-audit/lib/catalog');
const { summarizePsi, psiIssues } = require('../scripts/seo-audit/lib/psi');
const { renderMarkdown, renderHtml } = require('../scripts/seo-audit/lib/report');
const { toBaseUrl, parseArgs } = require('../scripts/seo-audit/index');

const BASE = 'https://cardbrix.com';
const words = (n) => Array.from({ length: n }, (_, i) => `parola${i}`).join(' ');
const links = (n) => Array.from({ length: n }, (_, i) => `<a href="/p${i}">p${i}</a>`).join('');

function goodHtml({ path = '/', extra = '', title = 'CardBrix - Marketplace LEGO, carte e Funko online', head = '' } = {}) {
  return `<!doctype html><html lang="it"><head><title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Compra, vendi e fai offerte su LEGO, carte collezionabili e Funko nel marketplace italiano CardBrix.">
<link rel="canonical" href="${BASE}${path === '/' ? '' : path}">
<meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:image" content="https://cardbrix.com/x.jpg">
<meta name="twitter:card" content="summary_large_image">${head}</head>
<body><h1>Titolo</h1><p>${words(200)}</p>${links(8)}${extra}</body></html>`;
}

const res = (over = {}) => ({ url: `${BASE}/`, finalUrl: `${BASE}/`, status: 200, chain: [], headers: { 'content-encoding': 'br' }, bytes: 50000, ttfbMs: 200, error: null, ...over });
const run = (html, over = {}, url = `${BASE}/`) => {
  const r = res({ url, finalUrl: url, ...over });
  return checkPage(r, parseHtml(html), { baseUrl: BASE }).map((i) => i.id);
};

describe('htmlParse', () => {
  test('extracts head, headings, images, anchors, JSON-LD and word count', () => {
    const p = parseHtml(`<html lang="it"><head><title> A &amp; B </title>
      <meta name="description" content="desc"><meta name="robots" content="noindex,follow">
      <link rel="canonical" href="https://x.it/a"><link rel="alternate" hreflang="en" href="https://x.it/en">
      <script type="application/ld+json">{"@type":"Product","name":"n"}</script>
      <script type="application/ld+json">{oops</script></head>
      <body><h1>Uno</h1><h1>Due</h1><h2>x</h2><img src="a.jpg" alt="a"><img src="b.jpg"><a href="/x" rel="nofollow">x</a>
      <script>var ignored = "non contare queste parole";</script><p>una due tre</p><!-- nascosto --></body></html>`);
    expect(p.title).toBe('A & B');
    expect(p.description).toBe('desc');
    expect(p.robotsMeta).toBe('noindex,follow');
    expect(p.canonical).toBe('https://x.it/a');
    expect(p.hreflangs).toEqual([{ lang: 'en', href: 'https://x.it/en' }]);
    expect(p.lang).toBe('it');
    expect(p.headings.h1).toEqual(['Uno', 'Due']);
    expect(p.images).toEqual([{ src: 'a.jpg', alt: 'a' }, { src: 'b.jpg', alt: null }]);
    expect(p.anchors[0]).toEqual({ href: '/x', rel: 'nofollow' });
    expect(p.jsonLd[0].parsed['@type']).toBe('Product');
    expect(p.jsonLd[1].error).toBeTruthy();
    expect(p.wordCount).toBeLessThan(12); // script content and comments are not visible text
  });

  test('missing things are null, not empty strings', () => {
    const p = parseHtml('<html><body>ciao</body></html>');
    expect(p.title).toBeNull();
    expect(p.description).toBeNull();
    expect(p.canonical).toBeNull();
    expect(p.lang).toBeNull();
  });

  test('jsonLdNodes flattens @graph and arrays', () => {
    const nodes = jsonLdNodes([{ parsed: { '@graph': [{ '@type': 'Organization' }, { '@type': ['WebSite', 'Thing'] }] }, error: null }, { parsed: [{ '@type': 'Product' }], error: null }]);
    expect(nodes.map((n) => [].concat(n['@type']).join('/'))).toEqual(['Organization', 'WebSite/Thing', 'Product']);
  });
});

describe('pageChecks', () => {
  test('a healthy page raises no critical/high issue', () => {
    expect(run(goodHtml())).toEqual([]);
  });

  test('HTTP error and fetch failure short-circuit', () => {
    expect(run('', { status: 500 })).toEqual(['http-error']);
    expect(run('', { status: 0, error: 'timeout' })).toEqual(['fetch-failed']);
  });

  test('redirect in sitemap is flagged', () => {
    expect(run(goodHtml(), { chain: [{ url: 'x', status: 301 }] })).toContain('redirect-chain');
  });

  test('title and description problems', () => {
    expect(run(goodHtml().replace(/<title>.*<\/title>/, ''))).toContain('title-missing');
    expect(run(goodHtml({ title: 'Corto' }))).toContain('title-length');
    expect(run(goodHtml().replace(/<meta name="description"[^>]*>/, ''))).toContain('desc-missing');
  });

  test('canonical: missing, mismatch, off-site; trailing slash and query are tolerated', () => {
    expect(run(goodHtml().replace(/<link rel="canonical"[^>]*>/, ''))).toContain('canonical-missing');
    expect(run(goodHtml({ path: '/aste' }), {}, `${BASE}/annunci`)).toContain('canonical-mismatch');
    expect(run(goodHtml().replace(BASE, 'https://altro.it'))).toContain('canonical-offsite');
    expect(run(goodHtml({ path: '/aste' }).replace('/aste"', '/aste/?x=1"'), {}, `${BASE}/aste`)).not.toContain('canonical-mismatch');
  });

  test('noindex via meta or X-Robots-Tag', () => {
    expect(run(goodHtml({ head: '<meta name="robots" content="noindex">' }))).toContain('noindex');
    expect(run(goodHtml(), { headers: { 'x-robots-tag': 'noindex', 'content-encoding': 'br' } })).toContain('noindex');
  });

  test('missing h1, lang, viewport, og, twitter card, alt text', () => {
    const html = goodHtml({ extra: '<img src="a.jpg">' }).replace('<h1>Titolo</h1>', '').replace(' lang="it"', '').replace(/<meta name="viewport"[^>]*>/, '').replace(/<meta property="og:image"[^>]*>/, '').replace(/<meta name="twitter:card"[^>]*>/, '');
    expect(run(html)).toEqual(expect.arrayContaining(['h1-missing', 'lang-missing', 'viewport-missing', 'og-incomplete', 'twitter-card-missing', 'img-alt-missing']));
  });

  test('invalid JSON-LD is critical-level', () => {
    expect(run(goodHtml({ head: '<script type="application/ld+json">{nope</script>' }))).toContain('jsonld-invalid');
  });

  describe('product pages', () => {
    const url = `${BASE}/product/42`;
    const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
    const okProduct = { '@type': 'Product', name: 'n', image: 'i', brand: { name: 'LEGO' }, sku: 's', offers: { price: '1.00', priceCurrency: 'EUR', availability: 'x', itemCondition: 'y' } };

    test('missing Product schema and breadcrumb', () => {
      const ids = run(goodHtml({ path: '/product/42' }), {}, url);
      expect(ids).toEqual(expect.arrayContaining(['product-schema-missing', 'breadcrumb-missing']));
    });

    test('incomplete Product lists the missing fields', () => {
      const r = checkPage(res({ url, finalUrl: url }), parseHtml(goodHtml({ path: '/product/42', head: ld({ '@type': 'Product', name: 'n', offers: { price: '1' } }) })), { baseUrl: BASE });
      const inc = r.find((i) => i.id === 'product-schema-incomplete');
      expect(inc.detail).toMatch(/image.*offers\.priceCurrency.*offers\.availability/);
    });

    test('complete Product + BreadcrumbList is clean', () => {
      const head = ld(okProduct) + ld({ '@type': 'BreadcrumbList' });
      expect(run(goodHtml({ path: '/product/42', head }), {}, url)).toEqual([]);
    });

    test('recommended fields are a low-severity nudge', () => {
      const head = ld({ ...okProduct, brand: undefined, sku: undefined }) + ld({ '@type': 'BreadcrumbList' });
      expect(run(goodHtml({ path: '/product/42', head }), {}, url)).toEqual(['product-schema-recommended']);
    });
  });

  test('SPA shell: thin raw HTML and no internal links (what a non-JS/AI crawler sees)', () => {
    const shell = '<!doctype html><html lang="it"><head><title>CardBrix - Marketplace LEGO, carte e Funko online</title></head><body><div id="root"></div><script src="/a.js"></script></body></html>';
    expect(run(shell)).toEqual(expect.arrayContaining(['raw-html-thin', 'no-internal-links-raw']));
  });

  test('performance signals', () => {
    expect(run(goodHtml(), { ttfbMs: 1200 })).toContain('slow-ttfb');
    expect(run(goodHtml(), { bytes: 400 * 1024 })).toContain('heavy-html');
    expect(run(goodHtml(), { headers: {} })).toContain('no-compression');
  });

  test('compareBotView detects status/title/canonical divergence', () => {
    const mk = (status, title, canonical) => ({ status, parsed: { title, canonical } });
    expect(compareBotView(mk(200, 'a', `${BASE}/`), mk(200, 'a', `${BASE}/`), BASE)).toBeNull();
    expect(compareBotView(mk(200, 'a', `${BASE}/`), mk(403, 'a', `${BASE}/`), BASE)).toMatch(/status/);
    expect(compareBotView(mk(200, 'a', `${BASE}/`), mk(200, 'b', `${BASE}/`), BASE)).toMatch(/title/);
    expect(compareBotView(mk(200, 'a', `${BASE}/x`), mk(200, 'a', `${BASE}/y`), BASE)).toMatch(/canonical/);
  });

  test('normalizeUrl ignores trailing slash, query, hash and host case', () => {
    expect(normalizeUrl('https://CardBrix.com/aste/?a=1#x')).toBe('https://cardbrix.com/aste');
    expect(normalizeUrl('/', BASE)).toBe('https://cardbrix.com/');
  });
});

describe('siteChecks', () => {
  const robotsTxt = 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: https://cardbrix.com/sitemap.xml\n';
  const textRes = (body, over = {}) => ({ status: 200, headers: { 'content-type': 'text/plain' }, body, chain: [], finalUrl: BASE, url: BASE, ...over });

  test('robots parsing: groups, longest match, allow beats disallow on ties', () => {
    const r = S.parseRobots(robotsTxt);
    expect(r.sitemaps).toEqual(['https://cardbrix.com/sitemap.xml']);
    expect(S.robotsAllows(r, '/annunci')).toBe(true);
    expect(S.robotsAllows(r, '/admin/users')).toBe(false);
    expect(S.robotsAllows(r, '/', 'GPTBot')).toBe(false);
    const tie = S.parseRobots('User-agent: *\nDisallow: /a\nAllow: /a\n');
    expect(S.robotsAllows(tie, '/a')).toBe(true);
    const longer = S.parseRobots('User-agent: *\nDisallow: /a\nAllow: /a/public\n');
    expect(S.robotsAllows(longer, '/a/public/x')).toBe(true);
    expect(S.robotsAllows(longer, '/a/private')).toBe(false);
    expect(S.robotsAllows(S.parseRobots('User-agent: *\nDisallow:\n'), '/x')).toBe(true);
  });

  test('checkRobots: healthy, blocks-all, no sitemap, blocked sitemap URLs, AI crawlers', () => {
    const ok = S.checkRobots(textRes(robotsTxt), ['/annunci']);
    expect(ok.issues.map((i) => i.id)).toEqual(['ai-crawlers-blocked']);
    expect(S.checkRobots(textRes('User-agent: *\nDisallow: /\n'), []).issues.map((i) => i.id)).toEqual(expect.arrayContaining(['robots-blocks-all', 'robots-no-sitemap']));
    expect(S.checkRobots(textRes(robotsTxt), ['/admin']).issues.map((i) => i.id)).toContain('robots-blocks-sitemap-urls');
    expect(S.checkRobots({ status: 200, headers: { 'content-type': 'text/html' }, body: '<html>' }).issues[0].id).toBe('robots-missing');
    expect(S.checkRobots({ status: 404, headers: {}, body: '' }).issues[0].id).toBe('robots-missing');
  });

  test('sitemap parsing and checks', () => {
    const xml = '<?xml version="1.0"?><urlset xmlns="x"><url><loc>https://cardbrix.com/</loc></url><url><loc>https://cardbrix.com/a?x=1&amp;y=2</loc><lastmod>2026-01-01</lastmod></url></urlset>';
    const p = S.parseSitemap(xml);
    expect(p.urls).toEqual([{ loc: 'https://cardbrix.com/', lastmod: null }, { loc: 'https://cardbrix.com/a?x=1&y=2', lastmod: '2026-01-01' }]);
    const ok = S.checkSitemap({ status: 200, headers: { 'content-type': 'application/xml' }, body: xml });
    expect(ok.issues).toEqual([]); // 1 of 2 URLs has lastmod = exactly the threshold
    const sparse = xml.replace('<lastmod>2026-01-01</lastmod>', '');
    expect(S.checkSitemap({ status: 200, headers: { 'content-type': 'application/xml' }, body: sparse }).issues[0].id).toBe('sitemap-no-lastmod');
    expect(S.checkSitemap({ status: 200, headers: { 'content-type': 'text/html' }, body: '<html>' }).issues[0].id).toBe('sitemap-missing');
    expect(S.checkSitemap({ status: 200, headers: { 'content-type': 'application/xml' }, body: '<urlset></urlset>' }).issues[0].id).toBe('sitemap-empty');
    expect(S.parseSitemap('<sitemapindex><sitemap><loc>https://x/a.xml</loc></sitemap></sitemapindex>').isIndex).toBe(true);
  });

  test('llms.txt: SPA fallback (HTML with 200) counts as missing; markdown counts as present', () => {
    expect(S.checkLlms({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: '<!doctype html>' })[0].id).toBe('llms-missing');
    expect(S.checkLlms({ status: 404, headers: {}, body: '' })[0].id).toBe('llms-missing');
    expect(S.checkLlms({ status: 200, headers: { 'content-type': 'text/plain' }, body: '# CardBrix\n> x' })).toEqual([]);
  });

  test('IndexNow: unverifiable without key, verified with key', () => {
    expect(S.checkIndexNow(null, null).note).toMatch(/non verificabile/);
    expect(S.checkIndexNow('abcdefgh12', textRes('abcdefgh12\n')).issues).toEqual([]);
    expect(S.checkIndexNow('abcdefgh12', { status: 200, body: '<html>' }).issues[0].id).toBe('indexnow-missing');
    expect(S.checkIndexNow('abcdefgh12', { status: 404, body: '' }).issues[0].id).toBe('indexnow-missing');
  });

  test('soft-404, https redirect, security headers, hreflang', () => {
    expect(S.checkSoft404({ status: 200, url: 'u' })[0].id).toBe('soft-404');
    expect(S.checkSoft404({ status: 404 })).toEqual([]);
    expect(S.checkHttpsRedirect({ status: 200, chain: [{ status: 301 }], finalUrl: 'https://cardbrix.com/' })).toEqual([]);
    expect(S.checkHttpsRedirect({ status: 200, chain: [], finalUrl: 'http://cardbrix.com/' })[0].id).toBe('https-redirect-missing');
    expect(S.checkSecurityHeaders({}).map((i) => i.id)).toEqual(['sec-hsts-missing', 'sec-csp-missing', 'sec-xcto-missing', 'sec-referrer-missing', 'sec-frame-missing']);
    expect(S.checkSecurityHeaders({ 'strict-transport-security': 'x', 'content-security-policy': "frame-ancestors 'self'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'x' })).toEqual([]);
    expect(S.checkHreflang(5, { hreflangs: [] })[0].id).toBe('hreflang-missing');
    expect(S.checkHreflang(5, { hreflangs: [{ lang: 'en' }] })).toEqual([]);
    expect(S.checkHreflang(1, { hreflangs: [] })).toEqual([]);
  });

  test('duplicate titles/descriptions across pages', () => {
    const pg = (p, title, description) => ({ url: `${BASE}${p}`, parsed: { title, description } });
    const dups = S.checkDuplicates([pg('/', 'Uguale', 'd1'), pg('/a', 'Uguale', 'd2'), pg('/b', 'Diverso', 'd3')]);
    expect(dups).toHaveLength(1);
    expect(dups[0]).toMatchObject({ id: 'title-duplicate', urls: ['/', '/a'] });
  });
});

describe('score', () => {
  test('every catalog entry is complete and every id used by checks exists', () => {
    for (const [id, m] of Object.entries(CATALOG)) {
      expect(m.title && m.fix && m.category && m.severity && m.effort).toBeTruthy();
      expect(CATEGORY_WEIGHT[m.category]).toBeGreaterThan(0);
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
    expect(Object.values(CATEGORY_WEIGHT).reduce((a, b) => a + b, 0)).toBe(100);
  });

  test('buildIssues groups by id and weights by how widespread the problem is', () => {
    const findings = [
      { id: 'title-length', url: 'a', detail: 'x' },
      { id: 'title-length', url: 'b', detail: 'y' },
      { id: 'llms-missing', url: null },
    ];
    const issues = buildIssues(findings, 4);
    const tl = issues.find((i) => i.id === 'title-length');
    expect(tl.affectedCount).toBe(2);
    expect(tl.ratio).toBe(0.5);
    expect(tl.penalty).toBe(2.3); // low = 3 points, ratio 0.5 -> 3 * (0.5 + 0.5 * 0.5) = 2.25, rounded to 1 decimal
    expect(issues.find((i) => i.id === 'llms-missing').siteWide).toBe(true);
    expect(() => buildIssues([{ id: 'inventato', url: null }], 1)).toThrow(/Unknown issue id/);
  });

  test('issues are ordered by severity, then effort, then spread', () => {
    const issues = buildIssues([
      { id: 'title-length', url: 'a' }, // low S
      { id: 'noindex', url: 'a' }, // critical S
      { id: 'raw-html-thin', url: 'a' }, // high L
      { id: 'desc-missing', url: 'a' }, // high S
    ], 1);
    expect(issues.map((i) => i.id)).toEqual(['noindex', 'desc-missing', 'raw-html-thin', 'title-length']);
  });

  test('scoring: perfect site = 100; a weak area is visible but does not zero the whole score', () => {
    expect(scoreIssues([]).overall).toBe(100);
    const s = scoreIssues(buildIssues([{ id: 'noindex', url: null }, { id: 'robots-blocks-all', url: null }, { id: 'soft-404', url: null }], 1));
    expect(s.categories.indexability.score).toBe(24); // 100 - 30 (noindex) - 30 (robots) - 16 (soft-404)
    expect(s.categories.performance.score).toBe(100);
    expect(s.overall).toBeGreaterThan(0);
  });

  test('an open critical issue caps the overall score; without one the weighted average stands', () => {
    const critical = scoreIssues(buildIssues([{ id: 'noindex', url: null }], 1));
    expect(critical.categories.indexability.score).toBe(70);
    expect(critical.overall).toBe(55); // weighted average would be 92
    expect(critical.capped).toBe(true);
    const onlyHigh = scoreIssues(buildIssues([{ id: 'soft-404', url: null }], 1));
    expect(onlyHigh.capped).toBe(false);
    expect(onlyHigh.overall).toBe(96); // indexability 84 * 25% + 75 * 100%
  });

  test('grade thresholds and run diff', () => {
    expect([95, 80, 65, 45, 10].map(grade)).toEqual(['A', 'B', 'C', 'D', 'E']);
    const prev = { generatedAt: 'p', score: { overall: 60 }, issues: [{ id: 'a' }, { id: 'b' }] };
    const curr = { score: { overall: 70 }, issues: [{ id: 'b' }, { id: 'c' }] };
    expect(diffRuns(prev, curr)).toEqual({ previousDate: 'p', scoreDelta: 10, newIssues: ['c'], resolvedIssues: ['a'] });
    expect(diffRuns(null, curr)).toBeNull();
  });
});

describe('psi', () => {
  const json = (perf) => ({ lighthouseResult: { categories: { performance: { score: perf }, seo: { score: 0.9 }, accessibility: { score: 0.8 }, 'best-practices': { score: 1 } },
    audits: { 'largest-contentful-paint': { numericValue: 3100.4 }, 'first-contentful-paint': { numericValue: 1200 }, 'total-blocking-time': { numericValue: 250 }, 'cumulative-layout-shift': { numericValue: 0.12345 }, 'speed-index': { numericValue: 2800 } } } });

  test('summarizePsi extracts scores and lab metrics', () => {
    const s = summarizePsi(json(0.62));
    expect(s.scores).toEqual({ performance: 62, seo: 90, accessibility: 80, bestPractices: 100 });
    expect(s.lab).toMatchObject({ lcpMs: 3100, tbtMs: 250, cls: 0.123 });
    expect(summarizePsi({})).toBeNull();
  });

  test('thresholds: <50 poor, <90 needs work, otherwise fine', () => {
    expect(psiIssues(summarizePsi(json(0.3)), 'u')[0].id).toBe('psi-poor');
    expect(psiIssues(summarizePsi(json(0.7)), 'u')[0].id).toBe('psi-needs-work');
    expect(psiIssues(summarizePsi(json(0.95)), 'u')).toEqual([]);
  });
});

describe('report and cli helpers', () => {
  const issues = buildIssues([{ id: 'soft-404', url: null, detail: '<b>x</b>' }, { id: 'title-duplicate', url: null, urls: ['/', '/a'], detail: 'dup' }], 2);
  const report = { generatedAt: '2026-09-23T10:00:00Z', baseUrl: BASE, pagesChecked: 2, score: { overall: 70, grade: 'C', ...{ categories: scoreIssues(issues).categories } },
    issues, notes: ['una nota'], psi: [], pages: [{ path: '/', status: 200, ttfbMs: 100, bytes: 2048, issueIds: ['title-duplicate'] }], diff: null };

  test('markdown lists issues in order with the fix', () => {
    const md = renderMarkdown(report);
    expect(md).toContain('Punteggio complessivo: **70/100**');
    expect(md.indexOf('pagine inesistenti')).toBeGreaterThan(-1);
    expect(md).toContain('**Come risolvere**');
  });

  test('performance area is labelled partial when PageSpeed data is missing', () => {
    const partial = { ...report, score: { ...report.score, categories: { ...report.score.categories, performance: { ...report.score.categories.performance, partial: true } } } };
    expect(renderMarkdown(partial)).toContain('parziale');
    expect(renderHtml(partial)).toContain('parziale (senza PageSpeed)');
    expect(renderMarkdown(report)).not.toContain('parziale');
  });

  test('html escapes finding details', () => {
    const html = renderHtml(report);
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>x</b>');
  });

  test('sitemap URLs are re-based on the audited host, so a local audit never hits production', () => {
    expect(toBaseUrl('https://cardbrix.com/product/1?a=b', 'http://localhost:3000')).toBe('http://localhost:3000/product/1?a=b');
    expect(parseArgs(['--base=http://localhost:3000/', '--listings=3', '--psi', '--fail-under=70'])).toMatchObject({ base: 'http://localhost:3000', listings: 3, psi: true, failUnder: 70 });
  });
});
