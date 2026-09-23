const { query } = require('../db');
const pricing = require('./featuredPricing');

// Paid-promotion tariffs: card-only, priced in euro cents, admin-configurable
// (featured_tariffs table). Falls back to the in-code defaults in featuredPricing.js
// if the table isn't reachable (migration not yet run in this environment).
// `days` is what actually gets added to featured_until.
async function getTariffs() {
  let rows = [];
  try {
    const r = await query('SELECT id, price_cents, updated_at FROM featured_tariffs');
    rows = r.rows || [];
  } catch (err) {
    console.error('featured.getTariffs: falling back to in-code defaults —', err.message);
  }
  return pricing.mergeTariffs(rows);
}

async function getTariff(id) {
  if (!pricing.isKnownTariff(id)) return null;
  const tariffs = await getTariffs();
  return tariffs.find((t) => t.id === String(id)) || null;
}

async function setTariffPrice(id, priceCents, updatedBy) {
  const def = pricing.DEFAULT_TARIFFS[String(id)];
  await query(
    `INSERT INTO featured_tariffs (id, days, price_cents, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET price_cents = $3, updated_by = $4, updated_at = now()`,
    [String(id), def.days, priceCents, updatedBy]
  );
}

// Sets/extends a listing's featured window. Extends from the later of now and
// the current featured_until, so buying a second tariff stacks instead of
// overwriting. `days` null + source 'admin' with no expiry pins it indefinitely.
async function applyFeature(listingId, { days, source }) {
  if (days == null) {
    const r = await query(
      `UPDATE listings
         SET is_featured = true, featured_until = NULL, featured_source = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [listingId, source]
    );
    return r.rows[0] || null;
  }
  const r = await query(
    `UPDATE listings
       SET is_featured = true,
           featured_until = GREATEST(NOW(), COALESCE(featured_until, NOW())) + ($2 || ' days')::interval,
           featured_source = $3,
           updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [listingId, days, source]
  );
  return r.rows[0] || null;
}

async function unfeature(listingId) {
  const r = await query(
    `UPDATE listings
       SET is_featured = false, featured_until = NULL, featured_source = NULL, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [listingId]
  );
  return r.rows[0] || null;
}

// Lazy expiry — mirrors expireEndedAuctionsAndPromoteWinners(): called at the
// top of GET /api/listings so the public feed self-heals without a scheduler.
// NULL featured_until = never expires.
async function expireFeaturedListings() {
  try {
    await query(
      `UPDATE listings
         SET is_featured = false, updated_at = NOW()
       WHERE is_featured = true
         AND featured_until IS NOT NULL
         AND featured_until < NOW()`
    );
  } catch (err) {
    console.error('expireFeaturedListings error:', err.message);
  }
}

async function recordPurchase({ listingId, userId, tariff, days, method, amountCents = null, paymentRef = null }) {
  // ON CONFLICT targets the partial unique index (payment_ref WHERE NOT NULL);
  // admin grants pass paymentRef null and simply always insert.
  // amount_cents = what the card was actually charged (NULL for admin grants);
  // amount_credits is legacy, only set on rows from before promotions went card-only.
  await query(
    `INSERT INTO featured_purchases (listing_id, user_id, tariff, days, method, amount_cents, payment_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (payment_ref) WHERE payment_ref IS NOT NULL DO NOTHING`,
    [listingId, userId, tariff, days, method, amountCents, paymentRef]
  );
}

function purchaseExists(paymentRef) {
  if (!paymentRef) return Promise.resolve(false);
  return query('SELECT 1 FROM featured_purchases WHERE payment_ref = $1', [paymentRef])
    .then((r) => r.rows.length > 0);
}

module.exports = {
  getTariffs,
  getTariff,
  setTariffPrice,
  applyFeature,
  unfeature,
  expireFeaturedListings,
  recordPurchase,
  purchaseExists,
};
