// Expansion catalogs of Yu-Gi-Oh! (YGOPRODeck) and Lorcana (lorcana-api.com) on the shared engine.
// The database is mocked: nothing here can reach a real DB.
jest.mock('../src/db', () => ({ query: jest.fn() }));

const ygo = require('../src/services/ygoprodeck');
const lorcana = require('../src/services/lorcanaApi');

const NOW = new Date('2026-10-09T12:00:00Z');

// ── Yu-Gi-Oh! ───────────────────────────────────────────────────────────────────────────────────────
describe('Yu-Gi-Oh! expansions', () => {
  const S = (name, code, date, n = 50) => ({ set_name: name, set_code: code, tcg_date: date, num_of_cards: n, set_image: `https://images.ygoprodeck.com/images/sets/${code}.jpg` });

  test('the id is a slug of the name, because the set code is shared by several sets', () => {
    expect(ygo.slugify('Legend of Blue Eyes White Dragon')).toBe('legend-of-blue-eyes-white-dragon');
    expect(ygo.slugify("Yugi's Legendary Decks")).toBe('yugi-s-legendary-decks');
    expect(ygo.slugify("Tin of the Pharaoh's Gods & Co.")).toBe('tin-of-the-pharaoh-s-gods-and-co');
    expect(ygo.slugify('Café Duel')).toBe('cafe-duel');
    const rows = ygo.mapYugiohSets([
      S('Absolute Powerforce', 'ABPF', '2010-02-12'),
      S('Absolute Powerforce: Special Edition', 'ABPF', '2010-03-26'),
      S('Absolute Powerforce Sneak Peek Participation Card', 'ABPF', '2010-02-06', 1),
    ], NOW);
    expect(rows.map((r) => r.id)).toEqual(['absolute-powerforce', 'absolute-powerforce-special-edition']);
  });

  test('ids always fit what a listing accepts, and a collision after cutting is told apart by the code', () => {
    const long = 'A'.repeat(70);
    const rows = ygo.mapYugiohSets([S(`${long} One`, 'AAA1', '2020-01-01'), S(`${long} Two`, 'AAA2', '2020-01-02')], NOW);
    for (const r of rows) expect(r.id).toMatch(/^[a-z0-9-]{1,60}$/);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2);
    expect(rows[1].id.endsWith('-aaa2')).toBe(true);
  });

  test('Sneak Peek handouts and far-future sets are left out; the rest is oldest first, grouped by year, no images', () => {
    const rows = ygo.mapYugiohSets([
      S('Newer Set', 'NEW1', '2024-03-01'), S('Older Set', 'OLD1', '2002-03-08'), S('Undated', 'UND1', null),
      S('Far Future', 'FUT1', '2027-06-01'), S('Next Month', 'SOON', '2026-10-30'), S('Foo Sneak Peek Participation Card', 'SP1', '2005-08-06', 1),
    ], NOW);
    expect(rows.map((r) => r.name)).toEqual(['Undated', 'Older Set', 'Newer Set', 'Next Month']);
    expect(rows.map((r) => r.series_id)).toEqual(['other', '2002', '2024', '2026']);
    expect(rows[1]).toMatchObject({ game: 'yugioh', series_name: '2002', release_date: '2002-03-08', card_count_total: null, logo: null, sort_order: 1 }); // num_of_cards counts prints, not cards
    expect(rows[0].series_name_en).toBe('Other');
    expect(ygo.mapYugiohSets(null, NOW)).toEqual([]);
  });

  test('the region in a print code gives the language', () => {
    const f = ygo.languageOfPrintCode;
    expect([f('LOB-EN001'), f('LOB-E001'), f('LOB-001'), f('LOB-I001'), f('LOB-IT001'), f('LOB-F001'), f('LOB-DE001'), f('LOB-SP001'), f('LOB-PT001'), f('LOB-JP001'), f('LOB-KR001'), f('SDK-G001')])
      .toEqual(['en', 'en', 'en', 'it', 'it', 'fr', 'de', 'es', 'pt', 'ja', 'ko', 'de']);
    expect(f(undefined)).toBe('en');
    expect(f('weird')).toBe('en');
  });

  describe('prints', () => {
    const SET = { id: 'legend-of-blue-eyes-white-dragon', name: 'Legend of Blue Eyes White Dragon' };
    const card = {
      id: 89631139, name: 'Blue-Eyes White Dragon', type: 'Normal Monster', race: 'Dragon', attribute: 'LIGHT', level: 8, atk: 3000, def: 2500, desc: 'This legendary dragon...',
      card_images: [{ image_url: 'https://images.ygoprodeck.com/images/cards/89631139.jpg' }],
      card_sets: [
        { set_name: 'Legend of Blue Eyes White Dragon', set_code: 'LOB-001', set_rarity: 'Ultra Rare', set_rarity_code: '(UR)' },
        { set_name: 'Legend of Blue Eyes White Dragon', set_code: 'LOB-E001', set_rarity: 'Ultra Rare', set_rarity_code: '(UR)' },
        { set_name: 'Legend of Blue Eyes White Dragon', set_code: 'LOB-EN001', set_rarity: 'Secret Rare', set_rarity_code: '(ScR)' },
        { set_name: 'Starter Deck: Kaiba', set_code: 'SDK-001', set_rarity: 'Ultra Rare', set_rarity_code: '(UR)' },
      ],
    };

    test('one row per print of THIS expansion, with print code, rarity and language', () => {
      const rows = ygo.mapYugiohPrints([card], SET);
      expect(rows.map((r) => r.external_id)).toEqual(['89631139_LOB-001_UR', '89631139_LOB-E001_UR', '89631139_LOB-EN001_ScR']);
      expect(rows[2]).toMatchObject({
        name: 'Blue-Eyes White Dragon', set_code: SET.id, set_name: SET.name, rarity: 'Secret Rare',
        img_url: 'https://images.ygoprodeck.com/images/cards/89631139.jpg',
        details: { localId: 'LOB-EN001', language: 'en', cardId: 89631139, type: 'Normal Monster', atk: 3000 },
      });
      for (const r of rows) expect(r.external_id).toMatch(/^[A-Za-z0-9._-]{1,60}$/); // what a listing accepts
    });

    test('a print without a rarity code still gets a valid id', () => {
      const rows = ygo.mapYugiohPrints([{ ...card, card_sets: [{ set_name: SET.name, set_code: 'LOB-001', set_rarity: 'Common' }] }], SET);
      expect(rows[0].external_id).toBe('89631139_LOB-001_Common');
      expect(ygo.mapYugiohPrints([{ ...card, card_sets: [{ set_name: SET.name, set_code: 'LOB-001' }] }], SET)[0].external_id).toBe('89631139_LOB-001_X');
    });

    test('nothing for a card of other expansions, or for no data', () => {
      expect(ygo.mapYugiohPrints([{ ...card, card_sets: [{ set_name: 'Other Set', set_code: 'XX-001' }] }], SET)).toEqual([]);
      expect(ygo.mapYugiohPrints(null, SET)).toEqual([]);
    });
  });
});

