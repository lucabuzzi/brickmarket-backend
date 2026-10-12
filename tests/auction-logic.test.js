// Pure logic behind the /create-auction wizard (client/src/lib/auction/*). No React, no DB, no network.
// Mirrors tests/sell-logic.test.js: 'what'/'photos'/'condition' are identical to a listing's (reused from
// lib/sell/validate.js), so only the auction-specific bits (starting bid, duration, payload, draft, preview)
// get their own coverage here.
const form = require('../client/src/lib/auction/form.js');
const { validateStep, validateAll, firstErrorField, STEP_IDS, FIELD_STEP } = require('../client/src/lib/auction/validate.js');
const { buildAuctionFields } = require('../client/src/lib/auction/payload.js');
const { completeness, WEIGHTS } = require('../client/src/lib/auction/score.js');
const draft = require('../client/src/lib/auction/draft.js');
const { buildPreviewListing, PREVIEW_PLACEHOLDER } = require('../client/src/lib/auction/preview.js');

const { INITIAL_FORM, auctionEndDate } = form;
const F = (over = {}) => ({ ...INITIAL_FORM, shippingOptions: {}, ...over });
const ship = (...ids) => Object.fromEntries(ids.map((id) => [id, { selected: true }]));

describe('form: auction-only fields', () => {
  test('starting bid replaces price; duration defaults to the free 7-day standard', () => {
    expect(INITIAL_FORM).toMatchObject({ startingBid: '', durationMode: 'standard', customEndDate: '' });
    expect(INITIAL_FORM.price).toBeUndefined();
  });

  test('auctionEndDate: standard is 7 days from now, custom is whatever the seller picked', () => {
    const now = new Date('2026-01-01T12:00:00.000Z');
    expect(auctionEndDate(F({ durationMode: 'standard' }), now).toISOString()).toBe('2026-01-08T12:00:00.000Z');
    expect(auctionEndDate(F({ durationMode: 'custom', customEndDate: '2026-02-01T10:00' }), now).toISOString()).toBe(new Date('2026-02-01T10:00').toISOString());
    expect(auctionEndDate(F({ durationMode: 'custom', customEndDate: '' }), now)).toBeNull();
    expect(auctionEndDate(F({ durationMode: 'custom', customEndDate: 'not a date' }), now)).toBeNull();
  });
});

