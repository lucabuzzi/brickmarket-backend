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
    console.log('Connected to database. Running OAuth prep migration...');

    const sql = `
      -- Local password becomes optional: OAuth-only accounts have no password_hash.
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

      -- One row per (provider, provider_user_id) linked to a user, supporting
      -- multiple providers per user (email + Google + Apple) for account linking.
      CREATE TABLE IF NOT EXISTS user_identities (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider          VARCHAR(20) NOT NULL CHECK (provider IN ('local', 'google', 'apple')),
        provider_user_id  VARCHAR(255) NOT NULL,
        email             VARCHAR(255),
        created_at        TIMESTAMP DEFAULT NOW(),
        UNIQUE (provider, provider_user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_identities_user_id ON user_identities(user_id);
    `;

    await client.query(sql);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

run();
