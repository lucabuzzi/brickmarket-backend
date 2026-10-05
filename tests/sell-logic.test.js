// Pure logic behind the redesigned /sell wizard (client/src/lib/sell/*). No React, no DB, no network.
const form = require('../client/src/lib/sell/form.js');
const { validateStep, validateAll, firstErrorField, STEP_IDS, FIELD_STEP, LIMITS } = require('../client/src/lib/sell/validate.js');
const { buildListingFields } = require('../client/src/lib/sell/payload.js');
const { completeness, WEIGHTS } = require('../client/src/lib/sell/score.js');
const draft = require('../client/src/lib/sell/draft.js');
const { buildPreviewListing, PREVIEW_PLACEHOLDER } = require('../client/src/lib/sell/preview.js');

const { INITIAL_FORM, parseDecimal, isPositive, changeProductType, selectGame, selectedCarriers, TCG_CONDITIONS, LEGO_CONDITIONS } = form;
const F = (over = {}) => ({ ...INITIAL_FORM, shippingOptions: {}, ...over });
const ship = (...ids) => Object.fromEntries(ids.map((id) => [id, { selected: true }]));

describe('form helpers', () => {
  test('parseDecimal accepts comma or dot and nothing else', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal('149')).toBe(149);
    expect(parseDecimal(' 7 ')).toBe(7);
    for (const bad of ['', '   ', 'abc', '1e3', '-5', '1.2.3', '12abc', null, undefined, '--']) expect([bad, parseDecimal(bad)]).toEqual([bad, NaN]);
    expect(isPositive('0')).toBe(false);
    expect(isPositive('0,01')).toBe(true);
    expect(isPositive('-1')).toBe(false);
  });

  test('changeProductType resets exactly what no longer applies', () => {
    const lego = F({ productType: 'lego', title: 'Falcon', setNumber: '75192', mainCategory: 'sets', category: 'Star Wars', year: '2017', condition: 'new' });
    const toTcg = changeProductType(lego, 'tcg');
    expect(toTcg).toMatchObject({ productType: 'tcg', title: 'Falcon', condition: '', game: '', mainCategory: '', setNumber: '', year: '', category: '' }); // the LEGO theme does not follow
    const toFunko = changeProductType(lego, 'funko');
    expect(toFunko).toMatchObject({ productType: 'funko', condition: '', mainCategory: '', setNumber: '', year: '', category: '' });
    const tcg = F({ productType: 'tcg', game: 'pokemon', category: 'Pokémon', condition: 'near_mint' });
    expect(changeProductType(tcg, 'lego')).toMatchObject({ productType: 'lego', game: '', category: '', condition: '' });
  });

  test('choosing the type that is already selected, or an unknown one, changes nothing', () => {
    const f = F({ condition: 'used', title: 'x' });
    expect(changeProductType(f, 'lego')).toBe(f);
    expect(changeProductType(f, 'boh')).toBe(f);
  });

  test('selectGame also fills the theme with the game name', () => {
    expect(selectGame(F({ productType: 'tcg' }), 'pokemon', 'Pokémon')).toMatchObject({ game: 'pokemon', category: 'Pokémon' });
    expect(selectGame(F({ productType: 'tcg', category: 'keep' }), 'magic')).toMatchObject({ game: 'magic', category: 'keep' });
  });

  test('selectedCarriers lists only ticked carriers', () => {
    expect(selectedCarriers({ DHL: { selected: true }, UPS: { selected: false }, BRT: { selected: true } })).toEqual(['DHL', 'BRT']);
    expect(selectedCarriers(undefined)).toEqual([]);
  });
});

