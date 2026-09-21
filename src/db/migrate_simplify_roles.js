/**
 * Migration: collapses the users.role model from
 * ('buyer','seller','both','shop','admin') down to just ('user','admin').
 *
 * The buyer/seller/both distinction never gated any actual functionality
 * (anyone could already sell regardless of role) and was only auto-computed
 * marketing/CRM labelling (see the removed src/services/userRoleAuto.js).
 * 'shop' was an admin-only label with no code depending on it either.
 * Collapsing removes an unprotected self-service field (authController's
 * updateMeHandler let a logged-in user set their own role, including to
 * 'admin') without losing any real capability.
 *
 * Idempotent: safe to run more than once.
 * Run with: node scripts/run-db-script.js src/db/migrate_simplify_roles.js --target=production
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  // The old constraint doesn't allow 'user' yet, so it has to come off
  // before the backfill can write that value — added back (narrowed) only
  // once every row already satisfies it.
  console.log('Dropping old role CHECK constraint...');
  await query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);

  console.log("Collapsing buyer/seller/both/shop -> 'user'...");
  await query(`UPDATE users SET role = 'user' WHERE role IN ('buyer','seller','both','shop')`);

  console.log("Setting default role to 'user'...");
  await query(`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'`);

  console.log('Adding narrowed role CHECK constraint (user/admin)...');
  await query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user','admin'))`);

  console.log('Done.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
