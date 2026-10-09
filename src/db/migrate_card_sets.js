/**
 * Migration: card expansions ("sets") for the trading-card catalogs, and the link from listings to them.
 *
 *   card_sets   one row per expansion, filled and refreshed automatically from TCGdex (services/tcgdex.js).
 *               PK (game, id): the id is the source's own (e.g. "30th", "me05"); sort_order follows the
 *               source's chronology (series order, then set order inside the series) so "newest first" works.
 *   listings    card_set_id / card_number / card_external_id, all optional: a seller who cannot find the card
 *               in the catalog just leaves them empty.
 *
 * Reversible (always through the wrapper — src/db/index.js refuses direct runs):
 *   node scripts/run-db-script.js src/db/migrate_card_sets.js --target=production          (up)
 *   node scripts/run-db-script.js src/db/migrate_card_sets.js --target=production --down   (down)
 * Idempotent: safe to run "up" more than once. "down" drops card_sets and the three listing columns.
 */
require('dotenv').config();
const { query } = require('./index');

async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.card_sets (
      game                  VARCHAR(30)  NOT NULL,
      id                    VARCHAR(60)  NOT NULL,
      series_id             VARCHAR(60),
      series_name           VARCHAR(200),
      series_name_en        VARCHAR(200),
      name                  VARCHAR(300) NOT NULL,
      name_en               VARCHAR(300),
      logo                  TEXT,
      card_count_total      INTEGER,
      card_count_official   INTEGER,
      release_date          DATE,
      sort_order            INTEGER      NOT NULL DEFAULT 0,
      cards_fetched_at      TIMESTAMPTZ,
      fetched_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      PRIMARY KEY (game, id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_card_sets_game_order ON public.card_sets (game, sort_order)`);
  // RLS on, like the other tables (see migrate_enable_rls.sql): the backend connects with a privileged role,
  // anon/authenticated clients get nothing.
  await query(`ALTER TABLE public.card_sets ENABLE ROW LEVEL SECURITY`);

  await query(`
    ALTER TABLE public.listings
      ADD COLUMN IF NOT EXISTS card_set_id TEXT,
      ADD COLUMN IF NOT EXISTS card_number TEXT,
      ADD COLUMN IF NOT EXISTS card_external_id TEXT
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_listings_card_set
      ON public.listings (card_set_id) WHERE card_set_id IS NOT NULL
  `);
  console.log('✅  card_sets created; listings.card_set_id / card_number / card_external_id added.');
}

async function down() {
  await query(`DROP INDEX IF EXISTS public.idx_listings_card_set`);
  await query(`
    ALTER TABLE public.listings
      DROP COLUMN IF EXISTS card_external_id,
      DROP COLUMN IF EXISTS card_number,
      DROP COLUMN IF EXISTS card_set_id
  `);
  await query(`DROP TABLE IF EXISTS public.card_sets`);
  console.log('✅  card_sets and the listing card-set columns dropped.');
}

const direction = process.argv.includes('--down') ? down : up;

direction()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌  Migration failed:', err);
    process.exit(1);
  });

module.exports = { up, down };
