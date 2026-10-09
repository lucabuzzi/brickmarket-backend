// The Pokémon catalog picker of the sell wizard (client/src/lib/sell/catalog.js) and how it reaches the form,
// the payload and the automatic draft. Pure logic: no React, no DB, no network.
const cat = require('../client/src/lib/sell/catalog.js');
const { INITIAL_FORM, changeProductType, selectGame } = require('../client/src/lib/sell/form.js');
const { buildListingFields } = require('../client/src/lib/sell/payload.js');
const draft = require('../client/src/lib/sell/draft.js');

const F = (over = {}) => ({ ...INITIAL_FORM, shippingOptions: {}, productType: 'tcg', game: 'pokemon', title: 'Charizard', condition: 'near_mint', price: '10', ...over });
const field = (fields, name) => (fields.find(([k]) => k === name) || [])[1];
const has = (fields, name) => fields.some(([k]) => k === name);

const SERIES = [
  { id: 'me', name: 'Megaevoluzione', name_en: 'Mega Evolution', sets: [
    { id: '30th', name: '30° Anniversario', name_en: '30th Anniversary', card_count_official: 128, card_count_total: 161 },
    { id: 'me05', name: 'Buio Pesto', name_en: 'Pitch Black', card_count_official: 84, card_count_total: 120 },
  ] },
  { id: 'sv', name: 'Scarlatto e Violetto', name_en: 'Scarlet & Violet', sets: [
    { id: 'sv01', name: 'Scarlatto e Violetto', name_en: 'Scarlet & Violet', card_count_official: 198, card_count_total: 258 },
  ] },
];
const SET = SERIES[0].sets[0];
const CARDS = [
  { external_id: '30th-002', name: 'Exeggutor di Alola', set_code: '30th', details: { localId: '002' } },
  { external_id: '30th-029', name: 'Pikachu', set_code: '30th', details: { localId: '029' } },
  { external_id: '30th-030', name: 'Pikachu Volo V', set_code: '30th', details: { localId: '030' } },
  { external_id: '30th-TG1', name: 'Carta Galleria', set_code: '30th', details: { localId: 'TG1' } },
];

describe('names and numbers', () => {
  test('Italian UI shows Italian names, any other language the English ones, with fallbacks', () => {
    expect(cat.setDisplayName(SET, 'it-IT')).toBe('30° Anniversario');
    expect(cat.setDisplayName(SET, 'en')).toBe('30th Anniversary');
    expect(cat.setDisplayName({ id: 'x', name: 'Solo IT' }, 'de')).toBe('Solo IT');
    expect(cat.setDisplayName({ id: 'x' }, 'it')).toBe('x');
    expect(cat.seriesDisplayName(SERIES[0], 'fr')).toBe('Mega Evolution');
  });

  test('collector number as printed on the card', () => {
    expect(cat.trimNumber('029')).toBe('29');
    expect(cat.trimNumber('TG05')).toBe('TG05');
    expect(cat.cardNumberLabel('029', 128)).toBe('29/128');
    expect(cat.cardNumberLabel('029', null)).toBe('29');
    expect(cat.cardNumberLabel('TG05', 30)).toBe('TG05');
    expect(cat.cardNumberLabel('', 128)).toBe('');
    expect(cat.cardNumberLabel(undefined, 128)).toBe('');
  });
});

describe('findSet', () => {
  test('finds an expansion by id ignoring case, or null', () => {
    expect(cat.findSet(SERIES, '30TH')).toBe(SERIES[0].sets[0]);
    expect(cat.findSet(SERIES, 'sv01').name).toBe('Scarlatto e Violetto');
    expect(cat.findSet(SERIES, 'nope')).toBeNull();
    expect(cat.findSet(SERIES, undefined)).toBeNull();
    expect(cat.findSet(null, '30th')).toBeNull();
  });
});

describe('searching', () => {
  test('expansions match by name in either language or by id, ignoring case and accents; empty series disappear', () => {
    expect(cat.filterSeries(SERIES, '').length).toBe(2);
    expect(cat.filterSeries(SERIES, 'anniversar').map((s) => s.sets.map((x) => x.id))).toEqual([['30th']]);
    expect(cat.filterSeries(SERIES, 'PITCH').map((s) => s.sets.map((x) => x.id))).toEqual([['me05']]);
    expect(cat.filterSeries(SERIES, 'sv01').map((s) => s.id)).toEqual(['sv']);
    expect(cat.filterSeries(SERIES, 'megaevoluzione')[0].sets).toHaveLength(2); // the series name matches every set in it
    expect(cat.filterSeries(SERIES, 'zzzz')).toEqual([]);
    expect(cat.filterSeries(SERIES, 'é à')).toEqual([]);
  });

  test('cards match by name or by collector number (with or without zeros)', () => {
    expect(cat.filterCards(CARDS, 'pikachu').cards.map((c) => c.external_id)).toEqual(['30th-029', '30th-030']);
    expect(cat.filterCards(CARDS, '29').cards.map((c) => c.external_id)).toEqual(['30th-029']);
    expect(cat.filterCards(CARDS, '029').cards.map((c) => c.external_id)).toEqual(['30th-029']);
    expect(cat.filterCards(CARDS, 'tg1').cards.map((c) => c.external_id)).toEqual(['30th-TG1']);
    expect(cat.filterCards(CARDS, '').total).toBe(4);
    expect(cat.filterCards(CARDS, 'nope')).toEqual({ cards: [], total: 0 });
  });

  test('a long result list is capped but reports the real total', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ external_id: `x-${i}`, name: 'Pikachu', details: { localId: String(i) } }));
    const r = cat.filterCards(many, 'pika', 40);
    expect(r.cards).toHaveLength(40);
    expect(r.total).toBe(100);
  });
});

