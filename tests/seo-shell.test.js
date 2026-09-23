// Server-rendered content shell (src/services/seoContent): what a crawler WITHOUT JavaScript reads.
// The database module is mocked, so nothing here can reach a real DB.
jest.mock('../src/db', () => ({ query: jest.fn() }));

const fs = require('fs');
const path = require('path');
const { query } = require('../src/db');
const { esc, paragraphs, wordCount } = require('../src/services/seoContent/html');
const copy = require('../src/services/seoContent/copy');
const { cached, clear, MAX_ENTRIES } = require('../src/services/seoContent/cache');
const { pageFor } = require('../src/services/seoContent/pages');
const { fetchListings, listingsBlock, productPage } = require('../src/services/seoContent/listings');
const { injectShell } = require('../src/services/seoContent');
const { renderPage } = require('../src/services/seoMeta');
const { STATIC_PATHS } = require('../src/routes/sitemap');
const { parseHtml } = require('../scripts/seo-audit/lib/htmlParse');
const { checkPage } = require('../scripts/seo-audit/lib/pageChecks');

const BASE = 'https://cardbrix.com';
const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'client', 'index.html'), 'utf8'); // the real template with the old placeholder
const row = (i, over = {}) => ({ id: `id-${i}`, title: `Annuncio ${i}`, price: '12.5', current_bid: null, auction_start: null, type: 'used', condition: 'new', product_type: 'lego', game: null, ...over });
const PRODUCT = { id: 'abc', title: 'LEGO Icons Fiori', description: 'Set completo.\nScatola integra.', price: '45.5', type: 'used', status: 'active', images: ['/uploads/a.webp'], condition: 'new', product_type: 'lego', game: null, set_number: '10280', theme: 'Icons', year: 2020, pieces: 756, box_condition: 'Ottima', auction_end: null };

