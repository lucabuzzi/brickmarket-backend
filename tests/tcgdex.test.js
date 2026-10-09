// Pokémon expansions and cards from TCGdex (src/services/tcgdex.js) + the catalog routes + the card_set listing filter.
// The database and the network are mocked: nothing here can reach a real DB or the real API.
jest.mock('../src/db', () => ({ query: jest.fn() }));
jest.mock('../src/middleware/auth', () => (req, res, next) => { req.user = { userId: 'seller-1', role: 'user' }; next(); });

const http = require('http');
const express = require('express');
const { query } = require('../src/db');
const tcgdex = require('../src/services/tcgdex');

const realFetch = global.fetch; // the real one, for calling the test server (global.fetch is replaced by the fake TCGdex)
const json = (body, ok = true) => ({ ok, json: async () => body });

// ── fake TCGdex ─────────────────────────────────────────────────────────────────────────────────────
const SERIES_LIST = [{ id: 'sv', name: 'Scarlatto e Violetto' }, { id: 'me', name: 'Megaevoluzione' }];
const SERIES = {
  sv: { id: 'sv', name: 'Scarlatto e Violetto', sets: [{ id: 'sv01', name: 'Scarlatto e Violetto', logo: 'https://x/sv01/logo', cardCount: { total: 258, official: 198 } }] },
  me: { id: 'me', name: 'Megaevoluzione', sets: [
    { id: 'me05', name: 'Buio Pesto', cardCount: { total: 120, official: 84 } },
    { id: '30th', name: '30° Anniversario', logo: 'https://x/30th/logo', cardCount: { total: 161, official: 128 } },
  ] },
};
const SERIES_EN = {
  sv: { id: 'sv', name: 'Scarlet & Violet', sets: [{ id: 'sv01', name: 'Scarlet & Violet' }] },
  me: { id: 'me', name: 'Mega Evolution', sets: [{ id: 'me05', name: 'Pitch Black' }, { id: '30th', name: '30th Anniversary' }] },
};
const SET_30TH = {
  id: '30th', name: '30° Anniversario', releaseDate: '2026-09-16', cardCount: { total: 161, official: 128 },
  cards: [
    { id: '30th-010', localId: '010', name: 'Pikachu', image: 'https://assets.tcgdex.net/it/me/30th/010' },
    { id: '30th-002', localId: '002', name: 'Exeggutor di Alola', image: 'https://assets.tcgdex.net/it/me/30th/002' },
    { id: '30th-TG1', localId: 'TG1', name: 'Gallery card' },
  ],
};
const CARD_30TH_002 = {
  id: '30th-002', localId: '002', name: 'Exeggutor di Alola', rarity: 'Rara', image: 'https://assets.tcgdex.net/it/me/30th/002',
  category: 'Pokémon', hp: 130, types: ['Erba', 'Drago'], illustrator: 'Nelnal',
  set: { id: '30th', name: '30° Anniversario' },
  variants_detailed: [{ pricing: { cardmarket: { avg: 0.1, trend: 0.03 } } }],
};

let net; // { down: boolean, calls: [] }
beforeEach(() => {
  net = { down: false, calls: [] };
  global.fetch = jest.fn(async (url) => {
    const path = String(url).replace('https://api.tcgdex.net/v2', '');
    net.calls.push(path);
    if (net.down) throw new Error('network down');
    if (path === '/it/series') return json(SERIES_LIST);
    let m;
    if ((m = path.match(/^\/it\/series\/(\w+)$/))) return json(SERIES[m[1]]);
    if ((m = path.match(/^\/en\/series\/(\w+)$/))) return json(SERIES_EN[m[1]]);
    if (path === '/it/sets/30th') return json(SET_30TH);
    if (path === '/it/cards/30th-002') return json(CARD_30TH_002);
    if (path.startsWith('/it/cards?name=')) return json([{ id: '30th-010', localId: '010', name: 'Pikachu', image: 'https://assets.tcgdex.net/it/me/30th/010' }]);
    return json({}, false);
  });
  query.mockReset();
  jest.spyOn(console, 'error').mockImplementation((...a) => { if (process.env.SHOW_ERRORS) process.stderr.write(`${a.join(' ')}\n`); });
});
afterEach(() => jest.restoreAllMocks());

