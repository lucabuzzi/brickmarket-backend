// The 14 pages the SEO audit flagged as "thin raw HTML" (< 150 words without JavaScript): expansion pages,
// the One Piece / Dragon Ball catalog hubs, and the user directory (noindex instead of padding).
// The database module is mocked, so nothing here can reach a real DB. Word counts come from the audit's own
// parser/checker, so "passes here" means "the audit stops flagging it".
jest.mock('../src/db', () => ({ query: jest.fn() }));

const fs = require('fs');
const path = require('path');
const { query } = require('../src/db');
const { clear } = require('../src/services/seoContent/cache');
const { setPageDef, formatSetDate, pageFor } = require('../src/services/seoContent/pages');
const { renderShell } = require('../src/services/seoContent/layout');
const { renderPage, NOINDEX_PATHS } = require('../src/services/seoMeta');
const { STATIC_PATHS } = require('../src/routes/sitemap');
const { parseHtml } = require('../scripts/seo-audit/lib/htmlParse');
const { checkPage } = require('../scripts/seo-audit/lib/pageChecks');

const BASE = 'https://cardbrix.com';
const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'client', 'index.html'), 'utf8');

const SET = { id: 'sv10', name: 'Rivali Predestinati', name_en: 'Destined Rivals', series_name: 'Scarlatto e Violetto', series_name_en: 'Scarlet & Violet', card_count_total: 244, release_date: '2025-05-30' };
const OTHERS = [{ id: '30th', name: '30º Anniversario', name_en: '30th Anniversary' }, { id: 'SV09', name: 'Avventure Insieme', name_en: 'Journey Together' }];
const OP_SETS = [{ name: 'Romance Dawn', name_en: 'Romance Dawn' }, { name: 'Paramount War', name_en: 'Paramount War' }];

function mockDb({ set = SET, others = OTHERS, opSets = OP_SETS } = {}) {
  query.mockImplementation(async (sql) => {
    const q = String(sql);
    if (q.includes('FROM card_sets') && q.includes('lower(id) = lower(')) return { rows: set ? [set] : [] };
    if (q.includes('FROM card_sets cs')) return { rows: others };
    if (q.includes('FROM card_sets WHERE game = $1') && q.includes('release_date DESC')) return { rows: opSets };
    return { rows: [] };
  });
}

const audit = async (p) => {
  const r = await renderPage(p, TEMPLATE);
  const parsed = parseHtml(r.html);
  const res = { url: `${BASE}${p}`, finalUrl: `${BASE}${p}`, status: r.status, chain: [], headers: { 'content-encoding': 'br' }, bytes: 1000, ttfbMs: 100, error: null };
  return { ...r, parsed, ids: checkPage(res, parsed, { baseUrl: BASE }).map((i) => i.id) };
};

