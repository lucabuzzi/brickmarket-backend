/**
 * Migration: seller payout tracking on orders.
 *
 * The marketplace now collects buyer payment straight into the platform's
 * own Stripe balance (no Stripe Connect / seller onboarding required) —
 * paying the seller is a separate, manual step CardBrix performs off-Stripe
 * (bank transfer, PayPal, etc.) and records here. These columns let the
 * admin panel track which paid orders still owe the seller a payout, mark
 * one as paid, and archive it afterwards.
 *
 * Idempotent: safe to run more than once.
 * Run with: node src/db/migrate_order_payout_tracking.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running order payout tracking migration...');

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (payout_status IN ('pending', 'paid', 'archived')),
      ADD COLUMN IF NOT EXISTS payout_paid_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS payout_notes TEXT
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_orders_payout_status ON orders(payout_status)`);

  console.log('Done.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
