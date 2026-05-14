const { query } = require('../src/db');

async function migrate() {
  try {
    console.log('Adding is_featured column...');
    await query(`ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false`);
    
    console.log('Setting random active listings to featured...');
    // Set 4 active fixed-price listings to featured
    await query(`
      UPDATE listings 
      SET is_featured = true 
      WHERE id IN (
        SELECT id FROM listings 
        WHERE status = 'active' AND (type <> 'auction' AND is_auction = false)
        LIMIT 4
      )
    `);

    // Set 4 active auctions to featured
    await query(`
      UPDATE listings 
      SET is_featured = true 
      WHERE id IN (
        SELECT id FROM listings 
        WHERE status = 'active' AND (type = 'auction' OR is_auction = true)
        LIMIT 4
      )
    `);

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit();
  }
}

migrate();
