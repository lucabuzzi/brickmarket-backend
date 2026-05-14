const { getClient } = require('../src/db');
(async () => {
  const client = await getClient();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        message_key VARCHAR(100) NOT NULL,
        listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Notifications table created successfully.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    process.exit(0);
  }
})();
