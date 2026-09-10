const { query } = require('../db');

// Paid-promotion tariffs. PLACEHOLDER PRICES — adjust `credits` freely
// (1 CR = 1 EUR, same rate as the wallet). `days` is what actually gets added
// to featured_until. Keys are the tariff ids sent by the client.
const FEATURED_TARIFFS = {
  '7':  { days: 7,  credits: 5 },
  '14': { days: 14, credits: 9 },
  '30': { days: 30, credits: 18 },
};

function getTariff(id) {
  return FEATURED_TARIFFS[String(id)] || null;
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

async function recordPurchase({ listingId, userId, tariff, days, method, amountCredits = null, paymentRef = null }) {
  // ON CONFLICT targets the partial unique index (payment_ref WHERE NOT NULL);
  // admin grants pass paymentRef null and simply always insert.
  await query(
    `INSERT INTO featured_purchases (listing_id, user_id, tariff, days, method, amount_credits, payment_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (payment_ref) WHERE payment_ref IS NOT NULL DO NOTHING`,
    [listingId, userId, tariff, days, method, amountCredits, paymentRef]
  );
}

function purchaseExists(paymentRef) {
  if (!paymentRef) return Promise.resolve(false);
  return query('SELECT 1 FROM featured_purchases WHERE payment_ref = $1', [paymentRef])
    .then((r) => r.rows.length > 0);
}

module.exports = {
  FEATURED_TARIFFS,
  getTariff,
  applyFeature,
  unfeature,
  expireFeaturedListings,
  recordPurchase,
  purchaseExists,
};