describe('validation: what the server enforces is caught on the field', () => {
  const what = (over, mode = 'next') => validateStep('what', F(over), {}, mode);

  test('title: required, 5+ to go on or publish, 1+ for a draft, 300 max', () => {
    expect(what({ title: '' }).title).toBe('title_required');
    expect(what({ title: '   ' }).title).toBe('title_required');
    expect(what({ title: 'Abcd', mainCategory: 'sets' }).title).toBe('title_short');
    expect(what({ title: 'Abcde', mainCategory: 'sets' }).title).toBeUndefined();
    expect(what({ title: 'Ab' }, 'draft').title).toBeUndefined();
    expect(what({ title: 'x'.repeat(301), mainCategory: 'sets' }).title).toBe('title_long');
    expect(what({ title: 'x'.repeat(301) }, 'draft').title).toBe('title_long');
  });

  test('LEGO needs a main category to go on (a draft does not); cards need the game even for a draft', () => {
    expect(what({ title: 'Falcon UCS' }).mainCategory).toBe('main_category_required');
    expect(what({ title: 'Falcon UCS', mainCategory: 'mocs' }).mainCategory).toBeUndefined();
    expect(what({ title: 'Falcon UCS' }, 'draft').mainCategory).toBeUndefined();
    expect(what({ productType: 'tcg', title: 'Charizard' }).game).toBe('game_required');
    expect(what({ productType: 'tcg', title: 'Charizard' }, 'draft').game).toBe('game_required');
    expect(what({ productType: 'tcg', title: 'Charizard', game: 'pokemon' }).game).toBeUndefined();
    expect(what({ productType: 'funko', title: 'Funko Pop' })).toEqual({}); // nothing else to choose
  });

  test('year must be an integer 1900-2100, set number at most 20 characters (LEGO only)', () => {
    const base = { title: 'Falcon UCS', mainCategory: 'sets' };
    for (const y of ['1899', '2101', '20.5', 'abc']) expect([y, what({ ...base, year: y }).year]).toEqual([y, 'year_invalid']);
    for (const y of ['', '1900', '2017', '2100']) expect([y, what({ ...base, year: y }).year]).toEqual([y, undefined]);
    expect(what({ ...base, setNumber: '1'.repeat(21) }).setNumber).toBe('set_number_long');
    expect(what({ ...base, setNumber: '75192-1' }).setNumber).toBeUndefined();
    expect(what({ productType: 'funko', title: 'Funko Pop', year: '1' })).toEqual({}); // not a Funko field
  });

  test('photos: only publishing a NEW listing needs one; editing and drafts never do; more than 5 is refused', () => {
    expect(validateStep('photos', F(), { photoCount: 0 }, 'publish')).toEqual({ photos: 'photo_required' });
    expect(validateStep('photos', F(), { photoCount: 1 }, 'publish')).toEqual({});
    expect(validateStep('photos', F(), { photoCount: 0, editing: true }, 'publish')).toEqual({});
    expect(validateStep('photos', F(), { photoCount: 0 }, 'next')).toEqual({});
    expect(validateStep('photos', F(), { photoCount: 0 }, 'draft')).toEqual({});
    expect(validateStep('photos', F(), { photoCount: 6 }, 'next')).toEqual({ photos: 'photo_too_many' });
  });

  test('condition is required to go on, not for a draft', () => {
    expect(validateStep('condition', F(), {}, 'next')).toEqual({ condition: 'condition_required' });
    expect(validateStep('condition', F({ condition: 'used' }), {}, 'next')).toEqual({});
    expect(validateStep('condition', F(), {}, 'draft')).toEqual({});
  });

  test('price must be > 0 and at least one carrier must be ticked', () => {
    const p = (over, mode = 'next') => validateStep('price', F(over), {}, mode);
    expect(p({}).price).toBe('price_required');
    expect(p({ price: '0' }).price).toBe('price_invalid');
    expect(p({ price: '-3' }).price).toBe('price_invalid');
    expect(p({ price: '12,50', shippingOptions: ship('DHL') })).toEqual({});
    expect(p({ price: '12' }).shipping).toBe('shipping_required');
    expect(p({ price: '12', shippingOptions: { DHL: { selected: false } } }).shipping).toBe('shipping_required');
    expect(p({}, 'draft')).toEqual({}); // a draft needs neither
  });

  test('package dimensions are optional, but when filled in they must be positive (not for cards)', () => {
    const base = { price: '10', shippingOptions: ship('DHL') };
    expect(validateStep('price', F({ ...base, weightKg: '0' }), {}, 'next').weightKg).toBe('dimension_invalid');
    expect(validateStep('price', F({ ...base, lengthCm: '-4' }), {}, 'next').lengthCm).toBe('dimension_invalid');
    expect(validateStep('price', F({ ...base, weightKg: '1,2', lengthCm: '30', widthCm: '20', heightCm: '10' }), {}, 'next')).toEqual({});
    expect(validateStep('price', F({ ...base, productType: 'tcg', weightKg: '0' }), {}, 'next')).toEqual({});
  });

  test('text limits: description 10000, internal notes 2000 (professional sellers only)', () => {
    const base = { price: '10', shippingOptions: ship('DHL') };
    expect(validateStep('price', F({ ...base, description: 'x'.repeat(10001) }), {}, 'next').description).toBe('description_long');
    expect(validateStep('price', F({ ...base, description: 'x'.repeat(10000) }), {}, 'next').description).toBeUndefined();
    expect(validateStep('price', F({ ...base, proNotes: 'x'.repeat(2001) }), { isPro: true }, 'next').proNotes).toBe('pro_notes_long');
    expect(validateStep('price', F({ ...base, proNotes: 'x'.repeat(2001) }), { isPro: false }, 'next').proNotes).toBeUndefined();
  });

  test('validateAll reports every error and the first step that has one', () => {
    const r = validateAll(F({ title: 'Falcon UCS', mainCategory: 'sets', condition: 'used' }), { photoCount: 0 }, 'publish');
    expect(r.errors).toEqual({ photos: 'photo_required', price: 'price_required', shipping: 'shipping_required' });
    expect(r.firstStep).toBe('photos');
    const ok = validateAll(F({ title: 'Falcon UCS', mainCategory: 'sets', condition: 'used', price: '99', shippingOptions: ship('BRT') }), { photoCount: 2 }, 'publish');
    expect(ok).toEqual({ errors: {}, firstStep: null });
    expect(validateAll(F(), { photoCount: 0 }, 'publish').firstStep).toBe('what');
  });

  test('every field is attached to a real step, and firstErrorField follows on-screen order', () => {
    for (const step of Object.values(FIELD_STEP)) expect(STEP_IDS).toContain(step);
    expect(firstErrorField('what', { year: 'year_invalid', title: 'title_required' })).toBe('title');
    expect(firstErrorField('price', { shipping: 'shipping_required', price: 'price_required' })).toBe('price');
    expect(firstErrorField('photos', {})).toBeNull();
    expect(LIMITS.titleMin).toBe(5);
  });
});

