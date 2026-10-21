// Mirror of src/utils/fees.js — display only; the server computes (and
// actually charges) the authoritative total at checkout. Keep BUYER_FEE_RATE
// in sync there (tests/fees.test.js fails if they drift).
export const BUYER_FEE_RATE = 0.05;

/** Commission label, e.g. "5%". */
export const BUYER_FEE_PERCENT = `${Math.round(BUYER_FEE_RATE * 1000) / 10}%`;

function toNumber(value) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return n == null || Number.isNaN(n) ? null : n;
}

/** CardBrix commission the buyer pays on top of a listing price (rounded to the cent). */
export function buyerFeeFor(price) {
  const n = toNumber(price);
  if (n == null) return 0;
  return Math.round(n * BUYER_FEE_RATE * 100) / 100;
}

/** Listing price as the buyer pays it, CardBrix commission included (shipping excluded). */
export function buyerPriceFor(price) {
  const n = toNumber(price);
  if (n == null) return null;
  return Math.round((n + buyerFeeFor(n)) * 100) / 100;
}
