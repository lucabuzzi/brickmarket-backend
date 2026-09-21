/**
 * One-off fix: restores role='admin' for luka888@msn.com, whose role was
 * silently overwritten to 'both' via the self-service account-settings form
 * (client/src/pages/Account.jsx always sent whatever the role <select> held,
 * and the backend had no protection against changing away from 'admin').
 *
 * Safe to run more than once (no-ops if the account is already 'admin').
 * Run with: node scripts/run-db-script.js scripts/restore-admin-role.js --target=production
 */
require('dotenv').config();
const { query } = require('../src/db');

const EMAIL = 'luka888@msn.com';

async function run() {
  const result = await query(
    `UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id, email, username, role`,
    [EMAIL]
  );

  if (result.rows.length === 0) {
    console.log(`Nessun utente trovato con email ${EMAIL}.`);
    process.exit(1);
  }

  console.log('Ruolo ripristinato:');
  console.log(JSON.stringify(result.rows[0], null, 2));
  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Aggiornamento fallito:', err);
  process.exit(1);
});
