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
    console.log('Connected to database. Running analytics_clicks migration...');

    const sql = `
      CREATE TABLE IF NOT EXISTS analytics_clicks (
        id           BIGSERIAL PRIMARY KEY,
        session_id   UUID REFERENCES analytics_sessions(id) ON DELETE SET NULL,
        visitor_id   UUID NOT NULL,
        user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
        path         TEXT NOT NULL,
        target_label TEXT,
        target_type  TEXT NOT NULL CHECK (target_type IN ('link','button')),
        target_href  TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_clicks_label ON analytics_clicks (target_label, created_at);
      CREATE INDEX IF NOT EXISTS idx_analytics_clicks_path ON analytics_clicks (path, created_at);
    `;

    await client.query(sql);
    console.log('analytics_clicks migration completed successfully.');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

run();