// ── fake DB (just enough SQL recognition for the service) ──────────────────────────────────────────
function fakeDb(init = {}) {
  const st = { sets: [], last: null, cards: [], upsertedSets: null, ...init };
  query.mockImplementation(async (sql, params) => {
    if (/SELECT COUNT\(\*\)::int AS n/.test(sql)) return { rows: [{ n: st.sets.length, last: st.last }] };
    if (/INSERT INTO card_sets/.test(sql)) {
      st.upsertedSets = JSON.parse(params[0]);
      st.sets = st.upsertedSets.map((r) => ({ ...r, release_date: null, cards_fetched_at: null }));
      st.last = new Date().toISOString();
      return { rows: [] };
    }
    if (/FROM card_sets s\b/.test(sql)) return { rows: [...st.sets].sort((a, b) => b.sort_order - a.sort_order).map((s) => ({ ...s, listings_count: 0, auctions_count: 0 })) };
    if (/SELECT \* FROM card_sets WHERE game = \$1 AND lower\(id\)/.test(sql)) return { rows: st.sets.filter((s) => s.id.toLowerCase() === String(params[1]).toLowerCase()) };
    if (/UPDATE card_sets SET release_date/.test(sql)) {
      const s = st.sets.find((x) => x.id === params[1]);
      Object.assign(s, { release_date: params[2], cards_fetched_at: new Date().toISOString() });
      return { rows: [s] };
    }
    if (/INSERT INTO master_cards[^]*SELECT \$1, x\.external_id/.test(sql)) {
      for (const r of JSON.parse(params[1])) if (!st.cards.some((c) => c.external_id === r.external_id)) st.cards.push({ game: 'pokemon', rarity: null, ...r });
      return { rows: [] };
    }
    if (/SELECT \* FROM master_cards WHERE game = \$1 AND lower\(set_code\)/.test(sql)) return { rows: st.cards.filter((c) => String(c.set_code).toLowerCase() === String(params[1]).toLowerCase()) };
    if (/SELECT \* FROM master_cards WHERE game = \$1 AND external_id = ANY/.test(sql)) return { rows: st.cards.filter((c) => params[1].includes(c.external_id)) };
    if (/SELECT \* FROM master_cards\s+WHERE game = \$1 AND external_id = \$2/.test(sql)) return { rows: st.cards.filter((c) => c.external_id === params[1]) };
    if (/INSERT INTO master_cards \(game, external_id, name, set_code, set_name, rarity, img_url, details, fetched_at\)\s+VALUES/.test(sql)) {
      const row = { game: params[0], external_id: params[1], name: params[2], set_code: params[3], set_name: params[4], rarity: params[5], img_url: params[6], details: JSON.parse(params[7]) };
      st.cards = st.cards.filter((c) => c.external_id !== row.external_id).concat(row);
      return { rows: [row] };
    }
    if (/SELECT id, name FROM card_sets/.test(sql)) return { rows: st.sets.filter((s) => params[1].includes(s.id)).map((s) => ({ id: s.id, name: s.name })) };
    return { rows: [] };
  });
  return st;
}

