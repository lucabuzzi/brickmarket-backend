const { query } = require('../src/db');

async function testAuction() {
  const listingId = '49e08c15-cb43-4f56-8d38-a625e59270a3';
  try {
     await query(`
      UPDATE listings 
      SET is_auction = true, 
          type = 'auction', 
          starting_price = 50.00, 
          current_bid = 50.00, 
          auction_end = NOW() + INTERVAL '3 days',
          bids_count = 0 
      WHERE id = $1
    `, [listingId]);
    console.log('Listing updated to Auction');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testAuction();