describe('choosing a card', () => {
  test('fills title, number, card id, expansion; rarity and language only when still empty', () => {
    const card = { ...CARDS[1], rarity: 'Rara Holo' };
    expect(cat.pickCardPatch(card, SET, F())).toEqual({
      cardSetId: '30th', cardSetName: '30° Anniversario', cardExternalId: '30th-029', cardNumber: '29/128',
      title: 'Pikachu 29/128', cardRarity: 'Rara Holo', cardLanguage: 'it',
    });
    const typed = cat.pickCardPatch(card, SET, F({ cardRarity: 'Mia rarità', cardLanguage: 'ja' }));
    expect(typed).not.toHaveProperty('cardRarity');
    expect(typed).not.toHaveProperty('cardLanguage');
    expect(cat.pickCardPatch(CARDS[1], SET, F())).not.toHaveProperty('cardRarity'); // the list row has no rarity yet
  });

  test('a card without a number keeps a clean title', () => {
    const p = cat.pickCardPatch({ external_id: 'x-1', name: 'Misteriosa', details: {} }, SET, F());
    expect(p.title).toBe('Misteriosa');
    expect(p.cardNumber).toBe('');
  });

  test('changing the expansion clears the card chosen in the previous one', () => {
    expect(cat.clearCardPatch()).toEqual({ cardExternalId: '', cardNumber: '' });
  });
});

describe('form', () => {
  const linked = F({ cardSetId: '30th', cardSetName: '30° Anniversario', cardNumber: '29/128', cardExternalId: '30th-029' });

  test('another game or another product type drops the catalog link', () => {
    expect(selectGame(linked, 'magic', 'Magic')).toMatchObject({ cardSetId: '', cardSetName: '', cardNumber: '', cardExternalId: '' });
    expect(changeProductType(linked, 'lego')).toMatchObject({ cardSetId: '', cardNumber: '', cardExternalId: '' });
  });

  test('picking the same game again keeps it', () => {
    expect(selectGame(linked, 'pokemon', 'Pokémon')).toMatchObject({ cardSetId: '30th', cardExternalId: '30th-029' });
  });
});

describe('payload', () => {
  const linked = F({ cardSetId: '30th', cardNumber: ' 29/128 ', cardExternalId: '30th-029' });

  test('a Pokémon card sends the catalog link, only what is filled in', () => {
    const f = buildListingFields(linked, 'publish');
    expect(field(f, 'cardSetId')).toBe('30th');
    expect(field(f, 'cardNumber')).toBe('29/128');
    expect(field(f, 'cardExternalId')).toBe('30th-029');
    const none = buildListingFields(F(), 'publish');
    for (const k of ['cardSetId', 'cardNumber', 'cardExternalId']) expect(has(none, k)).toBe(false);
  });

  test('when editing, blanks are sent too so the link can be removed', () => {
    const f = buildListingFields(F(), 'publish', { editing: true });
    for (const k of ['cardSetId', 'cardNumber', 'cardExternalId']) expect(field(f, k)).toBe('');
  });

  test('other games and other products never send it', () => {
    for (const over of [{ game: 'yugioh' }, { productType: 'lego', mainCategory: 'sets', condition: 'new' }]) {
      const f = buildListingFields({ ...linked, ...over }, 'publish', { editing: true });
      for (const k of ['cardSetId', 'cardNumber', 'cardExternalId']) expect(has(f, k)).toBe(false);
    }
  });
});

describe('automatic draft', () => {
  test('keeps the catalog choice and caps the lengths', () => {
    const saved = draft.serializeDraft(F({ cardSetId: '30th', cardSetName: 'x'.repeat(500), cardNumber: '29/128', cardExternalId: '30th-029' }), 1);
    const back = draft.parseDraft(saved).form;
    expect(back).toMatchObject({ cardSetId: '30th', cardNumber: '29/128', cardExternalId: '30th-029' });
    expect(back.cardSetName).toHaveLength(300);
  });
});

