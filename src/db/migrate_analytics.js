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
    console.log('Connected to database. Running analytics migration...');

    const sql = `
      CREATE TABLE IF NOT EXISTS analytics_sessions (
        id               UUID PRIMARY KEY,
        visitor_id       UUID NOT NULL,
        user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
        entry_path       TEXT,
        started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        duration_seconds INT NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor ON analytics_sessions (visitor_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user ON analytics_sessions (user_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started ON analytics_sessions (started_at);

      CREATE TABLE IF NOT EXISTS analytics_pageviews (
        id          BIGSERIAL PRIMARY KEY,
        session_id  UUID NOT NULL REFERENCES analytics_sessions(id) ON DELETE CASCADE,
        path        TEXT NOT NULL,
        viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_session ON analytics_pageviews (session_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_viewed ON analytics_pageviews (viewed_at);

      CREATE TABLE IF NOT EXISTS analytics_events (
        id          BIGSERIAL PRIMARY KEY,
        session_id  UUID REFERENCES analytics_sessions(id) ON DELETE SET NULL,
        visitor_id  UUID NOT NULL,
        user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
        event_type  TEXT NOT NULL CHECK (event_type IN ('registration_started','registration_completed','login')),
        path        TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_events_type_date ON analytics_events (event_type, created_at);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events (session_id);
    `;

    await client.query(sql);
    console.log('Analytics migration completed successfully.');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

run();
