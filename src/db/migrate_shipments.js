/**
 * Migration: a `shipments` table, separate from `orders`, one-to-many
 * (one shipment groups every order row from the same seller × macro-category
 * within a single checkout — the same grouping already used for shipping
 * cost in src/controllers/paymentsController.js#shippingGroupKey).
 *
 * Why: a carrier label corresponds to a shipment, not to an order row. Today
 * the group's shipping cost is charged on whichever order row happens to be
 * first in the group (see paymentsController.js) — that stays as-is (it's
 * how the Stripe charge amount is built, order-row by order-row), but it's
 * no longer the only record of "what did this group cost / what's its
 * tracking": shipments.shipping_cost is the authoritative figure regardless
 * of row order, and tracking/label/status live here instead of being
 * duplicated across every row of the group.
 *
 * Status lifecycle is intentionally wider than what Step 2 wires up (only
 * pending_payment -> awaiting_preparation -> cancelled happen so far, from
 * the payment webhook) — label_pending/label_created/label_failed/shipped/
 * in_transit/delivered are Step 3/4's job, added now so that work doesn't
 * need another migration. delivered_at in particular is there because it's
 * the natural future trigger for an automated Stripe Connect payout release
 * (out of scope here, but Connect is on the roadmap — see prior discussion).
 *
 * orders.shipment_id links back; existing order columns (tracking_number,
 * carrier, shipped_at, selected_carrier) are untouched for backward
 * compatibility — nothing reading them today breaks.
 *
 * Idempotent: safe to run more than once.
 * Run with: node src/db/migrate_shipments.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running shipments migration...');

  await query(`
    CREATE TABLE IF NOT EXISTS shipments (
      id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      seller_id         UUID NOT NULL REFERENCES users(id),
      buyer_id          UUID NOT NULL REFERENCES users(id),
      macro_category    VARCHAR(20) NOT NULL CHECK (macro_category IN ('physical', 'tcg')),
      stripe_payment_intent_id VARCHAR(100),

      status            VARCHAR(20) NOT NULL DEFAULT 'pending_payment'
                         CHECK (status IN (
                           'pending_payment',
                           'awaiting_preparation',
                           'label_pending',
                           'label_created',
                           'label_failed',
                           'shipped',
                           'in_transit',
                           'delivered',
                           'exception',
                           'cancelled'
                         )),

      shipping_method   VARCHAR(50),  -- carrier code (physical) or TCG tier id
      shipping_cost     NUMERIC(10,2) NOT NULL DEFAULT 0,
      rate_source       VARCHAR(20) NOT NULL DEFAULT 'static'
                         CHECK (rate_source IN ('static', 'tcg_tier', 'aggregator', 'fallback_static')),

      total_weight_kg   NUMERIC(6,3),

      ship_from_address JSONB,
      ship_to_address   JSONB,

      tracking_number   VARCHAR(100),
      tracking_url      TEXT,
      carrier           VARCHAR(50),
      label_url         TEXT,

      shipped_at        TIMESTAMP,
      delivered_at      TIMESTAMP,

      created_at        TIMESTAMP DEFAULT NOW(),
      updated_at        TIMESTAMP DEFAULT NOW()
    )
  `);

  await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES shipments(id)`);

  await query(`CREATE INDEX IF NOT EXISTS idx_shipments_seller ON shipments(seller_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_shipments_intent ON shipments(stripe_payment_intent_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_orders_shipment ON orders(shipment_id)`);

  console.log('Done.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
