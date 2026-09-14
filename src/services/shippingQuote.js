// Orchestrates a checkout-time shipping quote: asks the aggregator (or its
// mock — see sendcloud.js) for rates, persists each option as a short-lived,
// single-use, fingerprinted row, and resolves a token back at checkout time
// — never trusting a client-supplied price. Physical (LEGO/Funko) groups
// only; TCG keeps the card-tier system in shipping.js entirely separately.
const crypto = require('crypto');
const { query } = require('../db');
const sendcloud = require('./sendcloud');
const { physicalGroupCarriers } = require('./shipping');

const QUOTE_TTL_MINUTES = Number(process.env.SHIPPING_QUOTE_TTL_MINUTES) || 10;

// Plain snapshot of a seller's profile address, in the same shape as a
// buyer's checkout address (see addressValidators.checkoutAddressSchema) —
// used both as a quote's from-address and as a shipment's
// ship_from_address. Null fields (seller never completed their profile
// address) pass through as-is: label generation is what enforces this is
// complete, not quoting or shipment creation.
function sellerAddressSnapshot(seller) {
  return {
    fullName: seller?.company_name || seller?.full_name || seller?.username || null,
    addressStreet: seller?.address_street || null,
    addressHouseNumber: seller?.address_house_number || null,
    city: seller?.city || null,
    zip: seller?.address_zip_code || null,
    province: null,
    country: seller?.address_country || null,
    phone: seller?.phone || null,
  };
}

/** Identifies exactly what was quoted, so a token can't be reused against a
 *  cart that changed (items added/removed, weight changed) after the quote
 *  was issued. */
function fingerprint({ listingIds, weightKg, sellerCountry, buyerCountry }) {
  const sorted = [...listingIds].sort();
  const payload = JSON.stringify({ sorted, weightKg: Math.round((weightKg || 0) * 1000), sellerCountry, buyerCountry });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/** Requests fresh quotes for one physical shipping group and persists each
 *  option. Returns { options: [{ token, carrierCode, carrierName, price,
 *  currency }], expiresAt }. Falls back to the static rate table (flagged
 *  rate_source='fallback_static') if the aggregator can't be reached —
 *  checkout keeps working, but see paymentsController.js: a fallback quote
 *  can't get an automatic label later (no real carrier booking behind it).
 */
async function requestQuote({ buyerId, sellerId, items, sellerAddress, buyerAddress }) {
  const listingIds = items.map((it) => it.id);
  const weightKg = items.reduce((s, it) => s + (parseFloat(it.weight_kg) || 0), 0);
  const dims = items.reduce(
    (m, it) => ({
      lengthCm: Math.max(m.lengthCm, parseFloat(it.length_cm) || 0),
      widthCm: Math.max(m.widthCm, parseFloat(it.width_cm) || 0),
      heightCm: Math.max(m.heightCm, parseFloat(it.height_cm) || 0),
    }),
    { lengthCm: 0, widthCm: 0, heightCm: 0 }
  );
  const sellerCountry = sellerAddress?.country || 'IT';
  const buyerCountry = buyerAddress?.country || 'IT';

  let rateOptions;
  let rateSource = 'aggregator';
  try {
    rateOptions = await sendcloud.fetchRates({
      fromAddress: sellerAddress,
      toAddress: buyerAddress,
      weightKg,
      lengthCm: dims.lengthCm || null,
      widthCm: dims.widthCm || null,
      heightCm: dims.heightCm || null,
    });
    if (!rateOptions || rateOptions.length === 0) throw new Error('No rate options returned');
  } catch (err) {
    console.warn('Sendcloud rate request failed, falling back to static table:', err.message);
    rateSource = 'fallback_static';
    rateOptions = physicalGroupCarriers(items, sellerCountry, buyerCountry).map((o) => ({
      shippingOptionCode: o.carrier,
      carrierCode: o.carrier,
      carrierName: o.carrier || 'Standard',
      price: o.cost,
      currency: 'EUR',
    }));
  }

  const fp = fingerprint({ listingIds, weightKg, sellerCountry, buyerCountry });
  const expiresAt = new Date(Date.now() + QUOTE_TTL_MINUTES * 60 * 1000);

  const options = [];
  for (const opt of rateOptions) {
    const token = crypto.randomBytes(24).toString('hex');
    await query(
      `INSERT INTO shipping_quotes
         (token, buyer_id, seller_id, group_fingerprint,
          shipping_option_code, carrier_code, carrier_name, price, currency,
          rate_source, status, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11)`,
      [
        token, buyerId, sellerId, fp,
        opt.shippingOptionCode, opt.carrierCode, opt.carrierName, opt.price, opt.currency,
        rateSource, expiresAt,
      ]
    );
    options.push({
      token, carrierCode: opt.carrierCode, carrierName: opt.carrierName,
      price: opt.price, currency: opt.currency,
    });
  }

  return { options, expiresAt, rateSource };
}

/** Resolves a quote token at checkout time. Marks it consumed (single-use)
 *  on success. currentFingerprint must match what requestQuote computed, or
 *  the token is treated as stale exactly like an expired one — same error
 *  code either way, so the client's retry logic doesn't need to distinguish. */
async function resolveQuote({ token, buyerId, currentFingerprint }) {
  const result = await query(
    `SELECT * FROM shipping_quotes WHERE token = $1 AND buyer_id = $2`,
    [token, buyerId]
  );
  const quote = result.rows[0];
  if (!quote) return { error: 'SHIPPING_QUOTE_EXPIRED' };
  if (quote.status !== 'active') return { error: 'SHIPPING_QUOTE_EXPIRED' };
  if (new Date(quote.expires_at).getTime() < Date.now()) return { error: 'SHIPPING_QUOTE_EXPIRED' };
  if (quote.group_fingerprint !== currentFingerprint) return { error: 'SHIPPING_QUOTE_EXPIRED' };

  await query(`UPDATE shipping_quotes SET status='consumed' WHERE id=$1`, [quote.id]);

  return {
    quote: {
      shippingOptionCode: quote.shipping_option_code,
      carrierCode: quote.carrier_code,
      carrierName: quote.carrier_name,
      price: parseFloat(quote.price),
      currency: quote.currency,
      rateSource: quote.rate_source,
    },
  };
}

module.exports = {
  QUOTE_TTL_MINUTES,
  fingerprint,
  requestQuote,
  resolveQuote,
  sellerAddressSnapshot,
};
