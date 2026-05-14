require('dotenv').config();
const { query } = require('../src/db');

async function main() {
  // Test the updated query used by GET /:id route (no u.country)
  const id = '49e08c15-cb43-4f56-8d38-a625e59270a3'; // Elmo di Sauron
  const result = await query(
    `SELECT l.*, 
            u.username as seller_username, 
            u.avatar_url as seller_avatar,
            u.rating_avg as seller_rating,
            u.is_verified as seller_verified
     FROM listings l
     JOIN users u ON l.seller_id = u.id
     WHERE l.id = $1`,
    [id]
  );
  console.log('Rows found:', result.rows.length);
  if (result.rows.length > 0) {
    const r = result.rows[0];
    console.log('Title:', r.title);
    console.log('Condition:', r.condition);
    console.log('Status:', r.status);
    console.log('seller_username:', r.seller_username);
    console.log('seller_verified:', r.seller_verified);
  }
  process.exit(0);
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
