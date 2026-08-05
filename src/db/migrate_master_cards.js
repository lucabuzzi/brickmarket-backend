/**
 * Migration: Creates the master_cards cache table shared by every trading-card
 * catalog (Magic, Yu-Gi-Oh!, and future additions). Mirrors the master_sets
 * cache/upsert pattern used for LEGO, but generic across games via the `game`
 * column and a `details` JSONB column for game-specific fields.
 *
 * Run with: node src/db/migrate_master_cards.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running master_cards migration...');

  await query(`
    CREATE TABLE IF NOT EXISTS master_cards (
      id          SERIAL        PRIMARY KEY,

      -- Which catalog this card belongs to, e.g. "magic", "yugioh"
      game        VARCHAR(30)   NOT NULL,

      -- Canonical ID from the source API (Scryfall UUID, YGOPRODeck numeric ID, ...)
      external_id VARCHAR(255)  NOT NULL,

      name        VARCHAR(500)  NOT NULL,
      set_code    VARCHAR(50),
      set_name    VARCHAR(255),
      rarity      VARCHAR(100),
      img_url     TEXT,

      -- Game-specific extra fields (mana cost/oracle text for Magic, atk/def for Yu-Gi-Oh, ...)
      details     JSONB         NOT NULL DEFAULT '{}'::jsonb,

      -- When this row was last fetched from the API (used for cache TTL checks)
      fetched_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

      UNIQUE (game, external_id)
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_master_cards_game ON master_cards (game);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_master_cards_fetched_at ON master_cards (fetched_at);`);

  // Best-effort: enable trigram fuzzy search, same as master_sets. Falls back to
  // plain ILIKE in the service layer if the extension can't be created here.
  try {
    await query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await query(`CREATE INDEX IF NOT EXISTS idx_master_cards_name_trgm ON master_cards USING GIN (name gin_trgm_ops);`);
    console.log('✅  pg_trgm trigram index ready.');
  } catch (err) {
    console.warn('⚠️  Could not enable pg_trgm/trigram index (fuzzy search will fall back to ILIKE):', err.message);
  }

  console.log('✅  master_cards table ready.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