describe('payload: the API contract is unchanged', () => {
  // A verbatim copy of what pages/Sell.jsx sent before the redesign (submit()), kept here as the reference.
  function legacyFields(s, mode, isPro) {
    const isLego = s.productType === 'lego';
    const p = parseFloat(String(s.price).replace(',', '.'));
    const out = [];
    out.push(['title', s.title.trim()]);
    out.push(['productType', s.productType]);
    if (s.productType === 'tcg' && s.game) out.push(['game', s.game]);
    if (isLego && s.setNumber) out.push(['setNumber', s.setNumber.trim()]);
    out.push(['category', isLego ? s.mainCategory : 'sets']);
    if (s.category) out.push(['theme', s.category]);
    if (isLego && s.year) out.push(['year', s.year]);
    const conditionMap = { new: 'new', used: 'used', complete: 'complete', parts: 'parts' };
    out.push(['type', s.condition === 'new' ? 'sealed' : 'used']);
    out.push(['condition', s.productType === 'tcg' ? s.condition : conditionMap[s.condition] || 'used']);
    if (isLego && s.boxCondition) out.push(['boxCondition', s.boxCondition]);
    if (isLego && s.instructions) out.push(['instructions', s.instructions]);
    if (isLego) out.push(['isComplete', String(s.isComplete)]);
    if (s.description) out.push(['description', s.description.trim()]);
    if (isPro && s.proNotes) out.push(['proNotes', s.proNotes.trim()]);
    const activeShipping = Object.entries(s.shippingOptions).filter(([, o]) => o.selected).map(([id]) => ({ carrier: id }));
    out.push(['shippingOptions', JSON.stringify(activeShipping)]);
    if (s.productType !== 'tcg') {
      if (s.weightKg) out.push(['weightKg', s.weightKg]);
      if (s.lengthCm) out.push(['lengthCm', s.lengthCm]);
      if (s.widthCm) out.push(['widthCm', s.widthCm]);
      if (s.heightCm) out.push(['heightCm', s.heightCm]);
    }
    out.push(['shippingCost', '0']);
    if (!Number.isNaN(p) && p > 0) out.push(['price', String(p)]);
    out.push(['status', mode === 'draft' ? 'draft' : 'active']);
    return out;
  }

  const variants = [];
  for (const productType of ['lego', 'tcg', 'funko']) {
    const conditions = productType === 'tcg' ? TCG_CONDITIONS : LEGO_CONDITIONS;
    for (const condition of conditions) for (const price of ['12,5', '99.99', '1']) for (const withExtras of [false, true]) {
      variants.push(F({
        productType, condition, price, shippingOptions: ship('DHL', 'BRT'),
        title: '  Millennium Falcon  ', game: productType === 'tcg' ? 'pokemon' : '', category: productType === 'tcg' ? 'Pokémon' : withExtras ? 'Star Wars' : '',
        mainCategory: productType === 'lego' ? 'sets' : '', setNumber: productType === 'lego' && withExtras ? ' 75192 ' : '', year: productType === 'lego' && withExtras ? '2017' : '',
        boxCondition: productType === 'lego' && withExtras ? 'Mint (Perfetta)' : '', instructions: productType === 'lego' && withExtras ? 'Yes (Presenti)' : '', isComplete: withExtras,
        weightKg: withExtras ? '1.2' : '', lengthCm: withExtras ? '30' : '', widthCm: withExtras ? '20' : '', heightCm: withExtras ? '10' : '',
        description: withExtras ? '  Bello  ' : '', proNotes: withExtras ? '  scaffale 3 ' : '',
      }));
    }
  }

  test('every valid form sends exactly the same fields, in the same order, as before (publish and draft, pro or not)', () => {
    expect(variants.length).toBeGreaterThan(40);
    for (const f of variants) {
      expect(validateAll(f, { photoCount: 1 }, 'publish').errors).toEqual({}); // only forms the wizard lets through
      for (const mode of ['publish', 'draft']) for (const isPro of [false, true]) {
        expect(buildListingFields(f, mode, { isPro })).toEqual(legacyFields(f, mode, isPro));
      }
    }
  });

  test('a year that arrives as a number (edit mode) is sent as a string like FormData would', () => {
    const f = F({ title: 'Falcon', mainCategory: 'sets', condition: 'used', price: '5', shippingOptions: ship('DHL'), year: 2017 });
    expect(buildListingFields(f, 'publish').find(([k]) => k === 'year')).toEqual(['year', '2017']);
  });

  test('prices: comma decimals, and an invalid or zero price is simply not sent', () => {
    const base = { title: 'Falcon', mainCategory: 'sets', condition: 'used', shippingOptions: ship('DHL') };
    const price = (v) => buildListingFields(F({ ...base, price: v }), 'draft').find(([k]) => k === 'price');
    expect(price('12,5')).toEqual(['price', '12.5']);
    expect(price('0')).toBeUndefined();
    expect(price('')).toBeUndefined();
    expect(price('abc')).toBeUndefined();
  });

  test('what changed on purpose: a draft saved before the LEGO category was chosen uses the default "sets"', () => {
    const f = F({ title: 'Falcon' });
    expect(buildListingFields(f, 'draft').find(([k]) => k === 'category')).toEqual(['category', 'sets']);
    expect(buildListingFields(f, 'publish').find(([k]) => k === 'category')).toEqual(['category', '']); // publish is validated first
  });

  test('what changed on purpose: a card draft without a grade omits "condition" instead of sending an empty value', () => {
    const f = F({ productType: 'tcg', game: 'pokemon', title: 'Charizard' });
    expect(buildListingFields(f, 'draft').some(([k]) => k === 'condition')).toBe(false);
    expect(buildListingFields({ ...f, condition: 'near_mint' }, 'draft').find(([k]) => k === 'condition')).toEqual(['condition', 'near_mint']);
  });

  test('professional notes are sent only for professional sellers; dimensions never for cards', () => {
    const f = F({ productType: 'tcg', game: 'pokemon', title: 'Charizard', condition: 'near_mint', proNotes: 'nota', weightKg: '1' });
    const names = (opts) => buildListingFields(f, 'publish', opts).map(([k]) => k);
    expect(names({ isPro: false })).not.toContain('proNotes');
    expect(names({ isPro: true })).toContain('proNotes');
    expect(names({ isPro: true })).not.toContain('weightKg');
  });
});