beforeEach(() => {
  clear();
  query.mockReset();
  mockDb();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('expansion pages', () => {
  const PATHS = [
    '/it/annunci/carte-collezionabili/pokemon/sv10',
    '/en/listings/trading-cards/pokemon/sv10',
    '/it/aste/carte-collezionabili/pokemon/sv10',
  ];

  test.each(PATHS)('%s is no longer thin (>= 150 words) and is a real 200', async (p) => {
    const d = await audit(p);
    expect(d.status).toBe(200);
    expect(d.parsed.wordCount).toBeGreaterThanOrEqual(150);
    expect(d.ids).not.toContain('raw-html-thin');
  });

  test('still above the threshold when the database has nothing else to add (no sibling sets, no listings)', async () => {
    mockDb({ others: [] });
    for (const p of PATHS) expect((await audit(p)).parsed.wordCount).toBeGreaterThanOrEqual(150);
  });

  test('italian text states the facts from the card_sets row', async () => {
    const { html } = await audit(PATHS[0]);
    expect(html).toContain('Espansione Pokémon «Rivali Predestinati» della serie Scarlatto e Violetto, composta da 244 carte, uscita il 30 maggio 2025.');
    expect(html).toContain('<h1>Carte Pokémon Rivali Predestinati in vendita</h1>');
  });

  test('english page uses the english names and only links to english pages', async () => {
    const { html } = await audit(PATHS[1]);
    expect(html).toContain('Pokémon expansion “Destined Rivals” from the Scarlet &amp; Violet series, with 244 cards, released on 30 May 2025.');
    const root = html.slice(html.indexOf('<div id="root">'));
    const hrefs = [...root.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]).filter((h) => !h.startsWith('/product') && !['/sell', '/create-auction'].includes(h)); // private pages exist only unlocalized
    expect(hrefs.length).toBeGreaterThan(5);
    for (const h of hrefs) expect([h, /^\/en(\/|$)|^\/$/.test(h)]).toEqual([h, true]);
  });

  test('links to other expansions that have active listings, not to itself', async () => {
    const { html } = await audit(PATHS[0]);
    expect(html).toContain('href="/it/annunci/carte-collezionabili/pokemon/30th"');
    expect(html).toContain('href="/it/annunci/carte-collezionabili/pokemon/sv09"');
    expect(html).not.toContain('href="/it/annunci/carte-collezionabili/pokemon/sv10"');
  });

  test('asks for the listings of THIS expansion only', async () => {
    await audit(PATHS[0]);
    const call = query.mock.calls.find(([sql]) => String(sql).includes('ORDER BY l.created_at') && String(sql).includes('lower(l.card_set_id)'));
    expect(call).toBeTruthy();
    expect(call[1]).toEqual(['tcg', 'pokemon', 'sv10', 20]);
    expect(String(call[0])).toMatch(/l\.product_type = \$1/);
    expect(String(call[0])).toMatch(/l\.game = \$2/);
    expect(String(call[0])).toMatch(/lower\(l\.card_set_id\) = lower\(\$3\)/);
    expect(String(call[0])).not.toMatch(/sv10/); // the value travels as a parameter
  });

  test('set names are escaped', () => {
    const def = setPageDef({ set: { ...SET, name: '<script>x</script>', name_en: null } }, { mode: 'annunci', game: 'pokemon', id: 'sv10' }, 'it');
    expect(renderShell(def, 'it')).not.toContain('<script>');
  });

  test('an unknown expansion is still a 404 (unchanged behaviour)', async () => {
    mockDb({ set: null });
    expect((await audit('/it/annunci/carte-collezionabili/pokemon/nope')).status).toBe(404);
  });

  test('a database failure for the extra content degrades, it does not throw', async () => {
    query.mockImplementation(async (sql) => {
      const q = String(sql);
      if (q.includes('lower(id) = lower(') && !q.includes('cs.') && q.includes('release_date') && !q.includes('WHERE game = $1\n')) return { rows: [SET] };
      throw new Error('db down');
    });
    const d = await audit(PATHS[0]);
    expect(d.status).toBe(200);
    expect(d.html).toContain('<h1>');
  });

  test('date formatting is timezone-proof', () => {
    expect(formatSetDate('2025-05-30', 'it')).toBe('30 maggio 2025');
    expect(formatSetDate(new Date(2025, 4, 30), 'en')).toBe('30 May 2025');
    expect(formatSetDate(null, 'it')).toBe('');
    expect(formatSetDate('not a date', 'it')).toBe('');
  });
});

describe('One Piece / Dragon Ball catalog hubs', () => {
  const PATHS = ['/it/catalog/onepiece', '/en/catalog/onepiece', '/it/catalog/dragonball', '/en/catalog/dragonball'];

  test.each(PATHS)('%s passes the audit even with an empty database (>= 150 words)', async (p) => {
    mockDb({ opSets: [] });
    const d = await audit(p);
    expect(d.status).toBe(200);
    expect(d.parsed.wordCount).toBeGreaterThanOrEqual(150);
    expect(d.ids).not.toContain('raw-html-thin');
  });

  test('One Piece lists the expansion names it has in card_sets (plain text, no links to thin pages)', async () => {
    const { html } = await audit('/it/catalog/onepiece');
    expect(html).toContain('Espansioni del One Piece Card Game');
    expect(html).toContain('<li>Romance Dawn</li>');
    expect(html).not.toMatch(/href="[^"]*onepiece\/romance/i);
  });

  test('Dragon Ball has no expansion list (no card_sets for it) but has its own description', async () => {
    const { html } = await audit('/it/catalog/dragonball');
    expect(html).toContain('Come usare il catalogo Dragon Ball');
    expect(html).toContain('Fusion World');
    expect(html).not.toContain('Espansioni del');
  });

  test('the other catalog hubs are unchanged (no about-section)', () => {
    for (const slug of ['lego', 'pokemon', 'magic']) expect(JSON.stringify(pageFor(`/catalog/${slug}`))).not.toContain('Come usare il catalogo');
  });
});