describe('more than one game', () => {
  const MAGIC_SET = { id: 'blb', name: 'Bloomburrow', name_en: 'Bloomburrow', card_count_official: 397 };
  const OP_SET = { id: 'OP-01', name: 'Romance Dawn', name_en: 'Romance Dawn' };

  test('only the games with an expansion catalog are listed (same list as the server)', () => {
    expect(cat.CATALOG_GAMES).toEqual(['pokemon', 'magic', 'onepiece']);
    expect(cat.hasCatalog('magic')).toBe(true);
    expect(cat.hasCatalog('yugioh')).toBe(false);
    expect(cat.hasCatalog(undefined)).toBe(false);
    const { SET_GAMES } = require('../src/services/cardDetails');
    expect([...SET_GAMES].sort()).toEqual([...cat.CATALOG_GAMES].sort());
  });

  test('every catalog game has an example for the search box', () => {
    for (const g of cat.CATALOG_GAMES) expect(typeof cat.SET_EXAMPLE[g]).toBe('string');
  });

  test('the collector number reads like the game prints it', () => {
    expect(cat.cardNumberLabel('029', 128)).toBe('29/128'); // Pokémon is the default
    expect(cat.cardNumberLabel('029', 128, 'pokemon')).toBe('29/128');
    expect(cat.cardNumberLabel('119', 397, 'magic')).toBe('119'); // no printed total in the Magic catalog
    expect(cat.cardNumberLabel('OP01-077', null, 'onepiece')).toBe('OP01-077');
    expect(cat.titleNumber('1', 'magic')).toBe('#1');
    expect(cat.titleNumber('1', 'pokemon')).toBe('1');
    expect(cat.titleNumber('OP01-077', 'onepiece')).toBe('OP01-077');
    expect(cat.titleNumber('12a', 'magic')).toBe('12a');
  });

  test('picking a Magic card: "#" before the bare number, English, rarity from the listing', () => {
    const card = { external_id: 'u-1', name: 'Banishing Light', rarity: 'Common', set_code: 'blb', details: { localId: '1' } };
    expect(cat.pickCardPatch(card, MAGIC_SET, F({ game: 'magic' }), 'magic')).toEqual({
      cardSetId: 'blb', cardSetName: 'Bloomburrow', cardExternalId: 'u-1', cardNumber: '1',
      title: 'Banishing Light #1', cardRarity: 'Common', cardLanguage: 'en',
    });
  });

  test('picking a One Piece card (a parallel print): the id is the number, English', () => {
    const card = { external_id: 'OP01-077_p1', name: 'Perona (Box Topper)', rarity: 'Uncommon', set_code: 'OP-01', details: { localId: 'OP01-077', variant: '1' } };
    const p = cat.pickCardPatch(card, OP_SET, F({ game: 'onepiece' }), 'onepiece');
    expect(p).toMatchObject({ cardSetId: 'OP-01', cardNumber: 'OP01-077', cardExternalId: 'OP01-077_p1', title: 'Perona (Box Topper) OP01-077', cardLanguage: 'en' });
  });

  test('Pokémon behaves as before (Italian, number over total)', () => {
    const card = { external_id: '30th-029', name: 'Pikachu', rarity: 'Rara', set_code: '30th', details: { localId: '029' } };
    expect(cat.pickCardPatch(card, { id: '30th', name: '30° Anniversario', card_count_official: 128 }, F()))
      .toMatchObject({ title: 'Pikachu 29/128', cardLanguage: 'it', cardNumber: '29/128' });
  });

  test('logos: TCGdex gets its file extension, complete URLs are left alone', () => {
    expect(cat.setLogoSrc('https://assets.tcgdex.net/it/me/me03/logo')).toBe('https://assets.tcgdex.net/it/me/me03/logo.webp');
    expect(cat.setLogoSrc('https://assets.tcgdex.net/it/me/me03/logo.png')).toBe('https://assets.tcgdex.net/it/me/me03/logo.png');
    expect(cat.setLogoSrc('https://svgs.scryfall.io/sets/blb.svg?1791172800')).toBe('https://svgs.scryfall.io/sets/blb.svg?1791172800');
    expect(cat.setLogoSrc(null)).toBe('');
  });

  test('the payload sends the link for Magic and One Piece too, never for a game without a catalog', () => {
    for (const game of ['magic', 'onepiece']) {
      const f = buildListingFields(F({ game, cardSetId: 'x1', cardNumber: '5', cardExternalId: 'x1-5' }), 'publish');
      expect(field(f, 'cardSetId')).toBe('x1');
      expect(field(f, 'cardExternalId')).toBe('x1-5');
    }
    expect(has(buildListingFields(F({ game: 'lorcana', cardSetId: 'x1' }), 'publish', { editing: true }), 'cardSetId')).toBe(false);
  });

  test('switching game clears the previous game link', () => {
    const linked = F({ game: 'magic', cardSetId: 'blb', cardSetName: 'Bloomburrow', cardNumber: '1', cardExternalId: 'u-1' });
    expect(selectGame(linked, 'onepiece', 'One Piece')).toMatchObject({ cardSetId: '', cardExternalId: '' });
    expect(selectGame(linked, 'magic', 'Magic')).toMatchObject({ cardSetId: 'blb' });
  });
});