describe('completeness meter', () => {
  const full = F({ title: 'Millennium Falcon', mainCategory: 'sets', condition: 'new', price: '99', shippingOptions: ship('DHL'), description: 'Set completo, scatola perfetta, mai aperto.' });

  test('weights add up to 100; an empty form is 0%, a complete one 100%', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(completeness(F(), { photoCount: 0 })).toMatchObject({ percent: 0, hint: 'title' });
    const done = completeness(full, { photoCount: 3 });
    expect(done).toMatchObject({ percent: 100, hint: null, missing: [] });
  });

  test('photos count in tiers: 1 is the essential, 3 is full', () => {
    const at = (n) => completeness(full, { photoCount: n }).percent;
    expect([at(0), at(1), at(2), at(3), at(5)]).toEqual([75, 90, 95, 100, 100]);
    expect(completeness(full, { photoCount: -2 }).percent).toBe(75);
  });

  test('what is missing is listed in the order the wizard asks for it, so the hint is the next natural step', () => {
    expect(completeness(F(), { photoCount: 0 }).missing).toEqual(['title', 'category', 'photos', 'condition', 'price', 'shipping', 'description']);
    expect(completeness({ ...full, title: '' }, { photoCount: 0 }).missing).toEqual(['title', 'photos']);
  });

  test('the hint names the next thing, and tells "more photos" from "a first photo"', () => {
    expect(completeness(full, { photoCount: 0 }).hint).toBe('photos');
    expect(completeness(full, { photoCount: 1 }).hint).toBe('photos_more');
    const noDesc = { ...full, description: '' };
    expect(completeness(noDesc, { photoCount: 3 }).hint).toBe('description');
    expect(completeness({ ...noDesc, description: 'Bello' }, { photoCount: 3 }).hint).toBe('description_more');
    expect(completeness({ ...full, price: '' }, { photoCount: 3 }).hint).toBe('price');
  });

  test('the category share depends on the product: LEGO main category, cards the game, Funko nothing', () => {
    expect(completeness({ ...full, mainCategory: '' }, { photoCount: 3 }).hint).toBe('category');
    const tcg = { ...full, productType: 'tcg', mainCategory: '', game: '' };
    expect(completeness(tcg, { photoCount: 3 }).hint).toBe('game');
    expect(completeness({ ...tcg, game: 'pokemon' }, { photoCount: 3 }).percent).toBe(100);
    expect(completeness({ ...full, productType: 'funko', mainCategory: '' }, { photoCount: 3 }).percent).toBe(100);
  });

  test('a title shorter than 5 characters earns nothing (it could not be published)', () => {
    expect(completeness({ ...full, title: 'Abcd' }, { photoCount: 3 }).parts.title.earned).toBe(0);
  });
});

