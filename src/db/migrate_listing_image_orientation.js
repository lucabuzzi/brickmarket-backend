/**
 * Migration: listings.image_orientation ('portrait' | 'landscape').
 *
 * How the seller wants the photos framed (card/gallery aspect ratio). Existing rows
 * get 'landscape', i.e. the framing they always had.
 *
 * Reversible (always through the wrapper — src/db/index.js refuses direct runs):
 *   node scripts/run-db-script.js src/db/migrate_listing_image_orientation.js --target=production          (up)
 *   node scripts/run-db-script.js src/db/migrate_listing_image_orientation.js --target=production --down   (down)
 * Idempotent: safe to run "up" more than once.
 */
require('dotenv').config();
const { query } = require('./index');

async function up() {
  await query(`
    ALTER TABLE public.listings
      ADD COLUMN IF NOT EXISTS image_orientation TEXT NOT NULL DEFAULT 'landscape'
  `);
  await query(`ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_image_orientation_check`);
  await query(`
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_image_orientation_check
      CHECK (image_orientation IN ('portrait', 'landscape'))
  `);
  console.log('✅  listings.image_orientation added.');
}

async function down() {
  await query(`ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_image_orientation_check`);
  await query(`ALTER TABLE public.listings DROP COLUMN IF EXISTS image_orientation`);
  console.log('✅  listings.image_orientation dropped.');
}

const direction = process.argv.includes('--down') ? down : up;

direction()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌  Migration failed:', err);
    process.exit(1);
  });

module.exports = { up, down };
