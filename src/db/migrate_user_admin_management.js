/**
 * Migration: adds users.account_status ('active'/'banned'/'deleted') and widens
 * the role CHECK constraint to include 'shop', for the admin user-detail page
 * (role/status editing).
 *
 * account_status is a richer, admin-facing complement to the existing boolean
 * is_active (used everywhere else — auth middleware, login, stats) rather than
 * a replacement: is_active stays in sync (true only when account_status = 'active')
 * so every existing is_active check keeps working unchanged. Existing disabled
 * accounts (is_active = false) are backfilled to 'banned', the closest existing
 * meaning.
 *
 * Idempotent: safe to run more than once.
 * Run with: node src/db/migrate_user_admin_management.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Adding users.account_status...');
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active'`);

  console.log('Backfilling account_status from is_active...');
  await query(`UPDATE users SET account_status = 'banned' WHERE is_active = false AND account_status = 'active'`);

  console.log('(Re)adding account_status CHECK constraint...');
  await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check`);
  await query(`ALTER TABLE users ADD CONSTRAINT users_account_status_check CHECK (account_status IN ('active','banned','deleted'))`);

  console.log('Widening role CHECK constraint to include "shop"...');
  await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('buyer','seller','both','admin','shop'))`);

  console.log('Done.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
