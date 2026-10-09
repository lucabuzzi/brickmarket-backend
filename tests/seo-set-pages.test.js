// SEO for the Pokémon expansion pages (src/services/seoSetPages.js): own meta, real 404 for an unknown expansion,
// sitemap entries only for pages that have something to show. The database module is mocked.
jest.mock('../src/db', () => ({ query: jest.fn() }));
jest.mock('../src/services/tcgdex', () => ({ ensureSets: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/services/scryfall', () => ({ ensureSets: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/services/onepieceApi', () => ({ ensureSets: jest.fn().mockResolvedValue(undefined) }));

const { query } = require('../src/db');
const tcgdex = require('../src/services/tcgdex');
const scryfall = require('../src/services/scryfall');
const onepieceApi = require('../src/services/onepieceApi');
const { parseSetPath, buildSetMeta, fetchSetPageMeta, listSetSitemapPaths } = require('../src/services/seoSetPages');
const { renderPage } = require('../src/services/seoMeta');
const { isKnownRoute } = require('../src/services/knownRoutes');

const TEMPLATE = '<!doctype html><html lang="it"><head><title>x</title><link rel="canonical" href="https://cardbrix.com/"><meta name="description" content="d"><meta property="og:title" content="d"><meta name="twitter:title" content="d"></head><body><div id="root"></div></body></html>';
const SET_ROW = { id: '30th', name: '30° Anniversario', name_en: '30th Anniversary', series_name: 'Megaevoluzione', series_name_en: 'Mega Evolution', card_count_total: 161 };

beforeEach(() => {
  query.mockReset();
  tcgdex.ensureSets.mockClear();
  scryfall.ensureSets.mockClear();
  onepieceApi.ensureSets.mockClear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('path and meta', () => {
  test('only the two expansion paths are recognised', () => {
    expect(parseSetPath('/annunci/carte-collezionabili/pokemon/30th')).toEqual({ mode: 'annunci', game: 'pokemon', id: '30th' });
    expect(parseSetPath('/aste/carte-collezionabili/pokemon/me05/')).toEqual({ mode: 'aste', game: 'pokemon', id: 'me05' });
    expect(parseSetPath('/annunci/carte-collezionabili/magic/blb')).toEqual({ mode: 'annunci', game: 'magic', id: 'blb' });
    expect(parseSetPath('/aste/carte-collezionabili/onepiece/OP-01')).toEqual({ mode: 'aste', game: 'onepiece', id: 'OP-01' });
    for (const p of ['/annunci/carte-collezionabili/pokemon', '/annunci/carte-collezionabili/dragonball/30th', '/annunci/carte-collezionabili/pokemon/a/b', '/annunci/carte-collezionabili/pokemon/a b', '', undefined]) {
      expect(parseSetPath(p)).toBeNull();
    }
  });

  test('the router knows both pages', () => {
    expect(isKnownRoute('/annunci/carte-collezionabili/pokemon/30th')).toBe(true);
    expect(isKnownRoute('/aste/carte-collezionabili/pokemon/30th')).toBe(true);
  });

  test('titles and descriptions name the expansion, differ between listings and auctions, and stay short', () => {
    const a = buildSetMeta(SET_ROW, 'annunci');
    const b = buildSetMeta(SET_ROW, 'aste');
    expect(a.title).toContain('30° Anniversario');
    expect(b.title).toContain('30° Anniversario');
    expect(a.title).not.toBe(b.title);
    expect(a.description).toMatch(/161 carte/);
    expect(a.description).toMatch(/Megaevoluzione/);
    for (const m of [a, b]) {
      expect(m.title.length).toBeLessThanOrEqual(70);
      expect(m.description.length).toBeLessThanOrEqual(300);
    }
  });

  test('missing names and counts do not break the text', () => {
    const m = buildSetMeta({ id: 'x1' }, 'annunci');
    expect(m.title).toContain('x1');
    expect(m.description).not.toMatch(/undefined|null|NaN/);
  });
});

describe('other games', () => {
  test('titles name the game', () => {
    expect(buildSetMeta({ id: 'blb', name: 'Bloomburrow', card_count_total: 397, series_name: 'Espansioni' }, 'annunci', 'magic').title).toBe('Carte Magic Bloomburrow in vendita | CardBrix');
    expect(buildSetMeta({ id: 'OP-01', name: 'Romance Dawn' }, 'aste', 'onepiece').title).toBe('Aste carte One Piece Romance Dawn | CardBrix');
    expect(buildSetMeta({ id: 'x', name: 'X' }, 'annunci').title).toContain('Pokémon'); // the default stays Pokémon
  });

  test('a cold table is filled by the provider of the game asked for, not another one', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'blb', name: 'Bloomburrow' }] });
    const meta = await fetchSetPageMeta('/annunci/carte-collezionabili/magic/blb');
    expect(meta.title).toContain('Bloomburrow');
    expect(scryfall.ensureSets).toHaveBeenCalledTimes(1);
    expect(tcgdex.ensureSets).not.toHaveBeenCalled();
    expect(query.mock.calls[0][1]).toEqual(['blb', 'magic']);

    query.mockReset();
    query.mockResolvedValue({ rows: [] });
    expect(await fetchSetPageMeta('/aste/carte-collezionabili/onepiece/nope')).toBeNull();
    expect(onepieceApi.ensureSets).toHaveBeenCalledTimes(1);
  });

  test('the same id in another game is a different expansion', async () => {
    query.mockResolvedValue({ rows: [] });
    await fetchSetPageMeta('/annunci/carte-collezionabili/magic/30th');
    expect(query.mock.calls.every(([, params]) => params[1] === 'magic')).toBe(true);
  });
});

