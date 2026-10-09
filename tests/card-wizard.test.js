// The trading-card side of the sell wizard (client/src/lib/sell/*): details, grading rules, guided photos, payload.
// Pure logic: no React, no DB, no network.
const cards = require('../client/src/lib/sell/cards.js');
const { INITIAL_FORM, changeProductType } = require('../client/src/lib/sell/form.js');
const { validateStep, validateAll, FIELD_STEP, firstErrorField } = require('../client/src/lib/sell/validate.js');
const { buildListingFields } = require('../client/src/lib/sell/payload.js');
const draft = require('../client/src/lib/sell/draft.js');
const { shotListFor } = require('../client/src/lib/sell/shots.js');

const F = (over = {}) => ({ ...INITIAL_FORM, shippingOptions: {}, productType: 'tcg', game: 'pokemon', title: 'Charizard 4/102', condition: 'near_mint', price: '10', ...over });
const field = (fields, name) => (fields.find(([k]) => k === name) || [])[1];
const has = (fields, name) => fields.some(([k]) => k === name);

describe('guided shots', () => {
  test('the card shot list starts with front, back, corners, and three are required', () => {
    expect(shotListFor({ productType: 'tcg' }).slice(0, 3)).toEqual(['card_front', 'card_back', 'card_corners']);
    expect(cards.CARD_REQUIRED_SHOTS).toBe(3);
  });

  test('nextShot follows the photos already taken', () => {
    expect(cards.nextShot(0, 5)).toEqual({ index: 0, required: true, done: false });
    expect(cards.nextShot(2, 5)).toEqual({ index: 2, required: true, done: false });
    expect(cards.nextShot(3, 5)).toEqual({ index: 3, required: false, done: false });
    expect(cards.nextShot(5, 5)).toEqual({ index: 4, required: false, done: true });
    expect(cards.nextShot(9, 5).done).toBe(true);
  });

  test('publishing a new card needs 3 photos; editing and drafts are not held to it', () => {
    const photos = (n, mode, extra = {}) => validateStep('photos', F(), { photoCount: n, guidedCards: true, ...extra }, mode);
    expect(photos(0, 'publish')).toEqual({ photos: 'photo_required' });
    expect(photos(2, 'publish')).toEqual({ photos: 'card_photos_required' });
    expect(photos(3, 'publish')).toEqual({});
    expect(photos(2, 'draft')).toEqual({});
    expect(photos(1, 'publish', { editing: true })).toEqual({});
    expect(validateStep('photos', F(), { photoCount: 1, guidedCards: false }, 'publish')).toEqual({}); // plain /sell is unchanged
  });
});

describe('grading', () => {
  test('company and grade go together', () => {
    expect(cards.gradingError(F())).toBeNull();
    expect(cards.gradingError(F({ gradingCompany: 'psa', cardGrade: '10' }))).toBeNull();
    expect(cards.gradingError(F({ gradingCompany: 'psa' }))).toEqual({ field: 'cardGrade', code: 'grading_incomplete' });
    expect(cards.gradingError(F({ cardGrade: '9.5' }))).toEqual({ field: 'gradingCompany', code: 'grading_incomplete' });
    expect(cards.gradingError(F({ gradingCompany: 'psa', cardGrade: '   ' }))).toEqual({ field: 'cardGrade', code: 'grading_incomplete' });
  });

  test('the condition step reports a half-filled grading, even for a draft, and only for cards', () => {
    expect(validateStep('condition', F({ gradingCompany: 'bgs' }), {}, 'next')).toEqual({ cardGrade: 'grading_incomplete' });
    expect(validateStep('condition', F({ gradingCompany: 'bgs' }), {}, 'draft')).toEqual({ cardGrade: 'grading_incomplete' });
    expect(validateStep('condition', F({ gradingCompany: 'bgs', cardGrade: '9.5' }), {}, 'next')).toEqual({});
    expect(validateStep('condition', F({ productType: 'lego', gradingCompany: 'bgs' }), {}, 'next')).toEqual({});
  });

  test('length limits match the server', () => {
    expect(validateStep('condition', F({ gradingCompany: 'psa', cardGrade: '12345678901' }), {}, 'next')).toEqual({ cardGrade: 'grade_long' });
    expect(validateStep('condition', F({ cardRarity: 'x'.repeat(61) }), {}, 'next')).toEqual({ cardRarity: 'rarity_long' });
    expect(validateStep('condition', F({ cardRarity: 'x'.repeat(60), gradingCompany: 'psa', cardGrade: '1234567890' }), {}, 'next')).toEqual({});
  });

  test('every card field belongs to the condition step, so the first error gets focus there', () => {
    for (const f of ['cardLanguage', 'cardRarity', 'gradingCompany', 'cardGrade']) expect(FIELD_STEP[f]).toBe('condition');
    expect(firstErrorField('condition', { cardGrade: 'grading_incomplete' })).toBe('cardGrade');
  });

  test('validateAll still points to the photo step first when photos are short', () => {
    const r = validateAll(F({ shippingOptions: { DHL: { selected: true } } }), { photoCount: 2, guidedCards: true }, 'publish');
    expect(r.errors.photos).toBe('card_photos_required');
    expect(r.firstStep).toBe('photos');
  });
});