describe('pure mappers', () => {
  test('image url and expansion id of a card', () => {
    expect(tcgdex.imageUrl('https://a/b/001')).toBe('https://a/b/001/high.webp');
    expect(tcgdex.imageUrl(undefined)).toBeNull();
    expect(tcgdex.setIdOfCard('30th-001', '001')).toBe('30th');
    expect(tcgdex.setIdOfCard('sv3pt5-12', '12')).toBe('sv3pt5');
    expect(tcgdex.setIdOfCard('2024sv-2', '2')).toBe('2024sv');
    expect(tcgdex.setIdOfCard('weird-id', 'zzz')).toBe('weird');
  });

  test('series rows keep the chronology and pair Italian with English names', () => {
    const rows = tcgdex.mapSeriesSets(SERIES.me, SERIES_EN.me, 10);
    expect(rows.map((r) => [r.id, r.sort_order])).toEqual([['me05', 10], ['30th', 11]]);
    expect(rows[1]).toMatchObject({ series_id: 'me', series_name: 'Megaevoluzione', series_name_en: 'Mega Evolution', name: '30° Anniversario', name_en: '30th Anniversary', card_count_total: 161, card_count_official: 128 });
    expect(tcgdex.mapSeriesSets(SERIES.me, null, 0)[0].name_en).toBeNull();
    expect(tcgdex.mapSeriesSets(null, null, 0)).toEqual([]);
  });

  test('a full card keeps useful facts and never the prices', () => {
    const row = tcgdex.mapCardDetail(CARD_30TH_002);
    expect(row).toMatchObject({ external_id: '30th-002', set_code: '30th', set_name: '30° Anniversario', rarity: 'Rara', img_url: 'https://assets.tcgdex.net/it/me/30th/002/high.webp' });
    expect(row.details).toMatchObject({ localId: '002', hp: 130, types: 'Erba, Drago', detailed: true });
    expect(JSON.stringify(row)).not.toMatch(/pricing|cardmarket|trend|avg/);
  });

  test('names TCGdex gets wrong are corrected as they are read', () => {
    const typo = { id: 'me', name: 'Megaevoluzione', sets: [{ id: '30th-c', name: 'Collzione Classica del 30°', cardCount: { total: 30, official: 30 } }, { id: '30th', name: '30° Anniversario' }] };
    const rows = tcgdex.mapSeriesSets(typo, null, 0);
    expect(rows.map((r) => r.name)).toEqual(['Collezione Classica del 30°', '30° Anniversario']);
    expect(tcgdex.applyNameFix({ id: 'x', name: 'Intatto' })).toEqual({ id: 'x', name: 'Intatto' });
    expect(tcgdex.NAME_FIXES['30th-c'].name).toBe('Collezione Classica del 30°');
  });

  test('a card from an expansion listing is flagged as not yet detailed', () => {
    expect(tcgdex.mapSetListCard(SET_30TH.cards[0], { id: '30th', name: 'X' })).toMatchObject({ external_id: '30th-010', rarity: null, details: { localId: '010', detailed: false } });
    expect(tcgdex.mapSetListCard(SET_30TH.cards[2], { id: '30th', name: 'X' }).img_url).toBeNull();
  });

  test('collector numbers sort numerically first, then the rest', () => {
    expect(['010', 'TG1', '002', '1', 'SWSH062'].sort(tcgdex.compareLocalId)).toEqual(['1', '002', '010', 'SWSH062', 'TG1']);
  });

  test('grouping keeps the order of the rows', () => {
    const g = tcgdex.groupBySeries([
      { id: '30th', series_id: 'me', series_name: 'Mega' }, { id: 'me05', series_id: 'me', series_name: 'Mega' }, { id: 'sv01', series_id: 'sv', series_name: 'SV', series_name_en: 'SVen' },
    ]);
    expect(g.map((s) => [s.id, s.sets.map((x) => x.id)])).toEqual([['me', ['30th', 'me05']], ['sv', ['sv01']]]);
    expect(g[1].name_en).toBe('SVen');
  });
});

