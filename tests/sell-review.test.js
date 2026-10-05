// Phase C of the /sell redesign: the review step (what blocks publishing, how the summary is written) and the
// "published!" screen (where its buttons go, the confetti). Pure logic only (client/src/lib/sell/*).
const { INITIAL_FORM, MAX_PHOTOS } = require('../client/src/lib/sell/form.js');
const { STEP_IDS, FIELD_STEP, validateStep, validateAll } = require('../client/src/lib/sell/validate.js');
const { publishBlockers, formatPrice, snippet, chosenCarrierIds, publishedPath } = require('../client/src/lib/sell/review.js');
const { confettiPieces, CONFETTI_COLORS } = require('../client/src/lib/sell/confetti.js');

const F = (over = {}) => ({ ...INITIAL_FORM, shippingOptions: {}, ...over });
const READY = F({ title: 'Millennium Falcon', mainCategory: 'sets', condition: 'new', price: '99,90', shippingOptions: { DHL: { selected: true } } });

describe('the review step', () => {
  test('it is the last step, has no fields of its own and never produces errors', () => {
    expect(STEP_IDS).toEqual(['what', 'photos', 'condition', 'price', 'review']);
    expect(Object.values(FIELD_STEP)).not.toContain('review');
    expect(validateStep('review', F(), { photoCount: 0 }, 'publish')).toEqual({});
  });

  test('validation of the other steps is untouched by the new step', () => {
    expect(validateAll(READY, { photoCount: 1 }, 'publish')).toEqual({ errors: {}, firstStep: null });
    expect(validateAll(F(), { photoCount: 0 }, 'publish').firstStep).toBe('what');
  });
});

describe('publishBlockers', () => {
  test('a complete listing with a photo has no blockers', () => {
    expect(publishBlockers(READY, { photoCount: 1 })).toEqual([]);
  });

  test('every missing thing is listed once, with the step to fix it on, in wizard order', () => {
    const list = publishBlockers(F({ title: 'ab' }), { photoCount: 0 });
    expect(list.map((b) => [b.field, b.step, b.code])).toEqual([
      ['title', 'what', 'title_short'],
      ['mainCategory', 'what', 'main_category_required'],
      ['photos', 'photos', 'photo_required'],
      ['condition', 'condition', 'condition_required'],
      ['price', 'price', 'price_required'],
      ['shipping', 'price', 'shipping_required'],
    ]);
  });

  test('editing an existing listing never asks for a new photo', () => {
    expect(publishBlockers(READY, { photoCount: 0, editing: true })).toEqual([]);
    expect(publishBlockers(READY, { photoCount: 0 }).map((b) => b.field)).toEqual(['photos']);
  });

  test('cards need a game instead of a LEGO category', () => {
    const tcg = F({ productType: 'tcg', title: 'Charizard', condition: 'near_mint', price: '10', shippingOptions: { BRT: { selected: true } } });
    expect(publishBlockers(tcg, { photoCount: 2 }).map((b) => b.field)).toEqual(['game']);
  });
});

describe('summary helpers', () => {
  test('formatPrice always shows two decimals with a comma, and nothing for an invalid price', () => {
    expect(formatPrice('99,9')).toBe('99,90');
    expect(formatPrice('5')).toBe('5,00');
    expect(formatPrice('1200.5')).toBe('1200,50');
    for (const bad of ['', '0', '-3', 'abc', null, undefined]) expect([bad, formatPrice(bad)]).toEqual([bad, '']);
  });

  test('snippet collapses whitespace and cuts long texts at a word with an ellipsis', () => {
    expect(snippet('  a   b\n\nc ')).toBe('a b c');
    expect(snippet('')).toBe('');
    const long = `${'parola '.repeat(40)}fine`;
    const s = snippet(long, 50);
    expect(s.endsWith('…')).toBe(true);
    expect(s.length).toBeLessThanOrEqual(51);
    expect(s.slice(0, -1).endsWith('parola')).toBe(true); // not cut in the middle of a word
    expect(snippet('x'.repeat(200), 20)).toBe(`${'x'.repeat(20)}…`); // no spaces: hard cut
  });

  test('chosenCarrierIds follows the catalogue order, not the click order, and ignores unknown or unticked ones', () => {
    const opts = { UPS: { selected: true }, DHL: { selected: true }, BRT: { selected: false }, ZZZ: { selected: true } };
    expect(chosenCarrierIds(opts, ['DHL', 'BRT', 'UPS', 'SDA'])).toEqual(['DHL', 'UPS']);
    expect(chosenCarrierIds({}, ['DHL'])).toEqual([]);
    expect(chosenCarrierIds(undefined, ['DHL'])).toEqual([]);
  });
});

