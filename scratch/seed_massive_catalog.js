require('dotenv').config();
const { searchSetsExternal, bulkUpsertSets } = require('./src/services/rebrickable');

const THEMES = [
  'Technic', 'Star Wars', 'Icons', 'Creator Expert', 'Ideas', 'Harry Potter', 'Marvel Super Heroes', 'Architecture'
];

async function seedMassive() {
  console.log('--- STARTING MASSIVE CATALOG SEEDING ---');
  console.log('Target: Top sets from the last 10 years for core themes.');

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 10;

  for (const theme of THEMES) {
    console.log(`\nScanning theme: ${theme}...`);
    try {
      // Rebrickable search for the theme
      // We'll simulate a search for the theme name to get results
      // This is a simplified way to populate the DB with popular sets
      const results = await searchSetsExternal(theme, 100); 
      console.log(`  > Ingested ${results.length} assets for "${theme}".`);
      
      // Delay to avoid hitting rate limits too hard
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`  ! Error seeding theme "${theme}":`, err.message);
    }
  }

  console.log('\n--- SEEDING COMPLETED ---');
  process.exit();
}

seedMassive();
