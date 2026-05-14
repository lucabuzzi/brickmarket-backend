/**
 * Migration: Creates the master_sets cache table for Rebrickable lookups.
 *
 * Run with: node src/db/migrate_master_sets.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running master_sets migration...');

  await query(`
    CREATE TABLE IF NOT EXISTS master_sets (
      -- Primary key: Rebrickable canonical set number (e.g. "10281-1")
      set_num         VARCHAR(20)   PRIMARY KEY,

      -- Official set name from Rebrickable
      name            VARCHAR(500)  NOT NULL,

      -- Release year
      year            SMALLINT,

      -- Rebrickable theme ID (integer, maps to a theme like "Icons", "Star Wars", etc.)
      theme_id        INTEGER,

      -- Total piece count (num_parts from API)
      num_parts       INTEGER,

      -- Official set image URL (CDN link from Rebrickable)
      img_url         TEXT,

      -- Full URL to the set's page on Rebrickable (optional, for attribution)
      rebrickable_url TEXT,

      -- When this row was last fetched from the API (used for cache TTL checks)
      fetched_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

      -- Housekeeping
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    );
  `);

  // Index for fast TTL-based cache invalidation queries
  await query(`
    CREATE INDEX IF NOT EXISTS idx_master_sets_fetched_at
    ON master_sets (fetched_at);
  `);

  console.log('✅  master_sets table ready.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
