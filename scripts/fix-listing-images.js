/**
 * One-off maintenance script: replaces placeholder (picsum.photos / unsplash)
 * images on listings/auctions that have a known LEGO set_number with the real
 * set image fetched via the Rebrickable lookup service (src/services/rebrickable.js).
 *
 * Usage: node scripts/fix-listing-images.js [--dry-run]
 */
const { query } = require('../src/db');
const { lookupSet } = require('../src/services/rebrickable');

const PLACEHOLDER_PATTERNS = ['picsum.photos', 'images.unsplash.com'];

function isPlaceholder(url) {
  return typeof url === 'string' && PLACEHOLDER_PATTERNS.some((p) => url.includes(p));
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const { rows } = await query(
    `SELECT id, title, set_number, images
     FROM listings
     WHERE set_number IS NOT NULL AND set_number <> ''`
  );

  const targets = rows.filter((r) => Array.isArray(r.images) && r.images.some(isPlaceholder));

  console.log(`Found ${targets.length} listing(s) with placeholder images and a set_number.\n`);

  const setCache = new Map();
  let updated = 0;
  let notFound = 0;

  for (const row of targets) {
    let setData = setCache.get(row.set_number);
    if (setData === undefined) {
      setData = await lookupSet(row.set_number);
      setCache.set(row.set_number, setData);
    }

    if (!setData || !setData.img_url) {
      console.log(`  [SKIP] "${row.title}" (set ${row.set_number}) — set not found on Rebrickable.`);
      notFound++;
      continue;
    }

    console.log(`  [FIX]  "${row.title}" (set ${row.set_number}) -> ${setData.img_url}`);
    if (!dryRun) {
      await query('UPDATE listings SET images = $1, updated_at = NOW() WHERE id = $2', [
        [setData.img_url],
        row.id,
      ]);
    }
    updated++;
  }

  console.log(`\nDone. ${updated} updated, ${notFound} skipped (not found)${dryRun ? ' [DRY RUN]' : ''}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
