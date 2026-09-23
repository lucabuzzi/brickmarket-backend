// Site-level checks (robots, sitemap, llms.txt, IndexNow, soft-404, HTTPS, security headers, duplicates).
// Pure like pageChecks: they receive already-fetched responses and return { id, detail, urls? } lists.
const { normalizeUrl } = require('./pageChecks');

const AI_CRAWLERS = ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'PerplexityBot', 'Google-Extended', 'CCBot'];

// ---------------------------------------------------------------- robots.txt
function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === 'sitemap') {
      sitemaps.push(value);
      lastWasAgent = false;
    } else if ((key === 'disallow' || key === 'allow') && current) {
      current.rules.push({ type: key, path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return { groups, sitemaps };
}

/** Longest-match wins; Allow beats Disallow on a tie. Group chosen: exact agent, else "*". */
function robotsAllows(robots, pathname, agent = '*') {
  const a = agent.toLowerCase();
  const group = robots.groups.find((g) => g.agents.includes(a)) || robots.groups.find((g) => g.agents.includes('*'));
  if (!group) return true;
  let best = { len: -1, allow: true };
  for (const r of group.rules) {
    if (!r.path) continue; // "Disallow:" (empty) = allow everything
    if (pathname.startsWith(r.path.replace(/\*$/, ''))) {
      const len = r.path.length;
      if (len > best.len || (len === best.len && r.type === 'allow')) best = { len, allow: r.type === 'allow' };
    }
  }
  return best.allow;
}

function checkRobots(res, sitemapPaths = []) {
  const out = [];
  if (!res || res.status !== 200 || /html/i.test(res.headers['content-type'] || '')) {
    out.push({ id: 'robots-missing', detail: res ? `HTTP ${res.status}` : 'non raggiungibile' });
    return { issues: out, robots: null };
  }
  const robots = parseRobots(res.body);
  if (!robots.sitemaps.length) out.push({ id: 'robots-no-sitemap' });
  if (!robotsAllows(robots, '/')) out.push({ id: 'robots-blocks-all' });
  const blocked = sitemapPaths.filter((p) => !robotsAllows(robots, p));
  if (blocked.length) out.push({ id: 'robots-blocks-sitemap-urls', detail: `${blocked.length} URL`, urls: blocked });
  const aiBlocked = AI_CRAWLERS.filter((bot) => robots.groups.some((g) => g.agents.includes(bot.toLowerCase())) && !robotsAllows(robots, '/', bot));
  if (aiBlocked.length) out.push({ id: 'ai-crawlers-blocked', detail: aiBlocked.join(', ') });
  return { issues: out, robots };
}

// ---------------------------------------------------------------- sitemap
function parseSitemap(xml) {
  const isIndex = /<sitemapindex\b/i.test(xml);
  const tag = isIndex ? 'sitemap' : 'url';
  const urls = [];
  for (const m of String(xml || '').matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))) {
    const loc = (m[1].match(/<loc>\s*([^<]+?)\s*<\/loc>/i) || [])[1];
    const lastmod = (m[1].match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/i) || [])[1] || null;
    if (loc) urls.push({ loc: loc.replace(/&amp;/g, '&'), lastmod });
  }
  return { isIndex, urls };
}

function checkSitemap(res) {
  const out = [];
  if (!res || res.status !== 200 || !/xml/i.test(res.headers['content-type'] || '') || !/<(urlset|sitemapindex)\b/i.test(res.body)) {
    out.push({ id: 'sitemap-missing', detail: res ? `HTTP ${res.status}, ${res.headers['content-type'] || 'senza content-type'}` : 'non raggiungibile' });
    return { issues: out, sitemap: { isIndex: false, urls: [] } };
  }
  const sitemap = parseSitemap(res.body);
  if (!sitemap.urls.length) out.push({ id: 'sitemap-empty' });
  else {
    const withMod = sitemap.urls.filter((u) => u.lastmod).length;
    if (withMod / sitemap.urls.length < 0.5) out.push({ id: 'sitemap-no-lastmod', detail: `${withMod}/${sitemap.urls.length} URL con lastmod` });
  }
  return { issues: out, sitemap };
}

