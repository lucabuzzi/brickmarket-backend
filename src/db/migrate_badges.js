const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Introduces an extensible badge system: a `badges` catalog (what badge types exist, and
 * whether staff can assign them manually vs. them being computed) plus a `user_badges` join
 * table (who has what, awarded by whom, when, with an optional note) — replacing the previous
 * approach of adding a new `users.is_x` boolean per badge with no assignment history.
 *
 * `users.is_pro` / `users.is_verified` are kept as-is (many existing read paths depend on them)
 * and are now kept in sync by the admin badge-assignment endpoint instead of being edited
 * directly in the DB. Existing users who already have either flag set get backfilled into
 * user_badges so the new admin UI reflects reality immediately instead of appearing empty.
 */
async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Connected to database. Running badges migration...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS badges (
        key         VARCHAR(50) PRIMARY KEY,
        label       VARCHAR(100) NOT NULL,
        description TEXT,
        color       VARCHAR(20) NOT NULL DEFAULT '#d4af37',
        is_manual   BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_key  VARCHAR(50) NOT NULL REFERENCES badges(key) ON DELETE CASCADE,
        awarded_by UUID REFERENCES users(id) ON DELETE SET NULL,
        awarded_at TIMESTAMP NOT NULL DEFAULT NOW(),
        note       TEXT,
        UNIQUE (user_id, badge_key)
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);`);

    await client.query(`
      INSERT INTO badges (key, label, description, color, is_manual, sort_order) VALUES
        ('pro', 'PRO', 'Venditore professionale riconosciuto dalla piattaforma.', '#eab308', TRUE, 10),
        ('verified', 'Verificato', 'Identita verificata manualmente dallo staff (documento controllato).', '#bf9a2e', TRUE, 20),
        ('legendary', 'Legendary', 'Automatico: rating medio >= 4.8 e almeno 10 vendite completate. Non assegnabile manualmente.', '#10b981', FALSE, 0)
      ON CONFLICT (key) DO NOTHING;
    `);

    const backfillPro = await client.query(`
      INSERT INTO user_badges (user_id, badge_key, note, awarded_at)
      SELECT id, 'pro', 'Migrato automaticamente dal campo legacy users.is_pro', COALESCE(updated_at, NOW())
      FROM users WHERE is_pro = true
      ON CONFLICT (user_id, badge_key) DO NOTHING
      RETURNING id;
    `);

    const backfillVerified = await client.query(`
      INSERT INTO user_badges (user_id, badge_key, note, awarded_at)
      SELECT id, 'verified', 'Migrato automaticamente dal campo legacy users.is_verified', COALESCE(updated_at, NOW())
      FROM users WHERE is_verified = true
      ON CONFLICT (user_id, badge_key) DO NOTHING
      RETURNING id;
    `);

    console.log(`Migration completed. Backfilled ${backfillPro.rowCount} 'pro' and ${backfillVerified.rowCount} 'verified' badge rows.`);
  } catch (err) {
    console.error('Error executing migration:', err);
  } finally {
    await client.end();
  }
}

run();
