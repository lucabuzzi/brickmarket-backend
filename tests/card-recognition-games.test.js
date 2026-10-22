// Card recognition beyond One Piece (src/services/recognition/*.js through cardRecognition.recognizeCard): what the
// model reads on a Magic, Pokémon, Yu-Gi-Oh! or Lorcana card is cleaned, looked up in that game's public database,
// and only real prints come back. Everything is offline: the reader and the databases are fakes.
const sharp = require('sharp');
const { recognizeCard, promptFor, GAMES, RecognitionError } = require('../src/services/cardRecognition');
const { adapterFor } = require('../src/services/recognition');
const magic = require('../src/services/recognition/magic');
const pokemon = require('../src/services/recognition/pokemon');
const yugioh = require('../src/services/recognition/yugioh');
const lorcana = require('../src/services/recognition/lorcana');

const jpeg = () => sharp({ create: { width: 300, height: 420, channels: 3, background: '#777' } }).jpeg().toBuffer();
const reading = (r) => ({ isCard: true, code: null, name: null, number: null, setCode: null, rarity: null, language: 'en', ...r });
const reader = (r) => jest.fn(async () => ({ reading: reading(r), usage: null }));

/** A fake database: the first route whose test matches the URL answers; anything else is a 404. */
const db = (routes) => jest.fn(async (url) => {
  const u = decodeURIComponent(String(url));
  const hit = routes.find(([test]) => (typeof test === 'string' ? u.includes(test) : test.test(u)));
  return { ok: !!hit, json: async () => (hit ? (typeof hit[1] === 'function' ? hit[1](u) : hit[1]) : { object: 'error' }) };
});
const recognize = async (game, r, routes) => {
  const fetchImpl = db(routes);
  const out = await recognizeCard(game, await jpeg(), { reader: reader(r), fetchImpl });
  return { out, fetchImpl };
};