describe('validation: starting bid, duration and the rest of the auction step', () => {
  const price = (over, mode = 'next') => validateStep('price', F(over), {}, mode);

  test('starting bid must be > 0; a draft needs neither it nor a carrier', () => {
    expect(price({}).startingBid).toBe('starting_bid_required');
    expect(price({ startingBid: '0' }).startingBid).toBe('starting_bid_invalid');
    expect(price({ startingBid: '-3' }).startingBid).toBe('starting_bid_invalid');
    expect(price({ startingBid: '12,50', shippingOptions: ship('DHL') })).toEqual({});
    expect(price({ startingBid: '12' }).shipping).toBe('shipping_required');
    expect(price({}, 'draft')).toEqual({});
  });

  test('a standard-duration auction never needs a custom end date', () => {
    expect(price({ startingBid: '10', durationMode: 'standard', shippingOptions: ship('DHL') })).toEqual({});
  });

  test('a custom duration needs a future date', () => {
    expect(price({ startingBid: '10', durationMode: 'custom', customEndDate: '', shippingOptions: ship('DHL') }).customEndDate).toBe('end_date_required');
    expect(price({ startingBid: '10', durationMode: 'custom', customEndDate: 'nope', shippingOptions: ship('DHL') }).customEndDate).toBe('end_date_invalid');
    expect(price({ startingBid: '10', durationMode: 'custom', customEndDate: '2000-01-01T00:00', shippingOptions: ship('DHL') }).customEndDate).toBe('end_date_past');
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
    expect(price({ startingBid: '10', durationMode: 'custom', customEndDate: future, shippingOptions: ship('DHL') })).toEqual({});
  });

  test('package dimensions and text limits behave exactly like a listing', () => {
    const base = { startingBid: '10', shippingOptions: ship('DHL') };
    expect(validateStep('price', F({ ...base, weightKg: '0' }), {}, 'next').weightKg).toBe('dimension_invalid');
    expect(validateStep('price', F({ ...base, productType: 'tcg', weightKg: '0' }), {}, 'next')).toEqual({});
    expect(validateStep('price', F({ ...base, description: 'x'.repeat(10001) }), {}, 'next').description).toBe('description_long');
    expect(validateStep('price', F({ ...base, proNotes: 'x'.repeat(2001) }), { isPro: true }, 'next').proNotes).toBe('pro_notes_long');
  });

  test('bidLocked (editing an already-published auction): starting bid and duration are never required, shipping still is', () => {
    expect(price({}, 'publish')).not.toEqual({}); // sanity: unlocked, an empty form does fail
    expect(validateStep('price', F({}), { bidLocked: true }, 'publish').startingBid).toBeUndefined();
    expect(validateStep('price', F({ durationMode: 'custom', customEndDate: 'nope' }), { bidLocked: true }, 'publish').customEndDate).toBeUndefined();
    expect(validateStep('price', F({ startingBid: '10' }), { bidLocked: true }, 'publish').shipping).toBe('shipping_required');
    expect(validateStep('price', F({ shippingOptions: ship('DHL') }), { bidLocked: true }, 'publish')).toEqual({});
  });

  test("'what', 'photos' and 'condition' are the same checks a listing gets", () => {
    expect(validateStep('what', F(), {}, 'next').title).toBe('title_required');
    expect(validateStep('photos', F(), { photoCount: 0 }, 'publish')).toEqual({ photos: 'photo_required' });
    expect(validateStep('condition', F(), {}, 'next')).toEqual({ condition: 'condition_required' });
  });

  test('validateAll reports every error and the first step that has one', () => {
    const r = validateAll(F({ title: 'Falcon UCS', mainCategory: 'sets', condition: 'used' }), { photoCount: 0 }, 'publish');
    expect(r.errors).toEqual({ photos: 'photo_required', startingBid: 'starting_bid_required', shipping: 'shipping_required' });
    expect(r.firstStep).toBe('photos');
    const ok = validateAll(F({ title: 'Falcon UCS', mainCategory: 'sets', condition: 'used', startingBid: '1', shippingOptions: ship('BRT') }), { photoCount: 2 }, 'publish');
    expect(ok).toEqual({ errors: {}, firstStep: null });
  });

  test('every field is attached to a real step, and firstErrorField follows on-screen order', () => {
    for (const step of Object.values(FIELD_STEP)) expect(STEP_IDS).toContain(step);
    expect(firstErrorField('price', { shipping: 'shipping_required', startingBid: 'starting_bid_required' })).toBe('startingBid');
  });
});

