const { query, getClient } = require('../src/db');

async function simulateBid() {
  const listingId = '49e08c15-cb43-4f56-8d38-a625e59270a3';
  const bidderId = 'fdce3b5f-4d0a-48fb-807c-c8986338d77f'; // testbuyer or any other user
  const amount = 55.00;

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const listingRes = await client.query(`SELECT * FROM listings WHERE id = $1 FOR UPDATE`, [listingId]);
    const listing = listingRes.rows[0];
    
    console.log('Current Bid:', listing.current_bid);
    
    await client.query(
      `INSERT INTO bids (listing_id, bidder_id, amount, created_at) VALUES ($1, $2, $3, NOW())`,
      [listingId, bidderId, amount]
    );

    await client.query(
       `UPDATE listings SET current_bid = $1, bids_count = bids_count + 1, updated_at = NOW() WHERE id = $2`,
       [amount, listingId]
    );

    await client.query('COMMIT');
    console.log('Bid simulated successfully at 55.00€');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
  }
}

simulateBid();
