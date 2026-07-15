require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. Active auctions (type = 'auction', auction_end > NOW)
    const activeAuctions = await client.query(
      "SELECT id, title, auction_end, status FROM listings WHERE type = 'auction' AND auction_end > NOW()"
    );
    console.log(`Active auctions (future expiration): ${activeAuctions.rows.length}`);
    activeAuctions.rows.forEach(r => {
      console.log(` - [${r.status}] ${r.title} (ends: ${r.auction_end})`);
    });

    // 2. Expired auctions (type = 'auction', auction_end <= NOW)
    const expiredAuctions = await client.query(
      "SELECT id, title, auction_end, status FROM listings WHERE type = 'auction' AND auction_end <= NOW()"
    );
    console.log(`Expired auctions (past expiration): ${expiredAuctions.rows.length}`);
    expiredAuctions.rows.forEach(r => {
      console.log(` - [${r.status}] ${r.title} (ended: ${r.auction_end})`);
    });

    // 3. Sold listings (status = 'sold')
    const soldListings = await client.query(
      "SELECT id, title, type, status FROM listings WHERE status = 'sold'"
    );
    console.log(`Sold listings: ${soldListings.rows.length}`);
    soldListings.rows.forEach(r => {
      console.log(` - [${r.status}] ${r.title} (${r.type})`);
    });

  } catch (e) {
    console.error('Error running check:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