describe('language, rarity and labels', () => {
  test('the language list is the one the server accepts', () => {
    expect(cards.CARD_LANGUAGES).toEqual(['it', 'en', 'ja', 'de', 'fr', 'es', 'pt', 'ko', 'zh']);
    expect(cards.GRADING_COMPANIES).toEqual(['psa', 'cgc', 'bgs', 'sgc', 'other']);
  });

  test('language names come from Intl, capitalised, and never throw', () => {
    expect(cards.languageName('it', 'it')).toBe('Italiano');
    expect(cards.languageName('ja', 'en')).toBe('Japanese');
    expect(typeof cards.languageName('zz-bad', 'it')).toBe('string');
    expect(cards.languageName('it', 'not a locale!!')).toBe('IT');
  });

  test('rarity suggestions depend on the game, with a fallback', () => {
    expect(cards.raritySuggestions('pokemon')).toContain('Holo Rare');
    expect(cards.raritySuggestions('magic')).toContain('Mythic Rare');
    expect(cards.raritySuggestions('unknown-game')).toContain('Rare');
    expect(cards.raritySuggestions(undefined).length).toBeGreaterThan(0);
  });

  test('company labels and the review summary', () => {
    expect(cards.gradingCompanyLabel('psa', 'Altro')).toBe('PSA');
    expect(cards.gradingCompanyLabel('other', 'Altro')).toBe('Altro');
    const labels = { language: (c) => `lang:${c}`, otherCompany: 'Altro' };
    expect(cards.cardSummaryParts(F({ cardLanguage: 'it', cardRarity: ' Holo Rare ', gradingCompany: 'psa', cardGrade: '10' }), labels)).toEqual(['lang:it', 'Holo Rare', 'PSA 10']);
    expect(cards.cardSummaryParts(F({ gradingCompany: 'other', cardGrade: '8' }), labels)).toEqual(['Altro 8']);
    expect(cards.cardSummaryParts(F(), labels)).toEqual([]);
  });
});

describe('payload', () => {
  test('a new card sends only the details that are filled in', () => {
    const none = buildListingFields(F(), 'publish');
    for (const k of ['cardLanguage', 'cardRarity', 'cardGradingCompany', 'cardGrade']) expect(has(none, k)).toBe(false);
    const some = buildListingFields(F({ cardLanguage: 'ja', cardRarity: ' Secret Rare ', gradingCompany: 'cgc', cardGrade: '9.5' }), 'publish');
    expect(field(some, 'cardLanguage')).toBe('ja');
    expect(field(some, 'cardRarity')).toBe('Secret Rare');
    expect(field(some, 'cardGradingCompany')).toBe('cgc');
    expect(field(some, 'cardGrade')).toBe('9.5');
  });

  test('when editing, blank details are sent too so they can be cleared', () => {
    const edit = buildListingFields(F(), 'publish', { editing: true });
    for (const k of ['cardLanguage', 'cardRarity', 'cardGradingCompany', 'cardGrade']) expect(field(edit, k)).toBe('');
  });

  test('non-card listings never send card details', () => {
    const lego = buildListingFields(F({ productType: 'lego', mainCategory: 'sets', condition: 'new', cardLanguage: 'it', gradingCompany: 'psa', cardGrade: '10' }), 'publish', { editing: true });
    for (const k of ['cardLanguage', 'cardRarity', 'cardGradingCompany', 'cardGrade']) expect(has(lego, k)).toBe(false);
  });
});

describe('form and draft', () => {
  test('switching away from cards drops the card details', () => {
    const next = changeProductType(F({ cardLanguage: 'it', cardRarity: 'Rare', gradingCompany: 'psa', cardGrade: '10' }), 'lego');
    expect(next).toMatchObject({ cardLanguage: '', cardRarity: '', gradingCompany: '', cardGrade: '' });
  });

  test('the automatic draft keeps the card details and caps their length', () => {
    const saved = draft.serializeDraft(F({ cardLanguage: 'fr', cardRarity: 'x'.repeat(200), gradingCompany: 'sgc', cardGrade: '9' }), 2);
    const back = draft.parseDraft(saved);
    expect(back.form).toMatchObject({ cardLanguage: 'fr', gradingCompany: 'sgc', cardGrade: '9' });
    expect(back.form.cardRarity).toHaveLength(60);
  });
});
