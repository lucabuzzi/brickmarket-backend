const { query } = require('./index');

async function migrate() {
  console.log('--- STARTING AUCTION MIGRATION ---');
  try {
    // 1. Add is_auction to listings
    await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_auction BOOLEAN DEFAULT FALSE`);
    console.log('Added is_auction column');

    // 2. Add starting_price to listings
    await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS starting_price DECIMAL(10,2)`);
    console.log('Added starting_price column');

    // 3. Sync existing data if type is 'auction'
    await query(`UPDATE listings SET is_auction = TRUE WHERE type = 'auction'`);
    await query(`UPDATE listings SET starting_price = auction_start WHERE type = 'auction' AND starting_price IS NULL`);
    console.log('Synchronized existing auction data');

    console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
  } catch (err) {
    console.error('--- MIGRATION FAILED ---');
    console.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  migrate();
}
