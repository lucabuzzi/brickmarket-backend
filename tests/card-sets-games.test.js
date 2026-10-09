// Expansion catalogs of Magic (Scryfall) and One Piece (optcgapi) on the shared engine (services/cardSets.js).
// The database and the network are mocked: nothing here can reach a real DB or API.
jest.mock('../src/db', () => ({ query: jest.fn() }));

const { query } = require('../src/db');
const scryfall = require('../src/services/scryfall');
const onepiece = require('../src/services/onepieceApi');
const { createCardSetsService } = require('../src/services/cardSets');

const json = (body, ok = true) => ({ ok, json: async () => body });

beforeEach(() => {
  query.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// ── Magic ───────────────────────────────────────────────────────────────────────────────────────────
describe('Magic expansions', () => {
  const NOW = new Date('2026-10-09T12:00:00Z');
  const S = (over) => ({ code: 'abc', name: 'Some Set', released_at: '2024-01-01', set_type: 'expansion', card_count: 100, digital: false, icon_svg_uri: 'https://svgs.scryfall.io/sets/abc.svg', ...over });

  test('only real products are kept: no tokens, promos, memorabilia, digital, jokes, empty or far-future sets', () => {
    const rows = scryfall.mapScryfallSets([
      S({ code: 'blb', name: 'Bloomburrow', released_at: '2024-08-02' }),
      S({ code: 'tblb', name: 'Bloomburrow Tokens', set_type: 'token' }),
      S({ code: 'pblb', name: 'Promos', set_type: 'promo' }),
      S({ code: 'mb1', name: 'Mystery Booster', set_type: 'memorabilia' }),
      S({ code: 'ymid', name: 'Alchemy: Innistrad', set_type: 'alchemy' }),
      S({ code: 'unf', name: 'Unfinity', set_type: 'funny' }),
      S({ code: 'dig', name: 'Digital', digital: true }),
      S({ code: 'nau', name: 'Not released', released_at: '2027-02-05', card_count: 0 }),
      S({ code: 'far', name: 'Far future', released_at: '2027-02-05' }),
      S({ code: 'soon', name: 'Next month', released_at: '2026-10-30' }),
      S({ code: 'm21', name: 'Core Set 2021', set_type: 'core', released_at: '2020-07-03' }),
      S({ code: 'c21', name: 'Commander 2021', set_type: 'commander', released_at: '2021-04-23' }),
      S({ code: 'ddj', name: 'Duel Decks: Izzet vs. Golgari', set_type: 'duel_deck', released_at: '2012-09-07' }),
    ], NOW);
    expect(rows.map((r) => r.id)).toEqual(['ddj', 'm21', 'c21', 'blb', 'soon']);
  });

  test('rows are oldest first, with the English name, the icon, the date and the series label', () => {
    const rows = scryfall.mapScryfallSets([S({ code: 'BLB', name: 'Bloomburrow', released_at: '2024-08-02', card_count: 397 }), S({ code: 'm21', set_type: 'core', released_at: '2020-07-03' })], NOW);
    expect(rows.map((r) => [r.id, r.sort_order])).toEqual([['m21', 0], ['blb', 1]]); // ids are lower case
    expect(rows[1]).toMatchObject({
      game: 'magic', name: 'Bloomburrow', name_en: 'Bloomburrow', series_id: 'expansion', series_name: 'Espansioni', series_name_en: 'Expansions',
      release_date: '2024-08-02', card_count_total: 397, logo: 'https://svgs.scryfall.io/sets/abc.svg',
    });
    expect(scryfall.mapScryfallSets(null, NOW)).toEqual([]);
  });

  test('every kept set type has an Italian and an English series label', () => {
    for (const [type, label] of Object.entries(scryfall.SET_TYPES)) expect([type, !!label.it, !!label.en]).toEqual([type, true, true]);
    for (const t of ['expansion', 'core', 'masters', 'commander', 'draft_innovation', 'starter', 'duel_deck', 'from_the_vault', 'premium_deck']) expect(scryfall.SET_TYPES[t]).toBeDefined();
  });

  test('rarity gets a readable label', () => {
    expect(scryfall.rarityLabel('mythic')).toBe('Mythic Rare');
    expect(scryfall.rarityLabel('common')).toBe('Common');
    expect(scryfall.rarityLabel('weird')).toBe('Weird');
    expect(scryfall.rarityLabel(undefined)).toBeNull();
  });

  test('a card from an expansion listing is slim, flagged not-detailed, and carries its collector number', () => {
    const row = scryfall.mapScryfallListCard({
      id: 'u-1', name: 'Banishing Light', collector_number: '1', rarity: 'common', type_line: 'Enchantment', set: 'blb',
      image_uris: { normal: 'https://cards.scryfall.io/normal/1.jpg' }, oracle_text: 'long text', prices: { eur: '1.00' },
    }, { id: 'blb', name: 'Bloomburrow' });
    expect(row).toEqual({
      external_id: 'u-1', name: 'Banishing Light', set_code: 'blb', set_name: 'Bloomburrow', rarity: 'Common',
      img_url: 'https://cards.scryfall.io/normal/1.jpg', details: { localId: '1', type_line: 'Enchantment', detailed: false },
    });
    expect(JSON.stringify(row)).not.toMatch(/prices|eur|oracle/);
  });

  test('a double-faced card takes its picture from the front face', () => {
    const row = scryfall.mapScryfallListCard({ id: 'u-2', name: 'Delver', collector_number: '51', rarity: 'uncommon', card_faces: [{ image_uris: { normal: 'front.jpg' }, type_line: 'Creature' }] }, { id: 'isd', name: 'Innistrad' });
    expect(row.img_url).toBe('front.jpg');
    expect(row.details.type_line).toBe('Creature');
  });

  describe('cards of one expansion (paged)', () => {
    const card = (n) => ({ id: `u-${n}`, name: `Card ${n}`, collector_number: String(n), rarity: 'rare', image_uris: { normal: `${n}.jpg` } });
    const SET = { id: 'blb', name: 'Bloomburrow' };
    let calls;
    const page = (cards, next) => json({ data: cards, total_cards: 5, has_more: !!next, next_page: next });

    beforeEach(() => { calls = []; });

    test('follows next_page until the end, sending the headers Scryfall asks for', async () => {
      global.fetch = jest.fn(async (url, opts) => {
        calls.push([String(url), opts.headers]);
        if (String(url).includes('page=2')) return page([card(3), card(4), card(5)]);
        return page([card(1), card(2)], 'https://api.scryfall.com/cards/search?page=2');
      });
      const data = await scryfall.fetchSetCards(SET);
      expect(data.cards.map((c) => c.external_id)).toEqual(['u-1', 'u-2', 'u-3', 'u-4', 'u-5']);
      expect(data.patch).toEqual({ card_count_total: 5 });
      expect(decodeURIComponent(calls[0][0])).toContain('q=e:blb&unique=prints&order=set');
      expect(calls[0][1]['User-Agent']).toMatch(/CardBrix|BrickMarket/);
      expect(calls[0][1].Accept).toBe('application/json');
      expect(calls).toHaveLength(2);
    });

    test('a failed page means no data at all, so a half list is never cached', async () => {
      global.fetch = jest.fn(async (url) => (String(url).includes('page=2') ? json({}, false) : page([card(1)], 'https://api.scryfall.com/cards/search?page=2')));
      expect(await scryfall.fetchSetCards(SET)).toBeNull();
      global.fetch = jest.fn(async () => { throw new Error('network down'); });
      expect(await scryfall.fetchSetCards(SET)).toBeNull();
    });

    test('stops after the page limit instead of looping on a huge expansion', async () => {
      global.fetch = jest.fn(async () => page([card(1)], 'https://api.scryfall.com/cards/search?page=next'));
      const data = await scryfall.fetchSetCards(SET);
      expect(global.fetch).toHaveBeenCalledTimes(5);
      expect(data.cards).toHaveLength(5);
    });
  });
});

// ── One Piece ───────────────────────────────────────────────────────────────────────────────────────
describe('One Piece expansions', () => {
  const SETS = [{ set_name: 'Romance Dawn', set_id: 'OP-01' }, { set_name: 'Extra Booster: Memorial Collection', set_id: 'EB-01' }, { set_name: 'Adventure on Kami\'s Island', set_id: 'OP15-EB04' }];
  const DECKS = [{ structure_deck_name: 'Starter Deck 1: Straw Hat Crew', structure_deck_id: 'ST-01' }, { structure_deck_name: 'Starter Deck 2: Worst Generation', structure_deck_id: 'ST-02' }];

  test('series are told apart by the id prefix', () => {
    expect(['OP-01', 'EB-01', 'ST-01', 'OP15-EB04', 'PRB-01'].map(onepiece.seriesOf)).toEqual(['booster', 'extra', 'starter', 'booster', 'booster']);
  });

  test('starter decks come first (older), then the sets in the order the API lists them', () => {
    const rows = onepiece.mapOnePieceSets(SETS, DECKS);
    expect(rows.map((r) => [r.id, r.sort_order])).toEqual([['ST-01', 0], ['ST-02', 1], ['OP-01', 2], ['EB-01', 3], ['OP15-EB04', 4]]);
    expect(rows[0]).toMatchObject({ game: 'onepiece', name: 'Starter Deck 1: Straw Hat Crew', series_id: 'starter', series_name: 'Starter Deck', release_date: null, logo: null });
    expect(rows[3]).toMatchObject({ series_id: 'extra', series_name_en: 'Extra Boosters' });
  });

  test('a missing list is tolerated (the other still works), and so is nothing at all', () => {
    expect(onepiece.mapOnePieceSets(SETS, null).map((r) => r.id)).toEqual(['OP-01', 'EB-01', 'OP15-EB04']);
    expect(onepiece.mapOnePieceSets(null, DECKS).map((r) => r.id)).toEqual(['ST-01', 'ST-02']);
    expect(onepiece.mapOnePieceSets(null, null)).toEqual([]);
  });

  test('parallel (alternative art) prints are recognised', () => {
    expect(onepiece.variantOf('OP01-077')).toBeNull();
    expect(onepiece.variantOf('OP01-077_p1')).toBe('1');
    expect(onepiece.variantOf('OP01-077_p12')).toBe('12');
    expect(onepiece.variantOf(undefined)).toBeNull();
  });

  test('a card keeps its number, variant and a readable rarity; no prices', () => {
    const base = { card_image_id: 'OP01-077', card_set_id: 'OP01-077', card_name: 'Perona', set_id: 'OP-01', set_name: 'Romance Dawn', rarity: 'UC', card_image: 'x.jpg', card_type: 'Character', market_price: 0.6, inventory_price: 0.5 };
    const a = onepiece.mapOnePieceCard(base);
    const b = onepiece.mapOnePieceCard({ ...base, card_image_id: 'OP01-077_p1', rarity: 'SR' });
    expect(a).toMatchObject({ external_id: 'OP01-077', rarity: 'Uncommon', details: { localId: 'OP01-077', variant: null, type: 'Character' } });
    expect(b).toMatchObject({ external_id: 'OP01-077_p1', rarity: 'Super Rare', details: { localId: 'OP01-077', variant: '1' } });
    expect(JSON.stringify(a)).not.toMatch(/price/i);
    expect(onepiece.rarityLabel('ZZ')).toBe('ZZ');
  });
});

// ── The engine with a provider of its own ───────────────────────────────────────────────────────────
describe('engine: complete vs partial card rows', () => {
  function fakeProvider(cardsComplete) {
    return {
      game: 'demo', tag: 'Demo', cardsComplete,
      fetchSetRows: async () => [{ id: 's1', name: 'Set One', series_id: 'x', sort_order: 0 }],
      fetchSetCards: async () => ({ cards: [{ external_id: 'c-1', name: 'One', set_code: 's1', set_name: 'Set One', rarity: 'Rare', img_url: null, details: { localId: '1' } }], patch: {} }),
    };
  }

  function wire() {
    const sqls = [];
    query.mockImplementation(async (sql) => {
      sqls.push(sql);
      if (/SELECT COUNT\(\*\)::int AS n/.test(sql)) return { rows: [{ n: 1, last: new Date().toISOString() }] };
      if (/SELECT \* FROM card_sets WHERE game/.test(sql)) return { rows: [{ id: 's1', name: 'Set One', cards_fetched_at: null, release_date: '2024-01-01' }] };
      if (/UPDATE card_sets/.test(sql)) return { rows: [{ id: 's1', name: 'Set One' }] };
      if (/SELECT \* FROM master_cards/.test(sql)) return { rows: [{ external_id: 'c-1', details: { localId: '1' } }] };
      return { rows: [] };
    });
    return sqls;
  }

  test('whole-card providers replace the stored details; slim ones never wipe a full lookup', async () => {
    let sqls = wire();
    await createCardSetsService(fakeProvider(true)).getSet('s1');
    expect(sqls.find((s) => /INSERT INTO master_cards/.test(s))).toMatch(/details = EXCLUDED\.details/);

    query.mockReset();
    sqls = wire();
    await createCardSetsService(fakeProvider(false)).getSet('s1');
    const partial = sqls.find((s) => /INSERT INTO master_cards/.test(s));
    expect(partial).not.toMatch(/details = EXCLUDED\.details/);
    expect(partial).toMatch(/jsonb_build_object\('localId'/);
    expect(partial).toMatch(/rarity = COALESCE\(EXCLUDED\.rarity, master_cards\.rarity\)/);
  });

  test('the set lookup is case-insensitive on the cards too (legacy rows were stored upper case)', async () => {
    const sqls = wire();
    await createCardSetsService(fakeProvider(false)).getSet('S1');
    expect(sqls.find((s) => /FROM master_cards WHERE game/.test(s))).toMatch(/lower\(set_code\) = lower\(\$2\)/);
  });
});

describe('routes', () => {
  test('Magic and One Piece routers expose /sets and /sets/:id before the generic /:id', () => {
    for (const mod of ['../src/routes/catalogMagic', '../src/routes/catalogOnepiece', '../src/routes/catalogPokemon']) {
      const paths = require(mod).stack.filter((l) => l.route).map((l) => l.route.path);
      expect(paths).toContain('/sets');
      expect(paths).toContain('/sets/:id');
      expect(paths.indexOf('/sets')).toBeLessThan(paths.indexOf('/:id'));
      expect(paths.indexOf('/sets/:id')).toBeLessThan(paths.indexOf('/:id'));
    }
  });

  test('games without an expansion catalog keep their router as it was', () => {
    const paths = require('../src/routes/catalogDragonball').stack.filter((l) => l.route).map((l) => l.route.path);
    expect(paths).not.toContain('/sets');
  });
});
