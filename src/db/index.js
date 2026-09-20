const { Pool } = require('pg');
require('dotenv').config();

// Refuses to open a connection pool unless the caller is either:
//  - the application server itself (server.js sets APP_SERVER_BOOT=1 as its very
//    first statement, before requiring anything else — so this is true for the
//    real running app, on Render or locally, regardless of how it was launched), or
//  - a migration/seed script that went through scripts/run-db-script.js, which sets
//    DB_TARGET_CONFIRMED=1 only after an explicit --target=test|production choice
//    (and, for production, an interactive confirmation).
// A migration/seed script required directly (`node src/db/migrate_x.js`, skipping
// the wrapper) has neither flag set and is refused here, instead of silently
// connecting to whatever DATABASE_URL happens to be in .env — which is how an
// earlier test run ended up hitting production. See CLAUDE.md and
// scripts/run-db-script.js.
//
// Note: this only protects code that goes through this module. A handful of
// migrate_*.js files construct their own pg Client directly instead of using
// this file (grep for "new Client(" under src/db/) — those are still only
// protected when run through the wrapper, not by this check. See the
// conversation this guard came out of for the full list.
if (process.env.APP_SERVER_BOOT !== '1' && process.env.DB_TARGET_CONFIRMED !== '1') {
  console.error(
    '❌ Refusing to connect: this looks like a migration/seed script run directly ' +
    '(node src/db/some_script.js), not through scripts/run-db-script.js. Run it as:\n' +
    '   node scripts/run-db-script.js <path-to-script> --target=test|production\n' +
    'This check exists because a script run directly loads .env — the production ' +
    'connection string — with no target confirmation at all.'
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Obbligatorio per Supabase
});

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  withTransaction,
};