describe('expansions cache', () => {
  test('the first use fills the table from TCGdex, oldest first, and lists newest first', async () => {
    const db = fakeDb();
    const series = await tcgdex.listSets();
    expect(db.upsertedSets.map((r) => r.id)).toEqual(['sv01', 'me05', '30th']);
    expect(db.upsertedSets.map((r) => r.sort_order)).toEqual([0, 1, 2]);
    expect(series.map((s) => s.id)).toEqual(['me', 'sv']); // newest series first
    expect(series[0].sets.map((s) => s.id)).toEqual(['30th', 'me05']); // newest set first
  });

  test('a fresh table is served without calling TCGdex', async () => {
    fakeDb({ sets: [{ id: 'me05', series_id: 'me', sort_order: 1 }], last: new Date().toISOString() });
    await tcgdex.listSets();
    expect(net.calls).toEqual([]);
  });

  test('a stale table is served as it is while a refresh runs in the background', async () => {
    const db = fakeDb({ sets: [{ id: 'old', series_id: 'x', sort_order: 1 }], last: new Date(Date.now() - 9 * 86400000).toISOString() });
    const series = await tcgdex.listSets();
    expect(series[0].sets[0].id).toBe('old'); // answered from the old rows
    await tcgdex.refreshSets(); // let the background refresh finish
    expect(net.calls).toContain('/it/series');
    expect(db.upsertedSets.map((r) => r.id)).toContain('30th');
  });

  test('a fresh table that still holds a wrong name is repaired by a refresh, not left for 7 days', async () => {
    const db = fakeDb({ sets: [{ id: '30th-c', series_id: 'me', name: 'Collzione Classica del 30°', sort_order: 1 }], last: new Date().toISOString() });
    await tcgdex.listSets();
    await tcgdex.refreshSets();
    expect(net.calls).toContain('/it/series');
    expect(db.upsertedSets.find((r) => r.id === '30th')).toBeDefined();
  });

  test('a fresh table with the right names is not refreshed', async () => {
    fakeDb({ sets: [{ id: '30th-c', series_id: 'me', name: 'Collezione Classica del 30°', sort_order: 1 }], last: new Date().toISOString() });
    await tcgdex.listSets();
    expect(net.calls).toEqual([]);
  });

  test('with TCGdex down and nothing cached, the list is simply empty', async () => {
    fakeDb();
    net.down = true;
    await expect(tcgdex.listSets()).resolves.toEqual([]);
  });

  test('concurrent refreshes share one run', async () => {
    fakeDb();
    await Promise.all([tcgdex.refreshSets(), tcgdex.refreshSets()]);
    expect(net.calls.filter((p) => p === '/it/series')).toHaveLength(1);
  });
});

describe('one expansion', () => {
  const freshSets = () => [{ game: 'pokemon', id: '30th', name: '30° Anniversario', series_id: 'me', sort_order: 2, release_date: null, cards_fetched_at: null }];

  test('opens with its cards in collector order and remembers the release date', async () => {
    const db = fakeDb({ sets: freshSets(), last: new Date().toISOString() });
    const data = await tcgdex.getSet('30TH'); // case-insensitive
    expect(data.set.release_date).toBe('2026-09-16');
    expect(data.cards.map((c) => c.details.localId)).toEqual(['002', '010', 'TG1']);
    expect(data.cards[0]).toMatchObject({ external_id: '30th-002', set_name: '30° Anniversario', img_url: 'https://assets.tcgdex.net/it/me/30th/002/high.webp' });
    expect(db.cards).toHaveLength(3);
  });

  test('a second visit does not call TCGdex again', async () => {
    fakeDb({ sets: freshSets(), last: new Date().toISOString() });
    await tcgdex.getSet('30th');
    net.calls.length = 0;
    await tcgdex.getSet('30th');
    expect(net.calls).toEqual([]);
  });

  test('an unknown expansion is null; with TCGdex down the set still opens (no cards)', async () => {
    fakeDb({ sets: freshSets(), last: new Date().toISOString() });
    expect(await tcgdex.getSet('nope')).toBeNull();
    net.down = true;
    const data = await tcgdex.getSet('30th');
    expect(data.set.id).toBe('30th');
    expect(data.cards).toEqual([]);
  });
});

