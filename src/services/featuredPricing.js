// Pure pricing logic for paid "in evidenza" promotions — no DB access, so it can
// be unit-tested without a database. Promotions are paid by card only, priced in
// euro cents: credits are never involved (CLAUDE.md, "REGOLE DI PRODOTTO
// DEFINITIVE SUI CREDITI" — credits are only for Skill Zone puzzles and carry no
// euro value).
//
// The live prices are admin-configurable (featured_tariffs table, see
// src/db/migrate_featured_card_only.js). These defaults are only the fallback
// when the table is unreachable or a row is missing. Tariff ids = number of days,
// and the set of tariffs is fixed: admins change prices, not durations.
const DEFAULT_TARIFFS = {
  '7':  { days: 7,  priceCents: 500 },
  '14': { days: 14, priceCents: 900 },
  '30': { days: 30, priceCents: 1800 },
};

// Stripe's minimum charge in EUR is €0.50; the ceiling just guards against typos.
const MIN_PRICE_CENTS = 50;
const MAX_PRICE_CENTS = 100000;

function isKnownTariff(id) {
  return Object.prototype.hasOwnProperty.call(DEFAULT_TARIFFS, String(id));
}

function validatePriceCents(value) {
  return Number.isInteger(value) && value >= MIN_PRICE_CENTS && value <= MAX_PRICE_CENTS;
}

// Merges DB rows ({ id, price_cents, updated_at }) over the defaults. Unknown ids
// in the DB are ignored; missing ids fall back to the default with isDefault:true.
// Returns an array sorted by duration.
function mergeTariffs(rows = []) {
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  return Object.entries(DEFAULT_TARIFFS)
    .map(([id, def]) => {
      const row = byId.get(id);
      return {
        id,
        days: def.days,
        priceCents: row ? parseInt(row.price_cents, 10) : def.priceCents,
        updatedAt: row?.updated_at || null,
        isDefault: !row,
      };
    })
    .sort((a, b) => a.days - b.days);
}

module.exports = {
  DEFAULT_TARIFFS,
  MIN_PRICE_CENTS,
  MAX_PRICE_CENTS,
  isKnownTariff,
  validatePriceCents,
  mergeTariffs,
};
