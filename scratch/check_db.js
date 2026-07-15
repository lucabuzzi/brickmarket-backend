const db = require('../src/db');

async function run() {
  try {
    const resListings = await db.query('SELECT count(*) FROM listings');
    console.log('Total listings in DB:', resListings.rows[0].count);

    const resFixed = await db.query('SELECT count(*) FROM listings WHERE is_auction = false');
    console.log('Total fixed price listings:', resFixed.rows[0].count);

    const resAuctions = await db.query('SELECT count(*) FROM listings WHERE is_auction = true');
    console.log('Total auctions:', resAuctions.rows[0].count);

    const activeAuctions = await db.query("SELECT id, title, auction_end, status FROM listings WHERE is_auction = true AND status = 'active' ORDER BY auction_end ASC");
    console.log('Active auctions count:', activeAuctions.rows.length);
    console.log('Active auctions detail:', activeAuctions.rows);
  } catch (err) {
    console.error('Error running check_db script:', err);
  } finally {
    process.exit();
  }
}

run();
