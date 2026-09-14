/**
 * Migration: persisted, expiring shipping-rate quotes + Sendcloud
 * correlation fields on shipments.
 *
 * Why a table instead of trusting a client-supplied price: the checkout
 * amount now depends on a live aggregator quote instead of the static
 * internal rate table, so it can't be silently recalculated server-side
 * the way the static table was (a recalculation could legitimately return a
 * different price a few minutes later). Each quote option the buyer is
 * shown gets its own row: an opaque token, the exact price/carrier it was
 * quoted, an explicit expiry, and a fingerprint of what was quoted (which
 * listings, total weight, country pair) so a token can't be replayed
 * against a cart that changed after the quote was issued. See
 * src/services/shippingQuote.js for the request/resolve logic.
 *
 * sendcloud_parcel_id / sendcloud_shipment_ref on shipments let the
 * parcel_status_changed webhook (Sendcloud's tracking updates) find the
 * right row reliably, rather than matching on tracking_number text.
 *
 * Idempotent: safe to run more than once.
 * Run with: node src/db/migrate_shipping_quotes.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running shipping quotes migration...');

  await query(`
    CREATE TABLE IF NOT EXISTS shipping_quotes (
      id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      token             VARCHAR(64) UNIQUE NOT NULL,
      buyer_id          UUID NOT NULL REFERENCES users(id),
      seller_id         UUID NOT NULL REFERENCES users(id),
      group_fingerprint VARCHAR(128) NOT NULL,

      shipping_option_code VARCHAR(100),
      carrier_code      VARCHAR(50),
      carrier_name      VARCHAR(100),
      price             NUMERIC(10,2) NOT NULL,
      currency          VARCHAR(3) NOT NULL DEFAULT 'EUR',
      rate_source       VARCHAR(20) NOT NULL DEFAULT 'aggregator'
                         CHECK (rate_source IN ('aggregator', 'fallback_static')),

      status            VARCHAR(20) NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'consumed', 'expired')),
      expires_at        TIMESTAMP NOT NULL,
      created_at        TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_shipping_quotes_token ON shipping_quotes(token)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_shipping_quotes_buyer ON shipping_quotes(buyer_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_shipping_quotes_expires ON shipping_quotes(expires_at)`);

  await query(`
    ALTER TABLE shipments
      ADD COLUMN IF NOT EXISTS sendcloud_parcel_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS sendcloud_shipping_option_code VARCHAR(100)
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_shipments_sendcloud_parcel ON shipments(sendcloud_parcel_id)`);

  console.log('Done.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
