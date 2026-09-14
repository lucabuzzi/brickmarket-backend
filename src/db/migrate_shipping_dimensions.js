/**
 * Migration: replace the small/medium/large package_size enum with real
 * weight_kg/length_cm/width_cm/height_cm on listings.
 *
 * package_size itself is NOT dropped — src/services/shipping.js's static
 * rate table still keys off it, and it stays useful as a quick bucket.
 * Going forward it's derived from weight_kg (see
 * src/services/productDimensions.js#packageSizeFromWeight) rather than
 * seller-picked, so the column and the new fields never disagree.
 *
 * Backfill: existing rows (all lego/tcg as of this writing, 30 total — no
 * funko listings yet) get weight/dimensions derived from their current
 * package_size bucket. TCG rows are explicitly left NULL: the tier-based
 * shipping model doesn't use these at all.
 *
 * Idempotent: safe to run more than once (backfill only touches rows where
 * weight_kg IS NULL).
 * Run with: node src/db/migrate_shipping_dimensions.js
 */
require('dotenv').config();
const { query } = require('./index');
const { LEGACY_PACKAGE_SIZE_DIMENSIONS } = require('../services/productDimensions');

async function migrate() {
  console.log('Running shipping dimensions migration...');

  await query(`
    ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(6,3),
      ADD COLUMN IF NOT EXISTS length_cm NUMERIC(6,1),
      ADD COLUMN IF NOT EXISTS width_cm NUMERIC(6,1),
      ADD COLUMN IF NOT EXISTS height_cm NUMERIC(6,1)
  `);

  for (const [bucket, dims] of Object.entries(LEGACY_PACKAGE_SIZE_DIMENSIONS)) {
    const result = await query(
      `UPDATE listings
         SET weight_kg = $1, length_cm = $2, width_cm = $3, height_cm = $4
       WHERE product_type IN ('lego', 'funko')
         AND package_size = $5
         AND weight_kg IS NULL`,
      [dims.weightKg, dims.lengthCm, dims.widthCm, dims.heightCm, bucket]
    );
    console.log(`  backfilled ${result.rowCount} '${bucket}' listing(s)`);
  }

  console.log('Done.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