beforeAll(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

describe('every game', () => {
  test('the games, and a prompt naming the game with its own fields', () => {
    expect(GAMES).toEqual(['onepiece', 'magic', 'pokemon', 'yugioh', 'lorcana']);
    const p = promptFor(adapterFor('yugioh'));
    expect(p).toContain('Yu-Gi-Oh!');
    expect(p).toContain('LOB-EN001');
    expect(p).toContain('Never guess');
  });

  test('the reader is given the prompt of the game asked', async () => {
    const read = reader({ name: 'Lightning Bolt' });
    await recognizeCard('magic', await jpeg(), { reader: read, fetchImpl: db([]) });
    expect(read.mock.calls[0][1].prompt).toContain('Magic: The Gathering');
  });

  test('a game without recognition is refused before any call', async () => {
    const read = jest.fn();
    await expect(recognizeCard('dragonball', await jpeg(), { reader: read })).rejects.toBeInstanceOf(RecognitionError);
    await expect(recognizeCard('dragonball', await jpeg(), { reader: read })).rejects.toMatchObject({ code: 'unsupported_game' });
    expect(read).not.toHaveBeenCalled();
  });
});

describe('Magic', () => {
  const card = (id, name, set, cn, released = '2024-02-09') => ({ object: 'card', id, name, set, collector_number: cn, released_at: released, set_name: set.toUpperCase(), rarity: 'rare' });

  test('set code and collector number, as read', () => {
    expect(magic.setCodeOf('mkm')).toBe('MKM');
    expect(magic.setCodeOf(' 2X2 ')).toBe('2X2');
    expect(magic.setCodeOf('123')).toBeNull();
    expect(magic.collectorNumberOf('0123/286')).toBe('123');
    expect(magic.collectorNumberOf('O12')).toBe('12');
    expect(magic.collectorNumberOf('12a')).toBe('12A');
    expect(magic.collectorNumberOf('abc')).toBeNull();
  });

  test('set code + number: that exact print, name compared', async () => {
    const { out, fetchImpl } = await recognize('magic', { name: 'Expedited Inheritance', setCode: 'MKM', number: '0123/286' }, [
      ['/cards/mkm/123', card('u1', 'Expedited Inheritance', 'mkm', '123')],
    ]);
    expect(out).toMatchObject({ status: 'matched', nameMatches: true });
    expect(out.prints.map((p) => p.external_id)).toEqual(['u1']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('a foreign card: found through its printed name, offered as the English print, name not compared', async () => {
    const { out } = await recognize('magic', { name: 'Fulmine', language: 'it' }, [
      ['lang:it', { data: [{ name: 'Lightning Bolt' }] }],
      ['!"Lightning Bolt"', { data: [card('b1', 'Lightning Bolt', 'm10', '146', '2009-07-17')] }],
    ]);
    expect(out.prints.map((p) => p.external_id)).toEqual(['b1']);
    expect(out.nameMatches).toBeNull();
    expect(out.reading.language).toBe('it');
  });

  test('a misread name is corrected by the fuzzy match', async () => {
    const { out } = await recognize('magic', { name: 'Lightnin Bolt' }, [
      ['!"Lightnin Bolt"', { data: [] }],
      ['named?fuzzy', { name: 'Lightning Bolt' }],
      ['!"Lightning Bolt"', { data: [card('b1', 'Lightning Bolt', 'm10', '146')] }],
    ]);
    expect(out.prints.map((p) => p.external_id)).toEqual(['b1']);
  });

  test('no set code read: an older card, so the prints from before set codes were printed come first', async () => {
    const { out } = await recognize('magic', { name: 'Lightning Bolt' }, [
      ['!"Lightning Bolt"', { data: [card('new', 'Lightning Bolt', 'clb', '187', '2022-06-10'), card('alpha', 'Lightning Bolt', 'lea', '161', '1993-08-05')] }],
    ]);
    expect(out.prints.map((p) => p.external_id)).toEqual(['alpha', 'new']);
  });

  test('either face of a double-faced card counts as its name', async () => {
    const { out } = await recognize('magic', { name: 'Delver of Secrets', setCode: 'ISD', number: '51' }, [
      ['/cards/isd/51', card('d1', 'Delver of Secrets // Insectile Aberration', 'isd', '51')],
    ]);
    expect(out.nameMatches).toBe(true);
  });
});

describe('Pokémon', () => {
  beforeEach(() => pokemon.resetCache());
  const SETS = [{ id: 'base1', cardCount: { official: 102 } }, { id: 'hgss4', cardCount: { official: 102 } }, { id: 'sv01', cardCount: { official: 198 } }, { id: 'sv02', cardCount: { official: 193 } }];
  const detail = (id, name) => ({ id, name, localId: id.split('-').pop(), image: `https://img/${id}`, rarity: 'Rara', set: { id: id.split('-')[0], name: 'Set' } });

  test('collector numbers, with prefixes and misread digits', () => {
    expect(pokemon.parseNumber('063/198')).toEqual({ number: '63', total: '198' });
    expect(pokemon.parseNumber('TG05/TG30')).toEqual({ number: 'TG5', total: 'TG30' });
    expect(pokemon.parseNumber('SWSH063')).toEqual({ number: 'SWSH63', total: null });
    expect(pokemon.parseNumber('O63/I98')).toEqual({ number: '63', total: '198' });
    expect(pokemon.parseNumber('abc')).toBeNull();
    expect(pokemon.baseName('Pikachu VMAX')).toBe('Pikachu');
    expect(pokemon.baseName('Charizard ex')).toBe('Charizard');
  });

  test('name + number + set size: the card of that set only, as the Italian catalog row', async () => {
    const { out, fetchImpl } = await recognize('pokemon', { name: 'Charizard', number: '4/102' }, [
      ['/en/sets', SETS],
      ['/en/cards?name=Charizard', [{ id: 'base1-4', localId: '4', name: 'Charizard' }, { id: 'sv01-4', localId: '4', name: 'Charizard' }, { id: 'base1-40', localId: '40', name: 'Charizard' }]],
      ['/it/cards/base1-4', detail('base1-4', 'Charizard')],
    ]);
    expect(out).toMatchObject({ status: 'matched', nameMatches: true });
    expect(out.prints.map((p) => p.external_id)).toEqual(['base1-4']);
    expect(fetchImpl.mock.calls.map(([u]) => u).some((u) => u.includes('/it/cards/sv01-4'))).toBe(false);
  });

  test('the name is searched in the language of the card', async () => {
    const { fetchImpl } = await recognize('pokemon', { name: 'Pikachu ex', number: '063/193', language: 'it' }, [
      ['/en/sets', SETS],
      ['/it/cards?name=Pikachu', [{ id: 'sv02-063', localId: '063', name: 'Pikachu-ex' }]],
      ['/it/cards/sv02-063', detail('sv02-063', 'Pikachu-ex')],
    ]);
    expect(fetchImpl.mock.calls.some(([u]) => u.includes('/it/cards?name=Pikachu'))).toBe(true);
  });

  test('no name: the printed abbreviation points at the set; an Italian name that disagrees is flagged', async () => {
    const { out } = await recognize('pokemon', { name: 'Pikachu ex', number: '063/198', setCode: 'SVI', language: 'it' }, [
      ['/en/sets?abbreviation', [{ id: 'sv01' }]],
      ['/en/sets/sv01', { id: 'sv01', cards: [{ id: 'sv01-063', localId: '063', name: 'Magnemite' }] }],
      ['/en/sets', SETS],
      ['/it/cards?name=', []],
      ['/it/cards/sv01-063', detail('sv01-063', 'Magnemite')],
    ]);
    expect(out.prints.map((p) => p.external_id)).toEqual(['sv01-063']);
    expect(out.nameMatches).toBe(false);
  });

  test('only number and size legible: every set of that size is asked, the seller picks', async () => {
    const { out } = await recognize('pokemon', { number: '4/102' }, [
      ['/en/sets/base1', { cards: [{ id: 'base1-4', localId: '4', name: 'Charizard' }] }],
      ['/en/sets/hgss4', { cards: [{ id: 'hgss4-4', localId: '4', name: 'Drapion' }] }],
      ['/en/sets', SETS],
      [/\/it\/cards\/(base1-4|hgss4-4)/, (u) => detail(u.split('/').pop(), 'X')],
    ]);
    expect(out.prints.map((p) => p.external_id).sort()).toEqual(['base1-4', 'hgss4-4']);
  });

  test('a name without a number is not searched (hundreds of cards): not found, search by hand', async () => {
    const { out, fetchImpl } = await recognize('pokemon', { name: 'Pikachu' }, []);
    expect(out.status).toBe('not_found');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('Yu-Gi-Oh!', () => {
  const bewd = { id: 89631139, name: 'Blue-Eyes White Dragon', card_images: [{ image_url: 'https://img/1.jpg' }], card_sets: [
    { set_name: 'Legend of Blue Eyes White Dragon', set_code: 'LOB-EN001', set_rarity: 'Ultra Rare', set_rarity_code: '(UR)' },
    { set_name: 'Starter Deck: Kaiba', set_code: 'SDK-001', set_rarity: 'Ultra Rare', set_rarity_code: '(UR)' },
  ] };

  test('set codes as read', () => {
    expect(yugioh.normalizeCode('lob-en 001')).toBe('LOB-EN001');
    expect(yugioh.normalizeCode('LOB-ENO01')).toBe('LOB-EN001');
    expect(yugioh.normalizeCode('R A01-ENO45')).toBe('RA01-EN045');
    expect(yugioh.normalizeCode('SDK-001')).toBe('SDK-001');
    expect(yugioh.normalizeCode('LOB-I001')).toBe('LOB-I001');
    expect(yugioh.normalizeCode('LOB-XX001')).toBeNull();
    expect(yugioh.normalizeCode('Blue-Eyes')).toBeNull();
    expect(yugioh.lookupCodes('LOB-IT001')).toEqual(['LOB-EN001', 'LOB-IT001', 'LOB-001', 'LOB-E001']);
  });

  test('a code: the prints of that code, with the catalog card id (read by name) and expansion slug', async () => {
    const { out } = await recognize('yugioh', { code: 'LOB-EN001', name: 'Blue-Eyes White Dragon' }, [
      ['cardsetsinfo.php?setcode=LOB-EN001', { id: 89631146, name: 'Blue-Eyes White Dragon', set_code: 'LOB-EN001' }],
      ['cardinfo.php?name=Blue-Eyes White Dragon', { data: [bewd] }],
    ]);
    expect(out).toMatchObject({ status: 'matched', nameMatches: true });
    expect(out.prints).toHaveLength(1);
    expect(out.prints[0]).toMatchObject({ external_id: '89631139_LOB-EN001_UR', set_code: 'legend-of-blue-eyes-white-dragon' });
  });

  test('an Italian code is looked up as its English twin; the language stays Italian, the name is not compared', async () => {
    const { out } = await recognize('yugioh', { code: 'LOB-IT001', name: 'Drago Bianco Occhi Blu', language: 'it' }, [
      ['cardsetsinfo.php?setcode=LOB-EN001', { id: 89631146, name: 'Blue-Eyes White Dragon' }],
      ['cardinfo.php?name=', { data: [bewd] }],
    ]);
    expect(out.prints.map((p) => p.external_id)).toEqual(['89631139_LOB-EN001_UR']);
    expect(out.reading.language).toBe('it');
    expect(out.nameMatches).toBeNull();
  });

  test('no legible code: every print of the card named', async () => {
    const { out } = await recognize('yugioh', { name: 'BLUE-EYES WHITE DRAGON' }, [
      ['cardinfo.php?name=BLUE-EYES WHITE DRAGON', { data: [bewd] }],
    ]);
    expect(out.prints.map((p) => p.details.localId)).toEqual(['LOB-EN001', 'SDK-001']);
    expect(out.nameMatches).toBe(true);
  });

  test('an unknown code and no name: not found', async () => {
    const { out } = await recognize('yugioh', { code: 'ZZZ-EN999' }, []);
    expect(out.status).toBe('not_found');
  });
});

describe('Lorcana', () => {
  const ratigan = { Unique_ID: 'SSK-123', Name: 'Ratigan - Party Crasher', Set_ID: 'SSK', Set_Name: 'Shimmering Skies', Card_Num: 123, Rarity: 'Rare', Image: 'https://img/r.png' };

  test('set number + collector number: that card', async () => {
    const { out, fetchImpl } = await recognize('lorcana', { name: 'Ratigan - Party Crasher', number: '123/204', setCode: '5' }, [
      ['set_num=5;card_num=123', [ratigan]],
    ]);
    expect(out).toMatchObject({ status: 'matched', nameMatches: true });
    expect(out.prints.map((p) => p.external_id)).toEqual(['SSK-123']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('no set number: by name, kept to the collector number read', async () => {
    const { out } = await recognize('lorcana', { name: 'Ratigan - Party Crasher', number: '123/204' }, [
      ['name~Ratigan', [ratigan, { ...ratigan, Unique_ID: 'ROF-010', Card_Num: 10, Name: 'Ratigan - Criminal Mastermind' }]],
    ]);
    expect(out.prints.map((p) => p.external_id)).toEqual(['SSK-123']);
  });

  test('collector numbers as read', () => {
    expect(lorcana.cardNumberOf('123/204')).toBe(123);
    expect(lorcana.cardNumberOf('I2O/204')).toBe(120);
    expect(lorcana.cardNumberOf('x')).toBeNull();
  });
});