describe('automatic draft (localStorage)', () => {
  const NOW = 1_800_000_000_000;
  const filled = F({ productType: 'tcg', game: 'pokemon', title: 'Charizard 4/102', category: 'Pokémon', condition: 'near_mint', price: '45', description: 'Base Set', shippingOptions: ship('DHL', 'UPS') });

  test('keys are per user and versioned', () => {
    expect(draft.draftKey('u-1')).toBe('cardbrix_sell_draft_v1:u-1');
    expect(draft.draftKey('u-1')).not.toBe(draft.draftKey('u-2'));
    expect(draft.draftKey(undefined)).toBe('cardbrix_sell_draft_v1:anon');
  });

  test('a form survives a round trip, with the step', () => {
    const back = draft.parseDraft(draft.serializeDraft(filled, 3, NOW), NOW + 1000);
    expect(back.step).toBe(3);
    expect(back.savedAt).toBe(NOW);
    expect(back.form).toMatchObject({ productType: 'tcg', game: 'pokemon', title: 'Charizard 4/102', condition: 'near_mint', price: '45', description: 'Base Set' });
    expect(Object.keys(back.form.shippingOptions).sort()).toEqual(['DHL', 'UPS']);
  });

  test('only text is stored: never photos or files, whatever is on the form object', () => {
    const raw = draft.serializeDraft({ ...filled, files: [{ name: 'a.jpg' }], images: ['x'], token: 'secret' }, 1, NOW);
    expect(raw).not.toMatch(/a\.jpg|secret|files|images|token/);
  });

  test('an untouched form is not worth saving', () => {
    expect(draft.isDraftWorthSaving(F())).toBe(false);
    expect(draft.isDraftWorthSaving(F({ productType: 'tcg', game: 'magic', category: 'Magic' }))).toBe(false); // only picking a type
    expect(draft.isDraftWorthSaving(F({ title: '  ' }))).toBe(false);
    expect(draft.isDraftWorthSaving(F({ title: 'x' }))).toBe(true);
    expect(draft.parseDraft(draft.serializeDraft(F(), 1, NOW), NOW)).toBeNull();
  });

  test('anything wrong in storage is ignored, never thrown', () => {
    const ok = JSON.parse(draft.serializeDraft(filled, 2, NOW));
    const bad = [
      undefined, null, '', 'not json', '[]', '"x"', 42,
      JSON.stringify({ ...ok, v: 99 }),
      JSON.stringify({ ...ok, savedAt: 'ieri' }),
      JSON.stringify({ ...ok, savedAt: NOW - draft.DRAFT_MAX_AGE_MS - 1 }), // expired
      JSON.stringify({ ...ok, savedAt: NOW + 3_600_000 }), // from the future
      JSON.stringify({ ...ok, form: null }),
      JSON.stringify({ ...ok, form: { ...ok.form, productType: 'auto' } }),
    ];
    for (const raw of bad) expect([String(raw).slice(0, 30), draft.parseDraft(raw, NOW + 10)]).toEqual([String(raw).slice(0, 30), null]);
  });

  test('unknown keys are dropped, types and lengths are enforced, prototype pollution is inert', () => {
    const ok = JSON.parse(draft.serializeDraft(filled, 2, NOW));
    const hostile = JSON.stringify({
      ...ok,
      form: { ...ok.form, title: 'x'.repeat(5000), price: 12345, evil: '<script>', description: 'd'.repeat(20000), isComplete: 'yes',
        shippingOptions: { DHL: { selected: true }, 'rm -rf': { selected: true }, UPS: { selected: 'true' }, '__proto__': { selected: true } } },
    });
    const back = draft.parseDraft(hostile.replace('"shippingOptions"', '"shippingOptions"'), NOW + 10);
    expect(back.form.title).toHaveLength(400);
    expect(back.form.price).toBe(''); // a number, not a string: dropped
    expect(back.form.description).toHaveLength(10000);
    expect(back.form.isComplete).toBe(false);
    expect(back.form.evil).toBeUndefined();
    expect(Object.keys(back.form.shippingOptions)).toEqual(['DHL']);
    expect({}.selected).toBeUndefined();
  });

  test('the step is clamped to 1-4', () => {
    const at = (step) => draft.parseDraft(JSON.stringify({ ...JSON.parse(draft.serializeDraft(filled, 1, NOW)), step }), NOW).step;
    expect([at(0), at(2), at(9), at(-3), at('x'), at(2.5)]).toEqual([1, 2, 4, 1, 1, 1]);
  });
});

