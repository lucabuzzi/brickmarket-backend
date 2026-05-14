/**
 * Migration: Add retail_price and market_value columns to master_sets.
 *
 * Run with: node src/db/migrate_master_sets_pricing.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running master_sets pricing migration...');

  // Add retail_price (the LEGO official RRP in EUR, stored if available)
  await query(`
    ALTER TABLE master_sets
    ADD COLUMN IF NOT EXISTS retail_price NUMERIC(10, 2);
  `);

  // Add market_value (our computed/estimated current market value in EUR)
  await query(`
    ALTER TABLE master_sets
    ADD COLUMN IF NOT EXISTS market_value NUMERIC(10, 2);
  `);

  // Add is_retired flag (true = no longer sold by LEGO officially)
  await query(`
    ALTER TABLE master_sets
    ADD COLUMN IF NOT EXISTS is_retired BOOLEAN DEFAULT FALSE;
  `);

  // Add market_value_computed_at so we can refresh the estimate periodically
  await query(`
    ALTER TABLE master_sets
    ADD COLUMN IF NOT EXISTS market_value_computed_at TIMESTAMPTZ;
  `);

  console.log('✅  master_sets pricing columns ready.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
