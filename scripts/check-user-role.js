/**
 * Diagnostica di sola lettura: stampa lo stato completo dell'account
 * luka888@msn.com così com'è nel database in questo momento — nessuna
 * scrittura, nessuna modifica. Serve a capire perché /api/auth/me sta
 * restituendo role: undefined per questo utente.
 *
 * Run con: node scripts/run-db-script.js scripts/check-user-role.js --target=production
 */
require('dotenv').config();
const { query } = require('../src/db');

const EMAIL = 'luka888@msn.com';

async function run() {
  const result = await query(
    `SELECT id, email, username, role, is_active, email_verified, created_at, updated_at
     FROM users WHERE email = $1`,
    [EMAIL]
  );

  if (result.rows.length === 0) {
    console.log(`Nessun utente trovato con email ${EMAIL}.`);
    process.exit(0);
  }

  console.log(`Trovati ${result.rows.length} account con questa email:`);
  for (const u of result.rows) {
    console.log(JSON.stringify(u, null, 2));
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Query fallita:', err);
  process.exit(1);
});
