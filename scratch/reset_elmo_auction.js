const { query } = require('../src/db');

async function resetAuction() {
  const listingId = '49e08c15-cb43-4f56-8d38-a625e59270a3';
  const testuserId = 'fdce3b5f-4d0a-48fb-807c-c8986338d77f';
  
  console.log('Resetting auction for "Elmo di Sauron"...');
  
  try {
    // 1. Delete previous bids for this listing
    await query('DELETE FROM bids WHERE listing_id = $1', [listingId]);
    console.log('Deleted old bids.');

    // 2. Reset listing to active auction
    // auction_end = now + 10 minutes
    const auctionEnd = new Date(Date.now() + 10 * 60 * 1000);
    
    const result = await query(
      `UPDATE listings 
       SET is_auction = true, 
           type = 'auction', 
           status = 'active', 
           seller_id = $2,
           auction_start = 50.00,
           current_bid = 50.00,
           bids_count = 0,
           auction_end = $3,
           updated_at = NOW()
       WHERE id = $1 
       RETURNING *`,
      [listingId, testuserId, auctionEnd]
    );

    if (result.rows.length === 0) {
      console.error('Listing not found!');
    } else {
      console.log('Auction reset successfully!');
      console.log('Title:', result.rows[0].title);
      console.log('End Time:', result.rows[0].auction_end);
      console.log('Owner:', result.rows[0].seller_id);
    }
  } catch (err) {
    console.error('Error resetting auction:', err);
  } finally {
    process.exit();
  }
}

resetAuction();
