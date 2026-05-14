const { query } = require('../src/db');

async function createDummyAuctions() {
  console.log('--- CREATING DUMMY AUCTIONS FOR LAYOUT TEST ---');
  try {
    // 1. Find a test user
    const userRes = await query(`SELECT id FROM users LIMIT 1`);
    if (userRes.rows.length === 0) throw new Error('No users found');
    const userId = userRes.rows[0].id;

    const auctionEnd = new Date();
    auctionEnd.setDate(auctionEnd.getDate() + 3);

    const dummies = [
      { title: 'LEGO Technic Bugatti Chiron', set: '42083', price: 299 },
      { title: 'LEGO Icons Titanic', set: '10294', price: 599 },
      { title: 'LEGO Star Wars Millennium Falcon', set: '75192', price: 799 }
    ];

    for (const d of dummies) {
      await query(`
        INSERT INTO listings (
          seller_id, title, set_number, theme, year, type, condition, 
          auction_start, auction_end, status, is_featured, category
        ) VALUES (
          $1, $2, $3, 'Technic', 2022, 'auction', 'new', 
          $4, $5, 'active', true, 'sets'
        )
      `, [userId, d.title, d.set, d.price, auctionEnd]);
      console.log(`Created: ${d.title}`);
    }

    console.log('Dummy auctions CREATED successfully.');
  } catch (err) {
    console.error('Test FAILED:', err.message);
  } finally {
    process.exit();
  }
}

createDummyAuctions();
