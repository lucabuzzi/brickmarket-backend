// Per-route title/description (src/services/pageMeta.js) and how seoMeta applies them.
// The database module is mocked, so nothing here can reach a real DB.
jest.mock('../src/db', () => ({ query: jest.fn() }));

const { query } = require('../src/db');
const { getRouteMeta } = require('../src/services/pageMeta');
const { renderIndexHtmlForRequest } = require('../src/services/seoMeta');
const { STATIC_PATHS } = require('../src/routes/sitemap');
const { parseHtml } = require('../scripts/seo-audit/lib/htmlParse');
const { checkPage } = require('../scripts/seo-audit/lib/pageChecks');
const { checkDuplicates } = require('../scripts/seo-audit/lib/siteChecks');

const GAMES = ['pokemon', 'magic', 'yugioh', 'lorcana', 'onepiece', 'dragonball'];
const template = `<!doctype html><html lang="it"><head><title>CardBrix - LEGO, Trading Cards &amp; Auctions Marketplace</title>
<link rel="canonical" href="https://cardbrix.com/"><meta name="description" content="Default description">
<meta property="og:url" content="https://cardbrix.com/"><meta property="og:title" content="Default"><meta property="og:description" content="Default">
<meta property="og:image" content="https://cardbrix.com/og-image.jpg"><meta property="og:image:alt" content="Default">
<meta name="twitter:title" content="Default"><meta name="twitter:description" content="Default"><meta name="twitter:image" content="x"><meta name="twitter:image:alt" content="Default">
</head><body></body></html>`;

// every route the client can serve that is worth indexing, incl. some that are not in the sitemap
const EXTRA_PATHS = ['/crediti', '/search-results', ...GAMES.flatMap((g) => [`/catalog/${g}/search`]), '/catalog/lego/search', '/catalog/funko', '/catalog/funko/search'];
const ALL_PATHS = [...new Set([...STATIC_PATHS, ...EXTRA_PATHS])].filter((p) => p !== '/');

describe('getRouteMeta', () => {
  test('the home keeps the site-wide text (null = use the default)', () => {
    expect(getRouteMeta('/')).toBeNull();
    expect(getRouteMeta('')).toBeNull();
  });

  test('every page listed in the sitemap (except the home) has its own meta', () => {
    const missing = STATIC_PATHS.filter((p) => p !== '/' && !getRouteMeta(p));
    expect(missing).toEqual([]); // adding a path to sitemap.js without giving it a title fails here
  });

  test('titles and descriptions are unique across all indexable routes', () => {
    const titles = ALL_PATHS.map((p) => getRouteMeta(p).title);
    const descs = ALL_PATHS.map((p) => getRouteMeta(p).description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descs).size).toBe(descs.length);
  });

  test('lengths stay inside the range the audit (and Google) consider healthy', () => {
    for (const p of ALL_PATHS) {
      const { title, description } = getRouteMeta(p);
      expect([p, title.length >= 30 && title.length <= 65]).toEqual([p, true]);
      expect([p, description.length >= 70 && description.length <= 160]).toEqual([p, true]);
      expect(title.endsWith(' | CardBrix')).toBe(true);
    }
  });

  test('routes get text about what they actually are', () => {
    expect(getRouteMeta('/annunci/lego').title).toBe('Annunci LEGO: set nuovi e usati | CardBrix');
    expect(getRouteMeta('/aste/lego').title).toBe('Aste LEGO: set nuovi e usati | CardBrix');
    expect(getRouteMeta('/annunci/carte-collezionabili/pokemon').title).toBe('Annunci di carte Pokémon | CardBrix');
    expect(getRouteMeta('/aste/carte-collezionabili/yugioh').title).toBe('Aste di carte Yu-Gi-Oh! | CardBrix');
    expect(getRouteMeta('/catalog/onepiece').title).toBe('Catalogo One Piece: schede e dettagli | CardBrix');
    expect(getRouteMeta('/catalog/onepiece').description).toContain('One Piece Card Game'); // full name lives in the description
    expect(getRouteMeta('/skill-zone').title).toContain('Puzzle Arena');
    // "buy / bid" verb follows the mode
    expect(getRouteMeta('/annunci/funko').description).toMatch(/^Compra/);
    expect(getRouteMeta('/aste/funko').description).toMatch(/^Fai offerte/);
  });

  test('dynamic catalog and profile routes', () => {
    expect(getRouteMeta('/catalog/lego/10280-1').title).toBe('LEGO set 10280-1: valore di mercato e dettagli | CardBrix');
    expect(getRouteMeta('/catalog/pokemon/xy1-1').title).toContain('Pokémon');
    expect(getRouteMeta('/user/mario_rossi').title).toBe('Profilo di mario_rossi | CardBrix');
    // route matching is case-insensitive but printed values keep their casing
    expect(getRouteMeta('/User/MarioRossi').title).toBe('Profilo di MarioRossi | CardBrix');
    expect(getRouteMeta('/CATALOG/lego/75192-UCS').title).toContain('75192-UCS');
    expect(getRouteMeta('/catalog/lego/%E0%A4%A')).toBeNull(); // malformed set number must not throw
    expect(getRouteMeta('/user/' + 'x'.repeat(200)).title.length).toBeLessThan(70); // long input is capped
    expect(getRouteMeta('/user/%E0%A4%A')).toBeNull(); // malformed percent-encoding must not throw
  });

  test('path normalisation: trailing slash and case', () => {
    expect(getRouteMeta('/Annunci/')).toEqual(getRouteMeta('/annunci'));
    expect(getRouteMeta('/faq/')).toEqual(getRouteMeta('/faq'));
  });

  test('unknown or private routes fall back to null, never throw', () => {
    for (const p of ['/pagina-che-non-esiste', '/annunci/inventato', '/annunci/carte-collezionabili/inventato', '/catalog/inventato', '/catalog/lego/a/b/c', '/admin', '/login', '/aste/lego/extra']) {
      expect([p, getRouteMeta(p)]).toEqual([p, null]);
    }
  });

  test('copy about credits stays inside the product rules (no money, no purchase, no conversion)', () => {
    const { title, description } = getRouteMeta('/crediti');
    const text = `${title} ${description}`.toLowerCase();
    for (const banned of ['€', 'euro', 'acquista', 'compra', 'converti', 'rimbors', 'vale ', 'valore', '1 credito']) expect(text).not.toContain(banned);
    expect(text).toContain('puzzle arena');
  });
});