// ── Lorcana ─────────────────────────────────────────────────────────────────────────────────────────
describe('Lorcana expansions', () => {
  const L = (Set_ID, Name, Release_Date, Set_Num, Cards = 204) => ({ Set_ID, Name, Release_Date, Set_Num, Cards });

  test("sets come oldest first with date and count; the Illumineer's Quest is its own group", () => {
    const rows = lorcana.mapLorcanaSets([
      L('AOV', 'Attack of the Vine!', '2026-07-24', 13, 207), L('QU1', "Illumineer's Quest: Deep Trouble", '2024-05-17', 4, 35),
      L('URS', "Ursula's Return", '2024-05-17', 4), L('TFC', 'The First Chapter', '2023-08-18', 1), L('FUT', 'Far', '2027-09-01', 99),
    ], NOW);
    expect(rows.map((r) => r.id)).toEqual(['TFC', 'QU1', 'URS', 'AOV']);
    expect(rows[0]).toMatchObject({ game: 'lorcana', name: 'The First Chapter', series_id: 'main', series_name: 'Set principali', series_name_en: 'Main sets', release_date: '2023-08-18', card_count_total: 204, logo: null, sort_order: 0 });
    expect(rows[1]).toMatchObject({ series_id: 'quest', card_count_total: 35 });
    expect(lorcana.mapLorcanaSets(null, NOW)).toEqual([]);
  });

  test('a card keeps its id as its number', () => {
    const row = lorcana.mapLorcanaCard({ Unique_ID: 'TFC-001', Name: 'Ariel - On Human Legs', Rarity: 'Uncommon', Image: 'x.png', Type: 'Character', Set_ID: 'TFC', Set_Name: 'The First Chapter' });
    expect(row).toMatchObject({ external_id: 'TFC-001', name: 'Ariel - On Human Legs', rarity: 'Uncommon', details: { localId: 'TFC-001', type: 'Character' } });
  });
});

describe('games without an expansion catalog stay as they are', () => {
  test('Dragon Ball and Funko have no /sets', () => {
    for (const mod of ['../src/routes/catalogDragonball', '../src/routes/catalogFunko']) {
      expect(require(mod).stack.filter((l) => l.route).map((l) => l.route.path)).not.toContain('/sets');
    }
  });

  test('Yu-Gi-Oh! and Lorcana now have them, before the generic /:id', () => {
    for (const mod of ['../src/routes/catalogYugioh', '../src/routes/catalogLorcana']) {
      const paths = require(mod).stack.filter((l) => l.route).map((l) => l.route.path);
      expect(paths).toContain('/sets');
      expect(paths.indexOf('/sets/:id')).toBeLessThan(paths.indexOf('/:id'));
    }
  });
});