describe('lookup', () => {
  test('a known expansion gives meta (id matched case-insensitively), an unknown one gives null', async () => {
    query.mockResolvedValueOnce({ rows: [SET_ROW] });
    expect((await fetchSetPageMeta('/annunci/carte-collezionabili/pokemon/30TH')).title).toContain('30° Anniversario');
    expect(query.mock.calls[0][1]).toEqual(['30TH', 'pokemon']); // bound parameters, never interpolated
    query.mockResolvedValue({ rows: [] });
    expect(await fetchSetPageMeta('/annunci/carte-collezionabili/pokemon/nope')).toBeNull();
    expect(await fetchSetPageMeta('/annunci/carte-collezionabili/pokemon')).toBeNull();
  });

  test('a known expansion is not 404 just because the table was still empty: it is filled, then looked up again', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [SET_ROW] });
    const meta = await fetchSetPageMeta('/annunci/carte-collezionabili/pokemon/30th');
    expect(tcgdex.ensureSets).toHaveBeenCalledTimes(1);
    expect(meta.title).toContain('30° Anniversario');
  });

  test('a known expansion found at once does not trigger a refresh', async () => {
    query.mockResolvedValueOnce({ rows: [SET_ROW] });
    await fetchSetPageMeta('/annunci/carte-collezionabili/pokemon/30th');
    expect(tcgdex.ensureSets).not.toHaveBeenCalled();
  });

  test('if filling the table fails the answer is still just "unknown", not a crash', async () => {
    tcgdex.ensureSets.mockRejectedValueOnce(new Error('tcgdex down'));
    query.mockResolvedValue({ rows: [] });
    expect(await fetchSetPageMeta('/annunci/carte-collezionabili/pokemon/30th')).toBeNull();
  });

  test('a database error is not "unknown": it throws', async () => {
    query.mockRejectedValueOnce(new Error('db down'));
    await expect(fetchSetPageMeta('/annunci/carte-collezionabili/pokemon/30th')).rejects.toThrow('db down');
  });
});

describe('renderPage', () => {
  test('a known expansion page has its own title and canonical, status 200', async () => {
    query.mockResolvedValue({ rows: [SET_ROW] });
    const { status, html } = await renderPage('/annunci/carte-collezionabili/pokemon/30th', TEMPLATE);
    expect(status).toBe(200);
    expect(html).toContain('<title>Carte Pokémon 30° Anniversario in vendita | CardBrix</title>');
    expect(html).toContain('href="https://cardbrix.com/annunci/carte-collezionabili/pokemon/30th"');
    expect(html).not.toMatch(/name="robots" content="noindex"/);
  });

  test('an unknown expansion answers 404 with noindex, never a soft 404', async () => {
    query.mockResolvedValue({ rows: [] });
    const { status, html } = await renderPage('/annunci/carte-collezionabili/pokemon/inventata', TEMPLATE);
    expect(status).toBe(404);
    expect(html).toMatch(/name="robots" content="noindex"/);
  });

  test('with the database down the page is still served (with the default meta), not claimed missing', async () => {
    query.mockRejectedValue(new Error('db down'));
    const { status, html } = await renderPage('/aste/carte-collezionabili/pokemon/30th', TEMPLATE);
    expect(status).toBe(200);
    expect(html).toContain('CardBrix');
    expect(html).not.toMatch(/name="robots" content="noindex"/);
  });

  test('other Pokémon pages are untouched and do not query the expansion table', async () => {
    query.mockResolvedValue({ rows: [] });
    const { status } = await renderPage('/annunci/carte-collezionabili/pokemon', TEMPLATE);
    expect(status).toBe(200);
    expect(query.mock.calls.some(([sql]) => /card_sets/.test(sql))).toBe(false);
  });
});

describe('sitemap paths', () => {
  test('one path per expansion that has active listings or auctions, id in lowercase', async () => {
    query.mockResolvedValueOnce({ rows: [
      { game: 'pokemon', id: '30th', auction: false, lastmod: '2026-10-01T10:00:00Z' },
      { game: 'pokemon', id: 'ME05', auction: true, lastmod: '2026-10-02T10:00:00Z' },
      { game: 'magic', id: 'blb', auction: false, lastmod: '2026-10-03T10:00:00Z' },
      { game: 'onepiece', id: 'OP-01', auction: true, lastmod: '2026-10-04T10:00:00Z' },
    ] });
    expect(await listSetSitemapPaths()).toEqual([
      { path: '/annunci/carte-collezionabili/pokemon/30th', lastmod: '2026-10-01T10:00:00Z' },
      { path: '/aste/carte-collezionabili/pokemon/me05', lastmod: '2026-10-02T10:00:00Z' },
      { path: '/annunci/carte-collezionabili/magic/blb', lastmod: '2026-10-03T10:00:00Z' },
      { path: '/aste/carte-collezionabili/onepiece/op-01', lastmod: '2026-10-04T10:00:00Z' },
    ]);
    expect(query.mock.calls[0][0]).toMatch(/status = 'active'/);
  });

  test('every path it produces is a known route', async () => {
    query.mockResolvedValueOnce({ rows: [{ game: 'pokemon', id: '30th', auction: false, lastmod: null }, { game: 'pokemon', id: 'sv3pt5', auction: true, lastmod: null }, { game: 'magic', id: 'tblb', auction: false, lastmod: null }, { game: 'onepiece', id: 'ST-01', auction: false, lastmod: null }] });
    for (const { path } of await listSetSitemapPaths()) expect(isKnownRoute(path)).toBe(true);
  });
});