describe('payload: auctionStart/auctionEnd instead of price', () => {
  function names(f, mode, opts) { return buildAuctionFields(f, mode, opts).map(([k]) => k); }
  function find(f, mode, key, opts) { return buildAuctionFields(f, mode, opts).find(([k]) => k === key); }

  const base = { title: 'Millennium Falcon', mainCategory: 'sets', condition: 'used', startingBid: '99,50', shippingOptions: ship('DHL') };

  test('publish sends type=auction, auctionStart and auctionEnd; a draft sends neither type nor the dates are rejected by the server', () => {
    expect(find(F(base), 'publish', 'type')).toEqual(['type', 'auction']);
    expect(find(F(base), 'draft', 'type')).toBeUndefined(); // the server draft schema does not accept type:'auction'
    expect(find(F(base), 'publish', 'auctionStart')).toEqual(['auctionStart', '99.5']);
    expect(find(F(base), 'publish', 'auctionEnd')[1]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('a zero, invalid or empty starting bid is simply not sent', () => {
    for (const v of ['0', '', 'abc']) expect(find(F({ ...base, startingBid: v }), 'draft', 'auctionStart')).toBeUndefined();
  });

  test('custom duration sends the chosen end date; standard sends 7 days from now', () => {
    const custom = find(F({ ...base, durationMode: 'custom', customEndDate: '2030-06-01T10:00' }), 'publish', 'auctionEnd');
    expect(custom[1]).toBe(new Date('2030-06-01T10:00').toISOString());
  });

  test('bidLocked (editing an already-published auction): neither auctionStart nor auctionEnd is sent', () => {
    expect(find(F(base), 'publish', 'auctionStart', { bidLocked: true })).toBeUndefined();
    expect(find(F(base), 'publish', 'auctionEnd', { bidLocked: true })).toBeUndefined();
    expect(find(F(base), 'publish', 'type', { bidLocked: true })).toEqual(['type', 'auction']); // the server drops this safely too
  });

  test('never sends a plain "price" field, and otherwise matches a listing payload shape (shipping, condition, category)', () => {
    for (const mode of ['publish', 'draft']) {
      const keys = names(F(base), mode, { isPro: false });
      expect(keys).not.toContain('price');
      expect(keys).toContain('shippingOptions');
      expect(keys).toContain('condition');
      expect(keys).toContain('category');
    }
  });

  test('professional notes only for professional sellers; dimensions never for cards', () => {
    const f = F({ productType: 'tcg', game: 'pokemon', title: 'Charizard', condition: 'near_mint', proNotes: 'nota', weightKg: '1', startingBid: '5' });
    expect(names(f, 'publish', { isPro: false })).not.toContain('proNotes');
    expect(names(f, 'publish', { isPro: true })).toContain('proNotes');
    expect(names(f, 'publish', { isPro: true })).not.toContain('weightKg');
  });
});

describe('completeness meter (starting bid stands in for price)', () => {
  const full = F({ title: 'Millennium Falcon', mainCategory: 'sets', condition: 'new', startingBid: '99', shippingOptions: ship('DHL'), description: 'Set completo, scatola perfetta, mai aperto.' });

  test('weights add up to 100; an empty form is 0%, a complete one 100%', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(completeness(F(), { photoCount: 0 })).toMatchObject({ percent: 0, hint: 'title' });
    expect(completeness(full, { photoCount: 3 })).toMatchObject({ percent: 100, hint: null, missing: [] });
  });

  test('an unset starting bid is the only thing missing from an otherwise-full auction', () => {
    expect(completeness({ ...full, startingBid: '' }, { photoCount: 3 }).hint).toBe('price');
  });
});

describe('automatic draft (localStorage), its own key so it never collides with /sell', () => {
  const NOW = 1_800_000_000_000;
  const filled = F({ productType: 'tcg', game: 'pokemon', title: 'Charizard 4/102', category: 'Pokémon', condition: 'near_mint', startingBid: '45', durationMode: 'custom', customEndDate: '2030-01-01T10:00', shippingOptions: ship('DHL', 'UPS') });

  test('keys are per user, versioned, and distinct from the /sell draft key', () => {
    expect(draft.draftKey('u-1')).toBe('cardbrix_auction_draft_v1:u-1');
    expect(draft.draftKey('u-1')).not.toBe(require('../client/src/lib/sell/draft.js').draftKey('u-1'));
  });

  test('a form survives a round trip, including the duration choice', () => {
    const back = draft.parseDraft(draft.serializeDraft(filled, 3, NOW), NOW + 1000);
    expect(back.step).toBe(3);
    expect(back.form).toMatchObject({ productType: 'tcg', game: 'pokemon', title: 'Charizard 4/102', startingBid: '45', durationMode: 'custom', customEndDate: '2030-01-01T10:00' });
  });

  test('only text is stored: never photos or files', () => {
    const raw = draft.serializeDraft({ ...filled, files: [{ name: 'a.jpg' }], token: 'secret' }, 1, NOW);
    expect(raw).not.toMatch(/a\.jpg|secret|files|token/);
  });

  test('an untouched form, or one with only a starting bid of zero, is not worth saving', () => {
    expect(draft.isDraftWorthSaving(F())).toBe(false);
    expect(draft.isDraftWorthSaving(F({ title: 'x' }))).toBe(true);
  });

  test('a bogus durationMode recovered from storage falls back to standard', () => {
    const raw = draft.serializeDraft({ ...filled, durationMode: 'whenever' }, 1, NOW);
    expect(draft.parseDraft(raw, NOW).form.durationMode).toBe('standard');
  });
});

describe('live preview listing: feeds ListingCard as a real auction', () => {
  test('type/is_auction are set, current_bid and auction_start mirror the starting bid, no bids yet', () => {
    const p = buildPreviewListing(F({ title: '  Falcon  ', startingBid: '149,9' }), { sellerName: 'luca' });
    expect(p).toMatchObject({ id: 'preview', title: 'Falcon', type: 'auction', is_auction: true, current_bid: 149.9, auction_start: 149.9, bids_count: 0, status: 'active' });
    expect(p.auction_end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('no starting bid (or an invalid one) shows no bid at all', () => {
    for (const v of ['', '0', 'abc']) expect([v, buildPreviewListing(F({ startingBid: v })).current_bid]).toEqual([v, null]);
  });

  test('without a photo the branded placeholder is used, same one Sell uses', () => {
    expect(buildPreviewListing(F()).images).toEqual([PREVIEW_PLACEHOLDER]);
  });
});
