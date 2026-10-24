// Selling from the player's shop in the market (client/src/lib/game/sellFlow.js): what can be sold, the listing built
// from a recognised card or LEGO box (catalog data, suggested condition, default carriers), the price as the only
// choice left, and the very same POST /api/listings fields as the sell page.
const {
  SELL_KINDS, DEFAULT_CARRIERS, availableKinds, kindName, cardForm, legoForm, priceOf, buyerPays, publishBlocker, listingFields,
  afterRecognition, errorKey, ownListings, conditionsFor,
} = require('../client/src/lib/game/sellFlow');
const { buildListingFields } = require('../client/src/lib/sell/payload');

const PRINT = {
  external_id: 'sv3pt5-199', name: 'Charizard ex', set_code: 'sv3pt5', set_name: '151', rarity: 'Special Illustration Rare',
  img_url: 'https://img/199.png', details: { localId: '199', cardCountOfficial: 165 },
};
const ALT = { ...PRINT, external_id: 'sv3pt5-183', details: { localId: '183', cardCountOfficial: 165 } };
const FALCON = { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, num_parts: 7541, img_url: null };
const fieldsOf = (pairs) => Object.fromEntries(pairs);

describe('what the shop sells', () => {
  test('the five card games the recognition reads, then LEGO; only those the server switched on', () => {
    expect(SELL_KINDS).toEqual(['onepiece', 'magic', 'pokemon', 'yugioh', 'lorcana', 'lego']);
    expect(availableKinds({ enabled: true, games: ['pokemon', 'lego', 'dragonball'] })).toEqual(['pokemon', 'lego']);
    expect(availableKinds({ enabled: false, games: ['pokemon'] })).toEqual([]);
    expect(availableKinds(null)).toEqual([]);
    expect(kindName('magic')).toBe('Magic: The Gathering');
    expect(conditionsFor('lego')).toEqual(['new', 'used', 'complete', 'parts']);
    expect(conditionsFor('pokemon')).toContain('near_mint');
  });
});

describe('the listing from a photo', () => {
  test('a card: catalog title, set, number and rarity, the language read on the card, the suggested grade and the default carriers', () => {
    const form = cardForm('pokemon', PRINT, { language: 'it', condition: 'slightly_played' });
    expect(form).toMatchObject({
      productType: 'tcg', game: 'pokemon', category: 'Pokémon', title: 'Charizard ex 199/165', cardNumber: '199/165',
      cardRarity: 'Special Illustration Rare', cardExternalId: 'sv3pt5-199', cardLanguage: 'it', condition: 'slightly_played',
    });
    expect(Object.keys(form.shippingOptions)).toEqual(DEFAULT_CARRIERS);
    expect(DEFAULT_CARRIERS).toEqual(['POSTE', 'BRT']);
  });

  test('a suggested condition that is not a real grade is dropped: the player picks one', () => {
    expect(cardForm('pokemon', PRINT, { condition: 'mint' }).condition).toBe('');
    expect(cardForm('pokemon', PRINT, null).condition).toBe('');
  });

  test('a LEGO box: catalog name, set number and year, "new" when the box looked sealed', () => {
    expect(legoForm(FALCON, { condition: 'new' })).toMatchObject({
      productType: 'lego', mainCategory: 'sets', title: 'Millennium Falcon', setNumber: '75192-1', year: '2017', condition: 'new',
    });
    expect(legoForm(FALCON, { condition: null }).condition).toBe('');
  });

  test('after the recognition: several prints -> pick, one print or a set -> price, nothing -> another photo', () => {
    expect(afterRecognition('pokemon', { status: 'matched', prints: [PRINT, ALT], reading: {} })).toEqual({ step: 'pick', prints: [PRINT, ALT] });
    const one = afterRecognition('pokemon', { status: 'matched', prints: [PRINT], reading: { condition: 'near_mint' } });
    expect(one.step).toBe('summary');
    expect(one.form.condition).toBe('near_mint');
    expect(afterRecognition('lego', { status: 'matched', set: FALCON, reading: { condition: 'used' } }).form.condition).toBe('used');
    expect(afterRecognition('pokemon', { status: 'not_found', prints: [] })).toEqual({ step: 'retry', reason: 'not_found' });
    expect(afterRecognition('pokemon', { status: 'unreadable' })).toEqual({ step: 'retry', reason: 'unreadable' });
    expect(afterRecognition('lego', { status: 'matched', set: null })).toEqual({ step: 'retry', reason: 'not_found' });
    expect(afterRecognition('pokemon', null)).toEqual({ step: 'retry', reason: 'unreadable' });
  });
});