describe('card adapter', () => {
  test('a card known only from its expansion is completed with its rarity', async () => {
    const db = fakeDb({ sets: [], cards: [{ game: 'pokemon', external_id: '30th-002', name: 'Exeggutor di Alola', set_code: '30th', rarity: null, details: { localId: '002', detailed: false } }] });
    const card = await tcgdex.lookupCard('30th-002');
    expect(net.calls).toEqual(['/it/cards/30th-002']);
    expect(card.rarity).toBe('Rara');
    expect(db.cards.find((c) => c.external_id === '30th-002').details.detailed).toBe(true);
  });

  test('a detailed card, and one cached from the old source, come straight from the cache', async () => {
    fakeDb({ cards: [
      { game: 'pokemon', external_id: '30th-002', name: 'A', details: { detailed: true }, rarity: 'Rara' },
      { game: 'pokemon', external_id: 'gym2-2', name: 'B', details: { supertype: 'Pokémon' }, rarity: 'Rare Holo' },
    ] });
    expect((await tcgdex.lookupCard('30th-002')).name).toBe('A');
    expect((await tcgdex.lookupCard('gym2-2')).name).toBe('B');
    expect(net.calls).toEqual([]);
  });

  test('an unknown card is null, and a network error does not throw', async () => {
    fakeDb();
    expect(await tcgdex.lookupCard('nope-1')).toBeNull();
    net.down = true;
    expect(await tcgdex.lookupCard('nope-2')).toBeNull();
  });

  test('searching by name stores the matches without rarity and returns them', async () => {
    const db = fakeDb({ sets: [{ id: '30th', name: '30° Anniversario' }] });
    const found = await tcgdex.searchCardsExternal('pika', 5);
    expect(found.map((c) => c.external_id)).toEqual(['30th-010']);
    expect(db.cards[0]).toMatchObject({ set_code: '30th', set_name: '30° Anniversario', rarity: null });
  });
});

describe('routes', () => {
  let server;
  let base;
  beforeAll(async () => {
    const app = express();
    app.use('/api/catalog/pokemon', require('../src/routes/catalogPokemon'));
    app.use('/api/listings', require('../src/routes/listings'));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  test('GET /sets answers with the series, newest first', async () => {
    fakeDb();
    const res = await realFetch(`${base}/catalog/pokemon/sets`).then((r) => r.json());
    expect(res.series[0].id).toBe('me');
    expect(res.series[0].sets[0]).toMatchObject({ id: '30th', listings_count: 0, auctions_count: 0 });
  });

  test('GET /sets/:id returns the expansion with its cards, and 404 when unknown (not swallowed by /:id)', async () => {
    fakeDb({ sets: [{ game: 'pokemon', id: '30th', name: 'X', series_id: 'me', sort_order: 1 }], last: new Date().toISOString() });
    const ok = await realFetch(`${base}/catalog/pokemon/sets/30th`);
    expect(ok.status).toBe(200);
    expect((await ok.json()).cards).toHaveLength(3);
    expect((await realFetch(`${base}/catalog/pokemon/sets/nope`)).status).toBe(404);
  });

  test('GET /:id still serves a single card', async () => {
    fakeDb({ cards: [{ game: 'pokemon', external_id: '30th-002', name: 'Exeggutor', details: { detailed: true }, rarity: 'Rara' }] });
    expect((await realFetch(`${base}/catalog/pokemon/30th-002`).then((r) => r.json())).name).toBe('Exeggutor');
  });

  const listingsSql = () => query.mock.calls.map(([sql, params]) => ({ sql, params })).find(({ sql }) => /FROM listings l/.test(sql));

  test('the card_set filter reaches the query as a bound parameter', async () => {
    query.mockResolvedValue({ rows: [] });
    expect((await realFetch(`${base}/listings?game=pokemon&card_set=30th`)).status).toBe(200);
    const q = listingsSql();
    expect(q.sql).toMatch(/l\.card_set_id = \$\d+/);
    expect(q.params).toContain('30th');
  });

  test('a malformed card_set is ignored, not interpolated', async () => {
    query.mockResolvedValue({ rows: [] });
    expect((await realFetch(`${base}/listings?card_set=${encodeURIComponent("x'; DROP TABLE listings;--")}`)).status).toBe(200);
    const q = listingsSql();
    expect(q.sql).not.toMatch(/card_set_id/);
    expect(JSON.stringify(q.params)).not.toMatch(/DROP/);
  });
});
