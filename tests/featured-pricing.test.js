// Unit tests for src/services/featuredPricing.js — pure logic, no DB, no server.
// Covers: promotions are priced in euro cents only (no credit price anywhere),
// admin price validation, and merging admin-set DB rows over the in-code defaults.
const pricing = require('../src/services/featuredPricing');

describe('DEFAULT_TARIFFS', () => {
  test('ids 7/14/30, each with integer priceCents and matching days — no credits field', () => {
    expect(Object.keys(pricing.DEFAULT_TARIFFS).sort()).toEqual(['14', '30', '7']);
    for (const [id, tf] of Object.entries(pricing.DEFAULT_TARIFFS)) {
      expect(tf.days).toBe(Number(id));
      expect(Number.isInteger(tf.priceCents)).toBe(true);
      expect(pricing.validatePriceCents(tf.priceCents)).toBe(true);
      expect(tf).not.toHaveProperty('credits');
    }
  });

  test('defaults keep the euro amounts the card already charged (5 / 9 / 18 €)', () => {
    expect(pricing.DEFAULT_TARIFFS['7'].priceCents).toBe(500);
    expect(pricing.DEFAULT_TARIFFS['14'].priceCents).toBe(900);
    expect(pricing.DEFAULT_TARIFFS['30'].priceCents).toBe(1800);
  });
});

describe('isKnownTariff', () => {
  test('accepts only the fixed ids, as string or number', () => {
    expect(pricing.isKnownTariff('7')).toBe(true);
    expect(pricing.isKnownTariff(30)).toBe(true);
    expect(pricing.isKnownTariff('10')).toBe(false);
    expect(pricing.isKnownTariff('admin')).toBe(false);
    expect(pricing.isKnownTariff('__proto__')).toBe(false);
    expect(pricing.isKnownTariff(undefined)).toBe(false);
  });
});

describe('validatePriceCents', () => {
  test.each([50, 500, 1799, 100000])('%p is valid', (v) => {
    expect(pricing.validatePriceCents(v)).toBe(true);
  });

  test.each([
    ['below Stripe minimum', 49],
    ['zero', 0],
    ['negative', -500],
    ['above ceiling', 100001],
    ['fractional cents', 5.5],
    ['string', '500'],
    ['NaN', NaN],
    ['null', null],
  ])('%s is rejected', (_label, v) => {
    expect(pricing.validatePriceCents(v)).toBe(false);
  });
});

describe('mergeTariffs', () => {
  test('no DB rows -> all defaults, flagged isDefault, sorted by days', () => {
    const merged = pricing.mergeTariffs([]);
    expect(merged.map((t) => t.id)).toEqual(['7', '14', '30']);
    expect(merged.every((t) => t.isDefault)).toBe(true);
    expect(merged.map((t) => t.priceCents)).toEqual([500, 900, 1800]);
  });

  test('DB row overrides the price (pg returns integers as numbers or strings)', () => {
    const merged = pricing.mergeTariffs([
      { id: '14', price_cents: '1250', updated_at: '2026-09-23T10:00:00Z' },
      { id: '30', price_cents: 2000, updated_at: null },
    ]);
    const byId = Object.fromEntries(merged.map((t) => [t.id, t]));
    expect(byId['7']).toMatchObject({ priceCents: 500, isDefault: true });
    expect(byId['14']).toMatchObject({ priceCents: 1250, days: 14, isDefault: false, updatedAt: '2026-09-23T10:00:00Z' });
    expect(byId['30']).toMatchObject({ priceCents: 2000, isDefault: false });
  });

  test('days always come from the code, and unknown DB ids are ignored', () => {
    const merged = pricing.mergeTariffs([
      { id: '7', price_cents: 600, days: 99 },
      { id: '60', price_cents: 3000 },
    ]);
    expect(merged.map((t) => t.id)).toEqual(['7', '14', '30']);
    expect(merged[0]).toMatchObject({ id: '7', days: 7, priceCents: 600 });
  });

  test('output never exposes a credits price', () => {
    for (const t of pricing.mergeTariffs([{ id: '7', price_cents: 700 }])) {
      expect(t).not.toHaveProperty('credits');
    }
  });
});
