// Audit follow-up: (1) more real text in the server-rendered shell for the pages the audit called "thin",
// (2) honest <lastmod> values in sitemap.xml. The database module is mocked.
jest.mock('../src/db', () => ({ query: jest.fn() }));

const { query } = require('../src/db');
const { clear } = require('../src/services/seoContent/cache');
const { wordCount } = require('../src/services/seoContent/html');
const { pageFor } = require('../src/services/seoContent/pages');
const { shellForRoute, shellForListing } = require('../src/services/seoContent');
const { catalogBlock, listingsBlock, shippingSection } = require('../src/services/seoContent/listings');
const { STATIC_PATHS } = require('../src/services/sitemapPaths');
const { pageFingerprint, refreshStored, dataDateFor, lastmodFor } = require('../src/services/sitemapLastmod');
const stored = require('../src/config/sitemapLastmod.json');
const sitemapRouter = require('../src/routes/sitemap');

const textOf = (html) => wordCount(html);
const catalogRows = (n, over = {}) => Array.from({ length: n }, (_, i) => ({ id: `card-${i}`, name: `Carta di prova ${i}`, extra: `Espansione ${i}`, ...over }));

beforeEach(() => {
  clear();
  query.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('catalog pages carry real catalog content', () => {
  test('a catalog page lists the latest entries, each linking to its own catalog page, and the live listings of that game', async () => {
    query.mockImplementation(async (sql) => {
      if (/FROM master_cards/.test(sql)) return { rows: catalogRows(12) };
      if (/FROM listings/.test(sql)) return { rows: [{ id: 'l1', title: 'Charizard base set', price: '30', type: 'used', condition: 'near_mint', product_type: 'tcg', game: 'pokemon' }] };
      return { rows: [] };
    });
    const { html } = await shellForRoute('/catalog/pokemon');
    expect(html).toContain('href="/catalog/pokemon/card-0"');
    expect(html).toContain('Carta di prova 11');
    expect(html).toContain('href="/product/l1"');
    expect(html).toContain('Aggiunti di recente al catalogo Pokémon');
    expect(textOf(html)).toBeGreaterThanOrEqual(150);
  });

  test('LEGO reads the sets table, other games the cards table filtered by game', async () => {
    query.mockResolvedValue({ rows: [] });
    await catalogBlock({ slug: 'lego', heading: 'x' });
    await catalogBlock({ slug: 'magic', heading: 'x' });
    expect(query.mock.calls[0][0]).toMatch(/FROM master_sets/);
    expect(query.mock.calls[1][0]).toMatch(/FROM master_cards/);
    expect(query.mock.calls[1][1][0]).toBe('magic');
  });

  test('entry names and ids are escaped, entries without id or name are skipped, an empty or failed read leaves the section out', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'a b/c', name: '<img src=x onerror=1>', extra: 'x&y' }, { id: null, name: 'senza id' }, { id: 'ok', name: '' }] });
    const html = await catalogBlock({ slug: 'yugioh', heading: 'Titolo' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('href="/catalog/yugioh/a%20b%2Fc"');
    expect(html).not.toContain('senza id');
    clear();
    query.mockResolvedValueOnce({ rows: [] });
    expect(await catalogBlock({ slug: 'yugioh', heading: 'Titolo' })).toBe('');
    clear();
    query.mockRejectedValueOnce(new Error('db down'));
    expect(await catalogBlock({ slug: 'yugioh', heading: 'Titolo' })).toBe('');
  });

  test('even with the database unreachable a catalog page still has its text and links', async () => {
    query.mockRejectedValue(new Error('db down'));
    const { html } = await shellForRoute('/catalog/lego');
    expect(html).toContain('<h1>Catalogo LEGO</h1>');
    expect(html).toContain('href="/annunci/lego"');
    expect(html).not.toContain('undefined');
  });

  test('the catalog hub explains the catalog on top of the list of catalogs', () => {
    const def = pageFor('/catalog');
    expect(textOf(def.body)).toBeGreaterThan(60);
    expect(def.body).toContain('href="/catalog/pokemon"');
  });
});

