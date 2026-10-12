// The /create-auction review step and "published!" screen: what blocks publishing, and (in all five
// languages) that the new create_auction.ui.* copy mirrors sell.ui.* and never promises credits or sales.
const { INITIAL_FORM } = require('../client/src/lib/auction/form.js');
const { STEP_IDS, FIELD_STEP, validateStep, validateAll } = require('../client/src/lib/auction/validate.js');
const { publishBlockers, formatPrice, snippet, chosenCarrierIds, publishedPath } = require('../client/src/lib/auction/review.js');

const F = (over = {}) => ({ ...INITIAL_FORM, shippingOptions: {}, ...over });
const READY = F({ title: 'Millennium Falcon', mainCategory: 'sets', condition: 'new', startingBid: '99,90', shippingOptions: { DHL: { selected: true } } });

describe('the review step', () => {
  test('it is the last step, has no fields of its own and never produces errors', () => {
    expect(STEP_IDS).toEqual(['what', 'photos', 'condition', 'price', 'review']);
    expect(Object.values(FIELD_STEP)).not.toContain('review');
    expect(validateStep('review', F(), { photoCount: 0 }, 'publish')).toEqual({});
  });

  test('validation of the other steps is untouched by the review step', () => {
    expect(validateAll(READY, { photoCount: 1 }, 'publish')).toEqual({ errors: {}, firstStep: null });
    expect(validateAll(F(), { photoCount: 0 }, 'publish').firstStep).toBe('what');
  });
});

describe('publishBlockers', () => {
  test('a complete auction with a photo has no blockers', () => {
    expect(publishBlockers(READY, { photoCount: 1 })).toEqual([]);
  });

  test('every missing thing is listed once, with the step to fix it on, in wizard order', () => {
    const list = publishBlockers(F({ title: 'ab' }), { photoCount: 0 });
    expect(list.map((b) => [b.field, b.step, b.code])).toEqual([
      ['title', 'what', 'title_short'],
      ['mainCategory', 'what', 'main_category_required'],
      ['photos', 'photos', 'photo_required'],
      ['condition', 'condition', 'condition_required'],
      ['startingBid', 'price', 'starting_bid_required'],
      ['shipping', 'price', 'shipping_required'],
    ]);
  });

  test('a custom duration without an end date blocks publishing on the same step as the bid', () => {
    const f = F({ title: 'Millennium Falcon', mainCategory: 'sets', condition: 'new', startingBid: '10', durationMode: 'custom', customEndDate: '', shippingOptions: { DHL: { selected: true } } });
    expect(publishBlockers(f, { photoCount: 1 }).map((b) => [b.field, b.step])).toEqual([['customEndDate', 'price']]);
  });

  test('cards need a game instead of a LEGO category', () => {
    const tcg = F({ productType: 'tcg', title: 'Charizard', condition: 'near_mint', startingBid: '10', shippingOptions: { BRT: { selected: true } } });
    expect(publishBlockers(tcg, { photoCount: 2 }).map((b) => b.field)).toEqual(['game']);
  });
});

describe('summary helpers are the generic ones shared with /sell', () => {
  test('formatPrice/snippet/chosenCarrierIds/publishedPath are re-exported unchanged', () => {
    expect(formatPrice('99,9')).toBe('99,90');
    expect(snippet('  a   b\n\nc ')).toBe('a b c');
    expect(chosenCarrierIds({ UPS: { selected: true }, DHL: { selected: true } }, ['DHL', 'BRT', 'UPS'])).toEqual(['DHL', 'UPS']);
    expect(publishedPath({ id: 42 })).toBe('/product/42');
    expect(publishedPath({ id: -1 })).toBeNull();
  });
});

describe('texts of the auction wizard, in all five languages', () => {
  const langs = Object.fromEntries(['it', 'en', 'es', 'fr', 'de'].map((l) => [l, require(`../client/src/locales/${l}.json`)]));
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const placeholders = (s) => (s.match(/\{\{\s*\w+\s*\}\}/g) || []).map((p) => p.replace(/\s/g, '')).sort().join(',');

  // create_auction.ui.err has 5 extra codes sell.ui.err has no use for (starting bid + custom end date).
  const EXTRA_ERR_KEYS = ['err.starting_bid_required', 'err.starting_bid_invalid', 'err.end_date_required', 'err.end_date_invalid', 'err.end_date_past'];

  test('create_auction.ui has the same keys as sell.ui (plus the auction-only error codes) in every language, none empty, same placeholders', () => {
    for (const [lang, data] of Object.entries(langs)) {
      const sellKeys = Object.fromEntries(flat(data.sell.ui));
      const auctionKeys = Object.fromEntries(flat(data.create_auction.ui));
      expect([lang, Object.keys(auctionKeys).sort()]).toEqual([lang, [...Object.keys(sellKeys), ...EXTRA_ERR_KEYS].sort()]);
      for (const [k, v] of Object.entries(auctionKeys)) {
        expect([lang, k, typeof v === 'string' && v.trim().length > 0]).toEqual([lang, k, true]);
        if (!EXTRA_ERR_KEYS.includes(k)) expect([lang, k, placeholders(v)]).toEqual([lang, k, placeholders(sellKeys[k])]);
      }
    }
  });

  test('the 5 auction-only error codes carry no placeholders in any language', () => {
    for (const [lang, data] of Object.entries(langs)) {
      const auctionKeys = Object.fromEntries(flat(data.create_auction.ui));
      for (const k of EXTRA_ERR_KEYS) expect([lang, k, placeholders(auctionKeys[k])]).toEqual([lang, k, '']);
    }
  });

  test('every language has the same auction-only flat keys, none empty', () => {
    const EXTRA = ['pricing_cond_new', 'pricing_cond_used', 'pricing_cond_complete', 'pricing_cond_parts', 'market_value_estimated', 'set_fallback', 'auction_note_standard', 'auction_note_custom', 'shipping_cost_note', 'weight_kg_label', 'weight_kg_placeholder', 'dimensions_cm_label', 'length_placeholder', 'width_placeholder', 'height_placeholder', 'dimensions_note', 'box_condition_label', 'box_condition_mint', 'box_condition_damaged', 'box_condition_none', 'instructions_label', 'instructions_present', 'instructions_absent', 'instructions_pdf_only', 'complete_set_label', 'complete_set_desc', 'pro_notes_label', 'pro_notes_placeholder', 'year_label', 'year_placeholder'];
    for (const [lang, data] of Object.entries(langs)) {
      for (const k of EXTRA) expect([lang, k, typeof data.create_auction[k] === 'string' && data.create_auction[k].trim().length > 0]).toEqual([lang, k, true]);
    }
  });

  test('the "costs a token" framing is gone (credits/tokens are never spent on publishing or auction duration)', () => {
    for (const [lang, data] of Object.entries(langs)) {
      expect([lang, 'cost_token_badge' in data.create_auction]).toEqual([lang, false]);
    }
  });

  test('nothing promises credits, sales or a guaranteed percentage', () => {
    const banned = /credit|crediti|crédit|créditos|token|punti|garant/i;
    for (const [lang, data] of Object.entries(langs)) {
      for (const [k, v] of flat({ review: data.create_auction.ui.review, celebrate: data.create_auction.ui.celebrate })) {
        expect([lang, k, banned.test(v)]).toEqual([lang, k, false]);
      }
    }
  });
});
