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
    console.log('Connected to database. Running analytics_daily_snapshots migration...');

    const sql = `
      CREATE TABLE IF NOT EXISTS analytics_daily_snapshots (
        date                  DATE PRIMARY KEY,
        visitors              INT NOT NULL DEFAULT 0,
        sessions              INT NOT NULL DEFAULT 0,
        avg_duration_seconds  INT NOT NULL DEFAULT 0,
        pageviews             INT NOT NULL DEFAULT 0,
        new_registrations     INT NOT NULL DEFAULT 0,
        logins                INT NOT NULL DEFAULT 0,
        bounced_visitors      INT NOT NULL DEFAULT 0,
        countries             JSONB NOT NULL DEFAULT '[]',
        computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_analytics_daily_snapshots_date ON analytics_daily_snapshots(date);
    `;

    await client.query(sql);
    console.log('analytics_daily_snapshots migration completed successfully.');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

run();