describe('empty categories say so honestly instead of showing nothing', () => {
  test('an empty list shows the sentence of the block; a failed read shows nothing (nothing is invented)', async () => {
    const block = { heading: 'Annunci Funko', auction: false, productType: 'funko', limit: 20, empty: 'Nessun annuncio al momento.' };
    query.mockResolvedValueOnce({ rows: [] });
    expect(await listingsBlock(block)).toContain('Nessun annuncio al momento.');
    clear();
    query.mockRejectedValueOnce(new Error('db down'));
    expect(await listingsBlock(block)).toBe('');
    clear();
    query.mockResolvedValueOnce({ rows: [] });
    expect(await listingsBlock({ ...block, empty: undefined })).toBe(''); // old behaviour kept for blocks without a sentence
  });

  test('marketplace categories get their sentence, a way to sell, and a link to the matching catalog', () => {
    const funko = pageFor('/annunci/funko');
    expect(funko.listings[0].empty).toMatch(/Non ci sono annunci attivi per Funko/);
    expect(funko.body).toContain('href="/sell"');
    expect(funko.body).toContain('href="/catalog/funko"');
    const auctions = pageFor('/aste/carte-collezionabili/magic');
    expect(auctions.listings[0].empty).toMatch(/Non ci sono aste in corso per Magic/);
    expect(auctions.body).toContain('href="/create-auction"');
    expect(auctions.body).toContain('href="/catalog/magic"');
  });

  test('empty-state text never promises credits, prices or results', () => {
    for (const p of ['/annunci/funko', '/aste', '/annunci', '/aste/lego']) {
      expect(pageFor(p).listings[0].empty).not.toMatch(/credit|€|%|garant/i);
    }
  });
});

describe('help and user directory pages', () => {
  test('help lists the FAQ questions as links to the FAQ', () => {
    const def = pageFor('/help');
    expect((def.body.match(/<a href="\/faq">/g) || []).length).toBeGreaterThanOrEqual(10);
    expect(textOf(def.body)).toBeGreaterThan(100);
  });

  test('the user directory page has its own headline instead of the generic shell', () => {
    const def = pageFor('/ricerca-utente');
    expect(def.h1).toBe('Directory Community');
    expect(def.body).toContain('href="/annunci"');
  });
});

describe('listing pages show the seller\'s shipping options', () => {
  test('carrier names and costs come from the listing itself; unknown carriers and bad JSON are ignored', () => {
    const html = shippingSection({ shipping_options: [{ carrier: 'DHL', cost: 7.9 }, { carrier: 'BRT', cost: 0 }, { carrier: 'NOPE', cost: 1 }] });
    expect(html).toContain('DHL Express');
    expect(html).toContain('BRT Corriere');
    expect(html).not.toContain('NOPE');
    expect(shippingSection({ shipping_options: '[{"carrier":"UPS","cost":5}]' })).toContain('UPS');
    expect(shippingSection({ shipping_options: 'not json' })).toBe('');
    expect(shippingSection({ shipping_options: [] })).toBe('');
    expect(shippingSection({})).toBe('');
  });

  test('a listing page includes the section, and works for listings without options', async () => {
    query.mockResolvedValue({ rows: [] });
    const base = { id: 'x', title: 'Set', price: '10', type: 'used', status: 'active', condition: 'new', product_type: 'lego' };
    const withOptions = await shellForListing({ ...base, shipping_options: [{ carrier: 'SDA', cost: 6 }] }, []);
    expect(withOptions.html).toContain('<h2>Spedizione</h2>');
    expect(withOptions.html).toContain('SDA');
    const without = await shellForListing(base, []);
    expect(without.html).not.toContain('<h2>Spedizione</h2>');
  });
});