beforeEach(() => { clear(); query.mockReset(); jest.spyOn(console, 'warn').mockImplementation(() => {}); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

describe('html helpers', () => {
  test('esc neutralises markup and quotes', () => {
    expect(esc(`<script>alert("x")</script> & 'y'`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;');
    expect(esc(null)).toBe('');
  });

  test('paragraphs: one <p> per line, escaped, capped on a word boundary', () => {
    expect(paragraphs('uno\r\n\r\ndue <b>')).toBe('<p>uno</p><p>due &lt;b&gt;</p>');
    expect(paragraphs('   ')).toBe('');
    const long = paragraphs('parola '.repeat(400), 100);
    expect(long.endsWith('…</p>')).toBe(true);
    expect(long.length).toBeLessThan(140);
  });

  test('wordCount ignores tags, scripts and entities', () => {
    expect(wordCount('<p>uno due</p><script>var a = "x y z"</script><style>.a{b:c}</style>&nbsp;tre')).toBe(3);
    expect(wordCount('')).toBe(0);
  });
});

describe('copy', () => {
  test('reads the app locale, interpolates variables, and returns "" for anything missing', () => {
    expect(copy.t('landing.hero.word_win')).toBe('Vinci.');
    expect(copy.t('annunci.subtitle', { title: 'LEGO' })).toContain('LEGO');
    expect(copy.t('annunci.subtitle', { title: 'LEGO' })).not.toContain('{{');
    expect(copy.t('non.esiste')).toBe('');
    expect(copy.t('landing.hero')).toBe(''); // an object, not a string
    expect(copy.has('faq.title')).toBe(true);
  });

  test('an unreadable locale degrades to empty strings instead of throwing', () => {
    copy._setLocaleForTests({});
    expect(copy.t('faq.title')).toBe('');
    copy._setLocaleForTests(null);
  });
});

describe('cache', () => {
  test('serves from cache until the TTL passes', async () => {
    const loader = jest.fn().mockResolvedValue('v');
    let clock = 1000;
    const now = () => clock;
    expect(await cached('k', 500, loader, { now })).toBe('v');
    clock += 400;
    expect(await cached('k', 500, loader, { now })).toBe('v');
    expect(loader).toHaveBeenCalledTimes(1);
    clock += 200;
    await cached('k', 500, loader, { now });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  test('slow or failing loaders resolve to null and are not cached', async () => {
    const slow = jest.fn(() => new Promise(() => {}));
    expect(await cached('slow', 1000, slow, { timeoutMs: 20 })).toBeNull();
    const boom = jest.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce('ok');
    expect(await cached('boom', 1000, boom)).toBeNull();
    expect(await cached('boom', 1000, boom)).toBe('ok'); // retried, the failure was not remembered
  });

  test('never grows past its cap', async () => {
    for (let i = 0; i < MAX_ENTRIES + 20; i += 1) await cached(`k${i}`, 1000, async () => i);
    const first = jest.fn().mockResolvedValue('reloaded');
    await cached('k0', 1000, first);
    expect(first).toHaveBeenCalled(); // the oldest entries were evicted
  });
});

describe('page definitions (Phase A: text pages)', () => {
  test('home, how it works, faq, legal, help, skill zone and credits have their own h1 and body', () => {
    for (const p of ['/', '/come-funziona', '/faq', '/help', '/norme-legali', '/skill-zone', '/crediti']) {
      const d = pageFor(p);
      expect([p, Boolean(d.h1)]).toEqual([p, true]);
      expect([p, wordCount(d.body) > 30]).toEqual([p, true]);
    }
    expect(pageFor('/').h1).toBe('CardBrix: Colleziona. Rilancia. Vinci.');
  });

  test('FAQ renders every question and mirrors them in FAQPage JSON-LD', () => {
    const d = pageFor('/faq');
    const questions = (d.body.match(/<h2>/g) || []).length;
    expect(questions).toBeGreaterThanOrEqual(10);
    expect(d.jsonLd['@type']).toBe('FAQPage');
    expect(d.jsonLd.mainEntity).toHaveLength(questions);
    expect(d.jsonLd.mainEntity[0].acceptedAnswer.text.length).toBeGreaterThan(20);
  });

  test('legal page renders all the articles the locale has', () => {
    const d = pageFor('/norme-legali');
    expect((d.body.match(/<h2>Art\. /g) || []).length).toBeGreaterThanOrEqual(12);
  });

  test('credit rules: the shell never says credits can be bought, converted or priced', () => {
    const forbidden = /acquist\w*\s+(?:i\s+)?crediti|compr\w*\s+(?:i\s+)?crediti|1\s*credito\s*=|credito\s*=\s*\d|crediti?\s*=\s*[\d.,]+\s*(?:€|euro)|\d\s*(?:€|euro)\s*=\s*\d+\s*credit/i;
    for (const p of ['/', '/crediti', '/skill-zone', '/come-funziona', '/faq', '/norme-legali', '/help']) {
      const d = pageFor(p);
      const text = `${d.h1} ${d.lead || ''} ${d.body}`.replace(/<[^>]+>/g, ' ');
      expect([p, forbidden.test(text)]).toEqual([p, false]);
    }
    // the stale locale string that DOES say "Acquista Crediti" must not leak in
    expect(JSON.stringify(pageFor('/skill-zone'))).not.toMatch(/Acquista Crediti/i);
    // and the credits page carries the actual rule
    expect(pageFor('/crediti').body).toMatch(/non sono acquistabili con denaro/);
  });

  test('marketplace and catalog hubs: mode, category and game drive the listing blocks', () => {
    const a = pageFor('/annunci');
    expect(a.h1).toBe('Annunci');
    expect(a.listings[0]).toMatchObject({ auction: false });
    const s = pageFor('/aste/lego');
    expect(s.h1).toBe('Aste LEGO');
    expect(s.listings[0]).toMatchObject({ auction: true, productType: 'lego' });
    const g = pageFor('/Annunci/Carte-Collezionabili/Pokemon/');
    expect(g.h1).toBe('Annunci Pokémon');
    expect(g.listings[0]).toMatchObject({ productType: 'tcg', game: 'pokemon' });
    expect(g.crumbs.map((c) => c.name)).toEqual(['CardBrix', 'Annunci', 'Carte Collezionabili', 'Pokémon']);
    expect(pageFor('/catalog').body).toContain('href="/catalog/lego"');
    expect(pageFor('/catalog/onepiece').h1).toBe('Catalogo One Piece');
  });

  test('routes without a definition return null (the generic shell is used)', () => {
    for (const p of ['/annunci/inventato', '/annunci/carte-collezionabili/inventato', '/catalog/inventato', '/catalog/lego/75192', '/login', '/admin', '/product/x']) {
      expect([p, pageFor(p)]).toEqual([p, null]);
    }
  });
});

describe('listing blocks (Phase B: live data)', () => {
  test('fetchListings: only active, auctions vs fixed price, filters as bound parameters, capped limit', async () => {
    query.mockResolvedValue({ rows: [] });
    await fetchListings({ auction: true, productType: 'tcg', game: 'pokemon', limit: 999 });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/l\.status = 'active'/);
    expect(sql).toMatch(/l\.type = 'auction' OR l\.is_auction = true/);
    expect(sql).toMatch(/l\.auction_end > NOW\(\)/); // an auction that already ended is not "live"
    expect(sql).toMatch(/l\.product_type = \$1/);
    expect(sql).toMatch(/l\.game = \$2/);
    expect(sql).not.toMatch(/pokemon/); // the value travels as a parameter, never inside the SQL text
    expect(params).toEqual(['tcg', 'pokemon', 50]);

    await fetchListings({ auction: false, limit: 5 });
    expect(query.mock.calls[1][0]).toMatch(/l\.type <> 'auction'/);
    expect(query.mock.calls[1][1]).toEqual([5]);
  });

  test('renders a linked list with price and condition, and reuses the cache', async () => {
    query.mockResolvedValue({ rows: [row(1), row(2, { type: 'auction', current_bid: '30', condition: 'used' })] });
    const block = { heading: 'Annunci LEGO', auction: false, productType: 'lego', limit: 20 };
    const html = await listingsBlock(block);
    expect(html).toContain('<h2>Annunci LEGO</h2>');
    expect(html).toContain('<a href="/product/id-1">Annuncio 1</a> – ');
    expect(html).toMatch(/12,50\s€ · Nuovo/);
    expect(html).toMatch(/30,00\s€ · Usato/);
    await listingsBlock(block);
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('titles from users are escaped, and a DB failure or an empty result just omits the section', async () => {
    query.mockResolvedValueOnce({ rows: [row(1, { title: '<img src=x onerror=alert(1)>' })] });
    const html = await listingsBlock({ heading: 'H', auction: false, limit: 5 });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    clear();
    query.mockRejectedValueOnce(new Error('connection lost'));
    expect(await listingsBlock({ heading: 'H', auction: false, limit: 5 })).toBe('');
    clear();
    query.mockResolvedValueOnce({ rows: [] });
    expect(await listingsBlock({ heading: 'H', auction: false, limit: 5 })).toBe('');
  });

  test('a listing page: text, details, breadcrumb, escaped description, similar listings without itself', async () => {
    query.mockResolvedValue({ rows: [row(1), { ...row(2), id: 'abc' }, row(3)] });
    const d = await productPage({ ...PRODUCT, description: 'Bello <script>x</script>\nSecondo paragrafo' }, [`${BASE}/uploads/a.webp`]);
    expect(d.h1).toBe('LEGO Icons Fiori');
    expect(d.lead).toMatch(/^Prezzo: 45,50\s€$/);
    expect(d.body).toContain('<p>Bello &lt;script&gt;x&lt;/script&gt;</p><p>Secondo paragrafo</p>');
    expect(d.body).toContain('<dt>Numero set</dt><dd>10280</dd>');
    expect(d.body).toContain('<dt>Condizione</dt><dd>Nuovo</dd>');
    expect(d.body).toContain(`<img src="${BASE}/uploads/a.webp" alt="LEGO Icons Fiori"`);
    expect(d.body).not.toContain('href="/product/abc"'); // does not recommend itself
    expect(d.body).toContain('href="/product/id-1"');
    expect(d.crumbs.map((c) => c.name)).toEqual(['CardBrix', 'Annunci', 'LEGO', 'LEGO Icons Fiori']);
  });

  test('an auction page shows the current bid and when it ends; no description means no empty section', async () => {
    query.mockResolvedValue({ rows: [] });
    const d = await productPage({ ...PRODUCT, type: 'auction', price: null, current_bid: '77', description: null, auction_end: '2026-10-01T18:30:00Z' }, []);
    expect(d.lead).toMatch(/^Offerta attuale: 77,00\s€\. Scade il 1 ottobre 2026/);
    expect(d.body).not.toContain('Descrizione');
    expect(d.body).not.toContain('<img');
    expect(d.crumbs[1]).toMatchObject({ name: 'Aste', href: '/aste' });
  });
});

describe('injectShell', () => {
  test('replaces only the placeholder inside #root and keeps the rest of the document', () => {
    const out = injectShell('<html><head></head><body><div id="root"><p>vecchio</p></div><script src="x.js"></script></body></html>', '<div class="seo-shell">nuovo</div>');
    expect(out).toBe('<html><head></head><body><div id="root"><div class="seo-shell">nuovo</div></div><script src="x.js"></script></body></html>');
  });

  test('text containing $ patterns is inserted literally', () => {
    expect(injectShell('<div id="root">x</div></body>', '<p>Costa $& $1 $$</p>')).toContain('<p>Costa $& $1 $$</p>');
  });

  test('a document without #root is returned unchanged', () => {
    expect(injectShell('<html><body>niente</body></html>', '<p>x</p>')).toBe('<html><body>niente</body></html>');
  });

  test('guard: the real client/index.html placeholder has no nested <div>, which the replacement relies on', () => {
    const root = TEMPLATE.slice(TEMPLATE.indexOf('<div id="root">'), TEMPLATE.indexOf('</div>', TEMPLATE.indexOf('<div id="root">')));
    expect(root.slice('<div id="root">'.length)).not.toContain('<div');
  });
});

describe('server wiring', () => {
  test('express.static must not serve index.html itself, or "/" would bypass the shell and the meta rewrite', () => {
    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    expect(server).toMatch(/express\.static\(clientDistPath,\s*\{\s*index:\s*false\s*\}\)/);
    expect(server).toMatch(/createSpaFallback\(clientDistPath\)/);
  });
});

describe('renderPage puts the content shell in the HTML', () => {
  const doc = async (p, status = 200) => {
    const r = await renderPage(p, TEMPLATE);
    expect([p, r.status]).toEqual([p, status]);
    return { html: r.html, parsed: parseHtml(r.html) };
  };

  test('the English placeholder is gone from every page; the home has real text and many links', async () => {
    const { html, parsed } = await doc('/');
    expect(html).not.toContain('Buy, Sell and Trade');
    expect(parsed.headings.h1).toEqual(['CardBrix: Colleziona. Rilancia. Vinci.']);
    expect(parsed.wordCount).toBeGreaterThan(300);
    expect(parsed.anchors.filter((a) => a.href.startsWith('/')).length).toBeGreaterThanOrEqual(12);
  });

  test('FAQ carries FAQPage JSON-LD next to its text', async () => {
    const { html } = await doc('/faq');
    const ld = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    expect(ld.some((b) => b['@type'] === 'FAQPage' && b.mainEntity.length >= 10)).toBe(true);
  });

  test('a category page lists live listings; the SQL was asked for the right slice', async () => {
    query.mockResolvedValue({ rows: [row(1), row(2)] });
    const { parsed } = await doc('/annunci/carte-collezionabili/pokemon');
    expect(parsed.anchors.map((a) => a.href)).toEqual(expect.arrayContaining(['/product/id-1', '/product/id-2']));
    expect(query.mock.calls[0][1]).toEqual(['tcg', 'pokemon', 20]);
  });

  test('a listing page renders its own text; related listings are optional', async () => {
    query.mockResolvedValueOnce({ rows: [PRODUCT] }).mockRejectedValue(new Error('related failed'));
    const { html, parsed } = await doc('/product/abc');
    expect(parsed.headings.h1).toEqual(['LEGO Icons Fiori']);
    expect(html).toContain('Scatola integra.');
    expect(html).toContain('<dt>Pezzi</dt><dd>756</dd>');
    expect(html).not.toContain('Altri annunci simili');
  });

  test('database down while loading a listing: 200 with the generic shell, not an empty page', async () => {
    query.mockRejectedValue(Object.assign(new Error('connection terminated'), { code: 'ECONNRESET' }));
    const { parsed } = await doc('/product/abc');
    expect(parsed.headings.h1).toEqual(['CardBrix']);
    expect(parsed.wordCount).toBeGreaterThan(20);
  });

  test('the 404 page carries the not-found text', async () => {
    const { parsed, html } = await doc('/pagina-inventata', 404);
    expect(parsed.headings.h1).toEqual(['Pagina non trovata']);
    expect(html).not.toContain('Buy, Sell and Trade');
  });

  test('no page has an empty heading, paragraph or link, and no unresolved locale key leaks through', async () => {
    query.mockResolvedValue({ rows: [row(1)] });
    const paths = [...STATIC_PATHS, '/crediti', '/product/abc'];
    for (const p of paths) {
      const { html } = await doc(p);
      const shell = html.slice(html.indexOf('class="seo-shell"'), html.indexOf('</body>'));
      const bad = shell.match(/<(h1|h2|h3|p|li|dt|dd|a)\b[^>]*>\s*<\/\1>|undefined|\{\{|\[object|<(?:li|p|dd)>\s*:\s/); // empty element, unresolved value, or a label missing before ": "
      expect([p, bad && bad[0]]).toEqual([p, null]);
    }
  });

  test('every page in the sitemap: its own h1 (unique), and links a crawler can follow', async () => {
    query.mockResolvedValue({ rows: [row(1)] });
    const h1s = [];
    for (const p of STATIC_PATHS) {
      const { parsed } = await doc(p);
      expect([p, parsed.headings.h1.length]).toEqual([p, 1]);
      h1s.push(parsed.headings.h1[0]);
      const internal = parsed.anchors.filter((a) => a.href.startsWith('/')).length;
      expect([p, internal >= 5]).toEqual([p, true]);
    }
    expect(new Set(h1s).size).toBe(h1s.length);
  });

  test('the audit no longer flags "thin raw HTML" on the text-rich pages', async () => {
    query.mockResolvedValue({ rows: [row(1), row(2), row(3)] });
    for (const p of ['/', '/come-funziona', '/faq', '/norme-legali']) {
      const { parsed } = await doc(p);
      const r = { url: `${BASE}${p}`, finalUrl: `${BASE}${p}`, status: 200, chain: [], headers: { 'content-encoding': 'br' }, bytes: 1000, ttfbMs: 100, error: null };
      const ids = checkPage(r, parsed, { baseUrl: BASE }).map((i) => i.id);
      expect([p, ids.includes('raw-html-thin'), ids.includes('no-internal-links-raw')]).toEqual([p, false, false]);
    }
  });
});
