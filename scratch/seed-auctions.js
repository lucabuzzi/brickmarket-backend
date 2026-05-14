require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT id FROM users LIMIT 1');
    const sellerId = r.rows[0].id;

    // Active Auction 1
    await client.query(`
      INSERT INTO listings (
        seller_id, title, description, category, type, condition,
        auction_start, auction_end, current_bid, status, images, price
      ) VALUES (
        $1, 'Asta - Super Star Destroyer', 'Asta di prova', 'sets', 'auction', 'used',
        200, NOW() + INTERVAL '2 days', 250, 'active', ARRAY['https://picsum.photos/seed/bm20/800/600'], null
      )
    `, [sellerId]);

    // Active Auction 2
    await client.query(`
      INSERT INTO listings (
        seller_id, title, description, category, type, condition,
        auction_start, auction_end, current_bid, status, images, price
      ) VALUES (
        $1, 'Asta - Diagon Alley', 'Asta di prova 2', 'sets', 'auction', 'new',
        100, NOW() + INTERVAL '5 days', 100, 'active', ARRAY['https://picsum.photos/seed/bm21/800/600'], null
      )
    `, [sellerId]);

    // Expired Auction
    await client.query(`
      INSERT INTO listings (
        seller_id, title, description, category, type, condition,
        auction_start, auction_end, current_bid, status, images, price, bids_count
      ) VALUES (
        $1, 'Asta - Torre Eiffel (Scaduta)', 'Asta vecchia', 'sets', 'auction', 'used',
        500, NOW() - INTERVAL '3 days', 550, 'active', ARRAY['https://picsum.photos/seed/bm22/800/600'], null, 2
      )
    `, [sellerId]);

    // Sold Item
    await client.query(`
      INSERT INTO listings (
        seller_id, title, description, category, type, condition,
        price, status, images
      ) VALUES (
        $1, 'Modulare Venduto', 'Gia venduto', 'sets', 'sealed', 'new',
        150, 'sold', ARRAY['https://picsum.photos/seed/bm23/800/600']
      )
    `, [sellerId]);

    console.log("Seeding completion for modern auctions successful.");
  } catch (err) {
    console.error("Seeding failed", err);
  } finally {
    client.release();
    pool.end();
  }
}
run();