// ---------------------------------------------------------------- AEO files
function checkLlms(res) {
  const looksLikeText = res && res.status === 200 && !/html/i.test(res.headers['content-type'] || '') && /^\s*#\s+\S/.test(res.body);
  return looksLikeText ? [] : [{ id: 'llms-missing', detail: res ? `HTTP ${res.status}, ${res.headers['content-type'] || '?'}` : 'non raggiungibile' }];
}

/** Without the key we can only say it's unverifiable; with it we fetch /<key>.txt and compare. */
function checkIndexNow(key, res) {
  if (!key) return { issues: [], note: 'IndexNow non verificabile dall\'esterno senza la chiave: passa --indexnow-key=… per controllarlo.' };
  const ok = res && res.status === 200 && res.body.trim() === key;
  return { issues: ok ? [] : [{ id: 'indexnow-missing', detail: `/${key}.txt non serve la chiave` }], note: null };
}

// ---------------------------------------------------------------- transport & headers
function checkSoft404(res) {
  if (res && res.status === 200) return [{ id: 'soft-404', detail: `${res.url} → HTTP 200` }];
  return [];
}

function checkHttpsRedirect(res) {
  if (!res) return [];
  const first = res.chain[0];
  const ok = first && first.status >= 300 && first.status < 400 && res.finalUrl.startsWith('https://');
  return ok ? [] : [{ id: 'https-redirect-missing', detail: `http:// risponde ${res.status}` }];
}

function checkSecurityHeaders(headers) {
  const out = [];
  if (!headers['strict-transport-security']) out.push({ id: 'sec-hsts-missing' });
  const csp = headers['content-security-policy'] || headers['content-security-policy-report-only'];
  if (!csp) out.push({ id: 'sec-csp-missing' });
  if (!/nosniff/i.test(headers['x-content-type-options'] || '')) out.push({ id: 'sec-xcto-missing' });
  if (!headers['referrer-policy']) out.push({ id: 'sec-referrer-missing' });
  if (!headers['x-frame-options'] && !/frame-ancestors/i.test(csp || '')) out.push({ id: 'sec-frame-missing' });
  return out;
}

function checkHreflang(expectedLanguages, homeParsed) {
  if (!expectedLanguages || expectedLanguages < 2 || !homeParsed) return [];
  return homeParsed.hreflangs.length ? [] : [{ id: 'hreflang-missing', detail: `${expectedLanguages} lingue nell'app, nessun hreflang` }];
}

// ---------------------------------------------------------------- cross-page
/** title-duplicate / desc-duplicate: same text on 2+ pages of the sample. */
function checkDuplicates(pages) {
  const out = [];
  for (const [field, id] of [['title', 'title-duplicate'], ['description', 'desc-duplicate']]) {
    const byText = new Map();
    for (const p of pages) {
      const text = p.parsed && p.parsed[field];
      if (!text) continue;
      if (!byText.has(text)) byText.set(text, []);
      byText.get(text).push(new URL(p.url).pathname);
    }
    const dups = [...byText.entries()].filter(([, urls]) => urls.length > 1);
    if (dups.length) {
      const affected = dups.flatMap(([, urls]) => urls);
      const [text, urls] = dups.sort((a, b) => b[1].length - a[1].length)[0];
      out.push({ id, detail: `"${text.slice(0, 70)}" su ${urls.length} pagine`, urls: affected });
    }
  }
  return out;
}

module.exports = {
  parseRobots, robotsAllows, checkRobots, parseSitemap, checkSitemap, checkLlms, checkIndexNow,
  checkSoft404, checkHttpsRedirect, checkSecurityHeaders, checkHreflang, checkDuplicates, normalizeUrl,
};
