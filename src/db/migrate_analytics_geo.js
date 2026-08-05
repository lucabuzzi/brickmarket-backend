const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to database. Running analytics geo migration...');

    const sql = `
      ALTER TABLE analytics_sessions
        ADD COLUMN IF NOT EXISTS country VARCHAR(2);

      CREATE INDEX IF NOT EXISTS idx_analytics_sessions_country ON analytics_sessions(country);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_type ON analytics_events(visitor_id, event_type);
    `;

    await client.query(sql);
    console.log('analytics geo migration completed successfully.');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

run();