describe('sitemap lastmod for static pages', () => {
  test('the fingerprint file covers every static page, with valid dates, and matches the current text (run `npm run sitemap:lastmod` if this fails)', () => {
    for (const p of STATIC_PATHS) {
      expect([p, Boolean(stored[p])]).toEqual([p, true]);
      expect([p, stored[p].date]).toEqual([p, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)]);
      expect([p, stored[p].hash]).toEqual([p, pageFingerprint(p)]);
    }
    expect(Object.keys(stored).filter((p) => !STATIC_PATHS.includes(p))).toEqual([]);
  });

  test('fingerprints are stable and differ between pages', () => {
    expect(pageFingerprint('/faq')).toBe(pageFingerprint('/faq'));
    expect(new Set(STATIC_PATHS.map(pageFingerprint)).size).toBe(STATIC_PATHS.length);
  });

  test('refreshStored keeps the date of unchanged pages and gives changed or new ones today', () => {
    const prev = { '/faq': { hash: pageFingerprint('/faq'), date: '2026-01-01' }, '/help': { hash: 'old', date: '2026-01-01' } };
    const next = refreshStored(['/faq', '/help', '/come-funziona'], '2026-10-05', prev);
    expect(next['/faq'].date).toBe('2026-01-01');
    expect(next['/help']).toEqual({ hash: pageFingerprint('/help'), date: '2026-10-05' });
    expect(next['/come-funziona'].date).toBe('2026-10-05');
  });

  const data = {
    groups: [
      { auction: false, product_type: 'lego', game: null, m: '2026-10-01T10:00:00Z' },
      { auction: false, product_type: 'tcg', game: 'pokemon', m: '2026-10-03T10:00:00Z' },
      { auction: false, product_type: 'tcg', game: 'magic', m: '2026-09-20T10:00:00Z' },
      { auction: true, product_type: 'funko', game: null, m: '2026-10-04T10:00:00Z' },
    ],
    catalog: { lego: '2026-09-30T00:00:00Z', pokemon: '2026-10-02T00:00:00Z' },
  };

  test('listing pages take the newest matching listing, split by auctions/fixed price, kind and game', () => {
    expect(dataDateFor('/annunci', data)).toBe('2026-10-03T10:00:00Z');
    expect(dataDateFor('/aste', data)).toBe('2026-10-04T10:00:00Z');
    expect(dataDateFor('/annunci/lego', data)).toBe('2026-10-01T10:00:00Z');
    expect(dataDateFor('/annunci/funko', data)).toBeNull(); // only an auction exists for funko
    expect(dataDateFor('/aste/funko', data)).toBe('2026-10-04T10:00:00Z');
    expect(dataDateFor('/annunci/carte-collezionabili', data)).toBe('2026-10-03T10:00:00Z');
    expect(dataDateFor('/annunci/carte-collezionabili/magic', data)).toBe('2026-09-20T10:00:00Z');
    expect(dataDateFor('/aste/carte-collezionabili/magic', data)).toBeNull();
    expect(dataDateFor('/', data)).toBe('2026-10-04T10:00:00Z');
  });

  test('catalog pages take the newest catalog entry; text pages have no live part', () => {
    expect(dataDateFor('/catalog/pokemon', data)).toBe('2026-10-02T00:00:00Z');
    expect(dataDateFor('/catalog/magic', data)).toBeNull();
    expect(dataDateFor('/catalog', data)).toBe('2026-10-02T00:00:00Z');
    expect(dataDateFor('/faq', data)).toBeNull();
    expect(dataDateFor('/annunci', {})).toBeNull();
  });

  test('lastmodFor is the later of the text date and the live date, and falls back to whichever exists', () => {
    const source = { '/annunci': { hash: 'x', date: '2026-10-05' }, '/faq': { hash: 'x', date: '2026-08-01' } };
    expect(lastmodFor('/annunci', data, source)).toBe('2026-10-05'); // the text changed after the newest listing
    expect(lastmodFor('/annunci', { groups: [{ auction: false, product_type: 'lego', game: null, m: '2026-12-01T00:00:00Z' }] }, source)).toBe('2026-12-01T00:00:00Z');
    expect(lastmodFor('/faq', data, source)).toBe('2026-08-01');
    expect(lastmodFor('/unknown', data, source)).toBeNull();
  });
});

describe('GET /sitemap.xml', () => {
  const handler = sitemapRouter.stack.find((l) => l.route && l.route.path === '/sitemap.xml').route.stack[0].handle;
  const run = async () => {
    const res = { headers: {}, set(k, v) { this.headers[k] = v; }, send(b) { this.body = b; } };
    await handler({}, res);
    return res.body;
  };
  const lastmods = (xml, path) => (xml.match(new RegExp(`<loc>https://cardbrix.com${path}</loc>(<lastmod>[^<]+</lastmod>)?`)) || [])[1] || null;

  test('every static page has a lastmod (own text date at least), listing pages use the newest listing when it is later', async () => {
    query.mockImplementation(async (sql) => {
      if (/GROUP BY 1, 2, 3/.test(sql)) return { rows: [{ auction: false, product_type: 'lego', game: null, m: new Date('2099-01-02T00:00:00Z') }] };
      if (/FROM master_cards/.test(sql)) return { rows: [{ game: 'pokemon', m: new Date('2099-01-03T00:00:00Z') }] };
      if (/FROM master_sets/.test(sql)) return { rows: [{ m: null }] };
      return { rows: [] }; // the listing urls query
    });
    const xml = await run();
    for (const p of STATIC_PATHS) expect([p, lastmods(xml, p === '/' ? '/' : p)]).toEqual([p, expect.stringMatching(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/)]);
    expect(lastmods(xml, '/annunci/lego')).toBe('<lastmod>2099-01-02</lastmod>');
    expect(lastmods(xml, '/catalog/pokemon')).toBe('<lastmod>2099-01-03</lastmod>');
    expect(lastmods(xml, '/faq')).toBe(`<lastmod>${stored['/faq'].date}</lastmod>`);
  });

  test('with the database down the static pages keep the date of their own text and nothing throws', async () => {
    clear();
    query.mockRejectedValue(new Error('db down'));
    const xml = await run();
    expect(lastmods(xml, '/faq')).toBe(`<lastmod>${stored['/faq'].date}</lastmod>`);
    expect(lastmods(xml, '/annunci')).toBe(`<lastmod>${stored['/annunci'].date}</lastmod>`);
    expect(xml.startsWith('<?xml')).toBe(true);
  });
});