describe('live preview listing', () => {
  test('feeds ListingCard: trimmed title, positive price, neutral condition until chosen', () => {
    const p = buildPreviewListing(F({ title: '  Falcon  ', price: '149,9', setNumber: ' 75192 ' }), { sellerName: 'luca' });
    expect(p).toMatchObject({ id: 'preview', title: 'Falcon', price: 149.9, condition: '—', set_number: '75192', seller_username: 'luca', status: 'active', type: 'used', product_type: 'lego' });
    expect(buildPreviewListing(F({ condition: 'near_mint', productType: 'tcg', game: 'pokemon' })).condition).toBe('near_mint');
  });

  test('no price (or an invalid one) shows no price at all', () => {
    for (const v of ['', '0', '-4', 'abc']) expect([v, buildPreviewListing(F({ price: v })).price]).toEqual([v, null]);
  });

  test('without a photo the branded placeholder is used (a data URI: no network request)', () => {
    expect(buildPreviewListing(F()).images).toEqual([PREVIEW_PLACEHOLDER]);
    expect(buildPreviewListing(F(), { image: 'blob:http://x/abc' }).images).toEqual(['blob:http://x/abc']);
    expect(PREVIEW_PLACEHOLDER.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    const svg = decodeURIComponent(PREVIEW_PLACEHOLDER.split(',').slice(1).join(','));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toMatch(/https?:\/\//.source.replace('\\/\\/', '//').replace(/^/, '(?<!xmlns="http:)')); // no external reference besides the xmlns
  });
});

describe('adding photos', () => {
  const { mergePhotos, removePhotoAt, isImageFile } = require('../client/src/lib/sell/photos.js');
  const img = (name, size = 100) => ({ name, size, lastModified: 1, type: 'image/jpeg' });

  test('picking again ADDS to the selection instead of replacing it', () => {
    const first = mergePhotos([], [img('a.jpg'), img('b.jpg')]);
    const second = mergePhotos(first.files, [img('c.jpg')]);
    expect(second.files.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  test('non-images and repeats are skipped and counted; the cap is 5 and the overflow is reported', () => {
    const r = mergePhotos([img('a.jpg')], [img('a.jpg'), { name: 'doc.pdf', size: 1, lastModified: 1, type: 'application/pdf' }, img('b.jpg'), img('c.jpg'), img('d.jpg'), img('e.jpg'), img('f.jpg')]);
    expect(r.files.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg']);
    expect(r).toMatchObject({ duplicates: 1, notImage: 1, overflow: 1 });
  });

  test('two different files with the same name are both kept; the same name and size and date is a repeat', () => {
    expect(mergePhotos([img('IMG_1.jpg', 100)], [img('IMG_1.jpg', 200)]).files).toHaveLength(2);
    expect(mergePhotos([img('IMG_1.jpg', 100)], [img('IMG_1.jpg', 100)]).files).toHaveLength(1);
  });

  test('odd input never throws', () => {
    expect(isImageFile(null)).toBe(false);
    expect(isImageFile({ type: undefined })).toBe(false);
    expect(mergePhotos([], []).files).toEqual([]);
    expect(mergePhotos([], [{ name: 'x', size: 1, lastModified: 1 }]).notImage).toBe(1);
  });

  test('removing a photo by position keeps the order of the rest (the first one is the cover)', () => {
    const files = ['a', 'b', 'c'].map((n) => img(`${n}.jpg`));
    expect(removePhotoAt(files, 0).map((f) => f.name)).toEqual(['b.jpg', 'c.jpg']);
    expect(removePhotoAt(files, 9)).toHaveLength(3);
  });
});