describe('the price and publishing', () => {
  test('the price is the only thing to type: positive, at most two decimals, comma or point', () => {
    expect(priceOf('25')).toBe(25);
    expect(priceOf('12,5')).toBe(12.5);
    expect(priceOf('9.999')).toBe(10);
    for (const bad of ['', '0', '-3', 'abc', '1e3', '200000']) expect([bad, priceOf(bad)]).toEqual([bad, null]);
  });

  test('the buyer pays the CardBrix fee on top: the seller gets the price they set', () => {
    expect(buyerPays(100)).toBe(105);
    expect(buyerPays(null)).toBeNull();
  });

  test('publishing needs the photo, a name, a condition and the price', () => {
    const form = cardForm('pokemon', PRINT, { condition: 'near_mint' });
    const photo = {};
    expect(publishBlocker(form, 25, photo)).toBeNull();
    expect(publishBlocker(form, 25, null)).toBe('photo');
    expect(publishBlocker({ ...form, condition: '' }, 25, photo)).toBe('condition');
    expect(publishBlocker({ ...form, condition: 'new' }, 25, photo)).toBe('condition'); // a LEGO condition on a card
    expect(publishBlocker(form, null, photo)).toBe('price');
    expect(publishBlocker({ ...form, title: 'Ab' }, 25, photo)).toBe('title');
    expect(publishBlocker(legoForm(FALCON, { condition: 'new' }), 600, photo)).toBeNull();
  });

  test('the fields are exactly those of the sell page, published as active with the default carriers', () => {
    const form = cardForm('pokemon', PRINT, { language: 'it', condition: 'near_mint' });
    const pairs = listingFields(form, 25);
    expect(pairs).toEqual(buildListingFields({ ...form, price: '25' }, 'publish'));
    const f = fieldsOf(pairs);
    expect(f).toMatchObject({ status: 'active', productType: 'tcg', game: 'pokemon', price: '25', condition: 'near_mint', cardExternalId: 'sv3pt5-199', cardLanguage: 'it' });
    expect(JSON.parse(f.shippingOptions)).toEqual([{ carrier: 'POSTE' }, { carrier: 'BRT' }]);
    const lego = fieldsOf(listingFields(legoForm(FALCON, { condition: 'new' }), 600));
    expect(lego).toMatchObject({ status: 'active', productType: 'lego', setNumber: '75192-1', year: '2017', category: 'sets', type: 'sealed', condition: 'new', price: '600' });
  });
});

describe('messages and own listings', () => {
  test('errors map to the panel messages', () => {
    expect(errorKey({ status: 401 })).toBe('login');
    expect(errorKey({ status: 429, data: { code: 'user_daily_limit' } })).toBe('limit');
    expect(errorKey({ status: 413, data: { code: 'too_large' } })).toBe('too_large');
    expect(errorKey({ status: 400, data: { code: 'bad_image' } })).toBe('bad_image');
    expect(errorKey({ status: 503, data: { code: 'not_configured' } })).toBe('unavailable');
    expect(errorKey({ status: 500 })).toBe('generic');
  });

  test('own listings: on sale first, then drafts, then the rest', () => {
    const rows = [{ id: 1, status: 'sold' }, { id: 2, status: 'draft' }, { id: 3, status: 'active' }];
    expect(ownListings(rows).map((r) => r.id)).toEqual([3, 2, 1]);
    expect(ownListings(null)).toEqual([]);
  });
});
