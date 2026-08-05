/**
 * Seed script: bulk-imports the open-source Funko Pop! dataset
 * (kennymkchan/funko-pop-data on GitHub) into master_cards under game='funko'.
 *
 * Unlike the other TCG adapters, Funko has no live name-search API, so this
 * script is the *only* way funko cards end up in the catalog — run it once
 * (and re-run occasionally to pick up upstream updates).
 *
 * Run with: node src/db/seed_funko_pop.js
 */
require('dotenv').config();
const cardCatalog = require('../services/cardCatalog');

const DATASET_URL = 'https://raw.githubusercontent.com/kennymkchan/funko-pop-data/master/funko_pop.json';

function mapFunkoEntry(entry) {
  return {
    external_id: entry.handle,
    name: entry.title,
    set_code: null,
    set_name: Array.isArray(entry.series) ? entry.series[0] || null : null,
    rarity: null,
    img_url: entry.imageName || null,
    details: {
      series: Array.isArray(entry.series) ? entry.series : [],
    },
  };
}

async function seed() {
  console.log(`Fetching Funko Pop dataset from ${DATASET_URL}...`);
  const res = await fetch(DATASET_URL, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) {
    throw new Error(`Failed to download dataset: HTTP ${res.status}`);
  }
  const entries = await res.json();
  console.log(`Downloaded ${entries.length} entries. Upserting into master_cards...`);

  let done = 0;
  const BATCH_SIZE = 100;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE).map(mapFunkoEntry);
    await cardCatalog.bulkUpsertCards('funko', batch);
    done += batch.length;
    console.log(`  ...${done}/${entries.length}`);
  }

  console.log(`✅  Seeded ${done} Funko Pop entries into master_cards.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Funko seed failed:', err);
  process.exit(1);
});
