/**
 * Migration: trading-card details on listings — language, rarity, professional grading.
 *
 *   card_language         text, one of the codes in services/cardDetails.js (NULL = not specified)
 *   card_rarity           free text (rarities differ too much between games for a CHECK)
 *   card_grading_company  psa | cgc | bgs | sgc | other (NULL = raw / ungraded card)
 *   card_grade            text because of grades like 9.5 (NULL when not graded)
 *
 * Grading company and grade go together: the CHECK allows both NULL or both set.
 *
 * Reversible (always through the wrapper — src/db/index.js refuses direct runs):
 *   node scripts/run-db-script.js src/db/migrate_listing_card_details.js --target=production          (up)
 *   node scripts/run-db-script.js src/db/migrate_listing_card_details.js --target=production --down   (down)
 * Idempotent: safe to run "up" more than once.
 */
require('dotenv').config();
const { query } = require('./index');

async function up() {
  await query(`
    ALTER TABLE public.listings
      ADD COLUMN IF NOT EXISTS card_language TEXT,
      ADD COLUMN IF NOT EXISTS card_rarity TEXT,
      ADD COLUMN IF NOT EXISTS card_grading_company TEXT,
      ADD COLUMN IF NOT EXISTS card_grade TEXT
  `);
  await query(`ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_card_language_check`);
  await query(`
    ALTER TABLE public.listings ADD CONSTRAINT listings_card_language_check
      CHECK (card_language IS NULL OR card_language IN ('it','en','ja','de','fr','es','pt','ko','zh'))
  `);
  await query(`ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_card_grading_company_check`);
  await query(`
    ALTER TABLE public.listings ADD CONSTRAINT listings_card_grading_company_check
      CHECK (card_grading_company IS NULL OR card_grading_company IN ('psa','cgc','bgs','sgc','other'))
  `);
  await query(`ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_card_grading_pair_check`);
  await query(`
    ALTER TABLE public.listings ADD CONSTRAINT listings_card_grading_pair_check
      CHECK ((card_grading_company IS NULL) = (card_grade IS NULL))
  `);
  console.log('✅  listings.card_language / card_rarity / card_grading_company / card_grade added.');
}

async function down() {
  await query(`ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_card_grading_pair_check`);
  await query(`ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_card_grading_company_check`);
  await query(`ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_card_language_check`);
  await query(`
    ALTER TABLE public.listings
      DROP COLUMN IF EXISTS card_grade,
      DROP COLUMN IF EXISTS card_grading_company,
      DROP COLUMN IF EXISTS card_rarity,
      DROP COLUMN IF EXISTS card_language
  `);
  console.log('✅  card detail columns dropped.');
}

const direction = process.argv.includes('--down') ? down : up;

direction()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌  Migration failed:', err);
    process.exit(1);
  });

module.exports = { up, down };