describe('user directory: noindex instead of padding', () => {
  test.each(['/it/ricerca-utente', '/en/find-seller'])('%s is served (200) with noindex,follow', async (p) => {
    const { status, html } = await audit(p);
    expect(status).toBe(200);
    expect(html).toContain('<meta name="robots" content="noindex, follow">');
  });

  test('no other structural page gets noindex by accident', async () => {
    for (const p of ['/it/catalog/onepiece', '/it/faq', '/en/how-it-works']) {
      expect((await audit(p)).html).not.toMatch(/name="robots"[^>]*noindex/);
    }
  });

  test('it is out of the sitemap and not blocked in robots.txt (noindex needs the crawl)', () => {
    expect(NOINDEX_PATHS.has('/ricerca-utente')).toBe(true);
    expect(STATIC_PATHS.some((p) => /ricerca-utente|find-seller/.test(p))).toBe(false);
    const robots = fs.readFileSync(path.join(__dirname, '..', 'client', 'public', 'robots.txt'), 'utf8');
    expect(robots).not.toMatch(/Disallow:\s*\/(it\/|en\/)?(ricerca-utente|find-seller)/);
  });
});

describe('long expansion titles are shortened to fit a search result', () => {
  const { buildSetMeta, fitTitle } = require('../src/services/seoSetPages');
  const LONG = { id: 'lob', name: 'Legend of Blue Eyes White Dragon', name_en: 'Legend of Blue Eyes White Dragon' };

  test.each([
    ['annunci', 'it', 'Carte Yu-Gi-Oh! Legend of Blue Eyes White Dragon | CardBrix'],
    ['annunci', 'en', 'Yu-Gi-Oh! Legend of Blue Eyes White Dragon Cards | CardBrix'],
  ])('%s/%s drops the "for sale" part when it would exceed 60 characters', (mode, locale, expected) => {
    const { title } = buildSetMeta(LONG, mode, 'yugioh', locale);
    expect(title).toBe(expected);
    expect(title.length).toBeLessThanOrEqual(60);
  });

  test.each([['it', 'Aste Yu-Gi-Oh! Legend of Blue Eyes White Dragon | CardBrix'], ['en', 'Yu-Gi-Oh! Legend of Blue Eyes White Dragon Auctions']])('auctions (%s) fit too', (locale, expected) => {
    const { title } = buildSetMeta(LONG, 'aste', 'yugioh', locale);
    expect(title).toBe(expected);
    expect(title.length).toBeLessThanOrEqual(60);
  });

  test('short names keep the full, more descriptive title (unchanged behaviour)', () => {
    expect(buildSetMeta({ id: 'sv10', name: 'Rivali Predestinati' }, 'annunci', 'pokemon', 'it').title).toBe('Carte Pokémon Rivali Predestinati in vendita | CardBrix');
    expect(buildSetMeta({ id: 'sv10', name_en: 'Destined Rivals', name: 'x' }, 'annunci', 'pokemon', 'en').title).toBe('Pokémon Destined Rivals Cards for Sale | CardBrix');
  });

  test('fitTitle picks the first candidate that fits, else the shortest', () => {
    expect(fitTitle(['a'.repeat(70), 'b'.repeat(50)])).toBe('b'.repeat(50));
    expect(fitTitle(['a'.repeat(90), 'b'.repeat(70)])).toBe('b'.repeat(70));
  });
});

describe('audit: redirect and its target are one document', () => {
  const { checkDuplicates } = require('../scripts/seo-audit/lib/siteChecks');
  const page = (url, finalUrl, title, description) => ({ url, finalUrl, parsed: { title, description } });

  test('"/" -> "/it" is not reported as a duplicate of itself', () => {
    const pages = [page(`${BASE}/`, `${BASE}/it`, 'Home', 'D'), page(`${BASE}/it`, `${BASE}/it`, 'Home', 'D'), page(`${BASE}/faq`, `${BASE}/faq`, 'FAQ', 'F')];
    expect(checkDuplicates(pages)).toEqual([]);
  });
  test('two genuinely different pages with the same title are still reported', () => {
    const pages = [page(`${BASE}/a`, `${BASE}/a`, 'Same', 'A'), page(`${BASE}/b`, `${BASE}/b`, 'Same', 'B')];
    expect(checkDuplicates(pages).map((i) => i.id)).toEqual(['title-duplicate']);
  });
  test('index.js only reports a redirect for URLs the sitemap really lists', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'seo-audit', 'index.js'), 'utf8');
    expect(src).toMatch(/i\.id === 'redirect-chain' && !sitemapPaths\.has\(p\.path\)/);
  });
});