describe('renderIndexHtmlForRequest applies route meta', () => {
  afterEach(() => query.mockReset());

  test('a category page gets its own title, description, og and twitter tags, and self canonical', async () => {
    const html = await renderIndexHtmlForRequest('/annunci/carte-collezionabili/pokemon', template);
    const p = parseHtml(html);
    expect(p.title).toBe('Annunci di carte Pokémon | CardBrix');
    expect(p.description).toMatch(/^Compra carte Pokémon a prezzo fisso/);
    expect(p.canonical).toBe('https://cardbrix.com/annunci/carte-collezionabili/pokemon');
    expect(p.og.title).toBe(p.title);
    expect(p.og.description).toBe(p.description);
    expect(html).toContain('<meta name="twitter:title" content="Annunci di carte Pokémon | CardBrix">');
    expect(query).not.toHaveBeenCalled(); // static routes never hit the database
  });

  test('the home keeps the site default; unknown routes get the not-found text (and a 404, see not-found.test.js)', async () => {
    const home = parseHtml(await renderIndexHtmlForRequest('/', template));
    expect(home.title).toBe('CardBrix - LEGO, Trading Cards & Auctions Marketplace');
    expect(home.description).toBe('CardBrix is the marketplace for LEGO sets, trading cards and collectibles: buy, sell, bid in live auctions, or win rare items in Puzzle Arena skill contests.');
    const unknown = parseHtml(await renderIndexHtmlForRequest('/una/rotta/sconosciuta', template));
    expect(unknown.title).toBe('Pagina non trovata | CardBrix');
  });

  test('HTML-special characters in a username are escaped, not injected', async () => {
    const html = await renderIndexHtmlForRequest('/user/%3Cscript%3Ealert(1)%3C%2Fscript%3E', template);
    expect(html).not.toContain('<script>alert(1)');
    expect(parseHtml(html).title).toContain('<script>alert(1)</script>'); // decoded back to text by the parser, i.e. it was escaped in the markup
  });

  test('product pages still use listing data, not route meta', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'x', title: 'Il mio set', description: 'Bello', price: '10', type: 'used', status: 'active', images: [], condition: 'new', product_type: 'lego' }] });
    const p = parseHtml(await renderIndexHtmlForRequest('/product/x', template));
    expect(p.title).toBe('Il mio set | CardBrix');
  });

  test('end to end with the audit: the duplicate-title/description checks pass on sitemap pages', async () => {
    const pages = [];
    for (const path of STATIC_PATHS) {
      const html = await renderIndexHtmlForRequest(path, template);
      pages.push({ url: `https://cardbrix.com${path}`, parsed: parseHtml(html) });
    }
    const dupes = checkDuplicates(pages);
    // only the home may share the default text with nothing else, so no duplicate group at all
    expect(dupes).toEqual([]);
    // and per-page length checks find nothing wrong with any of them
    const lengthIssues = pages.filter((p) => p.url !== 'https://cardbrix.com/').flatMap((p) => {
      const r = { url: p.url, finalUrl: p.url, status: 200, chain: [], headers: { 'content-encoding': 'br' }, bytes: 1000, ttfbMs: 100, error: null };
      return checkPage(r, p.parsed, { baseUrl: 'https://cardbrix.com' }).filter((i) => ['title-length', 'desc-length', 'title-missing', 'desc-missing'].includes(i.id));
    });
    expect(lengthIssues).toEqual([]);
  });
});