describe('publishedPath', () => {
  test('the page of the listing the server just created', () => {
    expect(publishedPath({ id: 42 })).toBe('/product/42');
    expect(publishedPath({ id: 'a1b2-c3' })).toBe('/product/a1b2-c3');
  });

  test('no usable id means no link (the page then offers "my listings" only)', () => {
    for (const bad of [null, undefined, 'x', {}, { id: null }, { id: 0 }, { id: -1 }, { id: 1.5 }, { id: '' }, { id: '../admin' }, { id: 'a/b' }, { id: 'a?b=1' }, { id: {} }]) {
      expect([bad, publishedPath(bad)]).toEqual([bad, null]);
    }
  });
});

describe('confetti', () => {
  test('the same seed always gives the same pieces, a different seed a different burst', () => {
    expect(confettiPieces(20, 3)).toEqual(confettiPieces(20, 3));
    expect(confettiPieces(20, 3)).not.toEqual(confettiPieces(20, 4));
  });

  test('every piece stays inside sensible bounds and uses the pillar palette (never gold)', () => {
    const pieces = confettiPieces(60, 99);
    expect(pieces).toHaveLength(60);
    expect(new Set(pieces.map((p) => p.id)).size).toBe(60);
    for (const p of pieces) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(Math.abs(p.drift)).toBeLessThanOrEqual(80);
      expect(p.delay).toBeGreaterThanOrEqual(0);
      expect(p.delay).toBeLessThanOrEqual(0.6);
      expect(p.duration).toBeGreaterThanOrEqual(1.6);
      expect(p.size).toBeGreaterThanOrEqual(6);
      expect(p.size).toBeLessThanOrEqual(12);
      expect(CONFETTI_COLORS).toContain(p.color);
    }
    expect(CONFETTI_COLORS.join(' ')).not.toMatch(/d4af37/i);
  });

  test('a zero or negative count gives no pieces', () => {
    expect(confettiPieces(0)).toEqual([]);
    expect(confettiPieces(-5)).toEqual([]);
  });
});

describe('texts of the review step and the celebration, in all five languages', () => {
  const langs = Object.fromEntries(['it', 'en', 'es', 'fr', 'de'].map((l) => [l, require(`../client/src/locales/${l}.json`).sell.ui]));
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const pick = (ui) => ({ review: ui.review, celebrate: ui.celebrate, review_btn: ui.review_btn, step: ui.step.review, title: ui.step_title.review, sub: ui.step_sub.review });
  const placeholders = (s) => (s.match(/\{\{\s*\w+\s*\}\}/g) || []).map((p) => p.replace(/\s/g, '')).sort().join(',');

  test('same keys everywhere, none empty, same placeholders', () => {
    const base = Object.fromEntries(flat(pick(langs.it)));
    expect(Object.keys(base).length).toBeGreaterThan(25);
    for (const [lang, ui] of Object.entries(langs)) {
      const f = Object.fromEntries(flat(pick(ui)));
      expect([lang, Object.keys(f).sort()]).toEqual([lang, Object.keys(base).sort()]);
      for (const [k, v] of Object.entries(f)) {
        expect([lang, k, typeof v === 'string' && v.trim().length > 0]).toEqual([lang, k, true]);
        expect([lang, k, placeholders(v)]).toEqual([lang, k, placeholders(base[k])]);
      }
    }
  });

  test('the photos row interpolates the count and the maximum', () => {
    for (const ui of Object.values(langs)) expect(placeholders(ui.review.photos_value)).toBe('{{max}},{{n}}');
    expect(MAX_PHOTOS).toBe(5);
  });

  test('nothing promises credits, sales or a percentage (credits are never earned by publishing)', () => {
    const banned = /credit|crediti|crédit|créditos|punti|%|vendi\w* (?:di )?più|sell faster|more sales|vendent plus|garant/i;
    for (const [lang, ui] of Object.entries(langs)) {
      for (const [k, v] of flat({ review: ui.review, celebrate: ui.celebrate })) expect([lang, k, banned.test(v)]).toEqual([lang, k, false]);
    }
  });
});
