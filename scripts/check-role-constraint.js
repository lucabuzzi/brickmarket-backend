/**
 * Diagnostica di sola lettura: stampa la definizione attuale del CHECK
 * constraint su users.role, per verificare se accetta già 'user' o se è
 * ancora fermo al vecchio elenco (buyer/seller/both/shop/admin).
 *
 * Run con: node scripts/run-db-script.js scripts/check-role-constraint.js --target=production
 */
require('dotenv').config();
const { query } = require('../src/db');

async function run() {
  const result = await query(
    `SELECT conname, pg_get_constraintdef(oid) AS definition
     FROM pg_constraint
     WHERE conrelid = 'users'::regclass AND conname = 'users_role_check'`
  );

  if (result.rows.length === 0) {
    console.log('Nessun constraint "users_role_check" trovato.');
    process.exit(0);
  }

  console.log(JSON.stringify(result.rows[0], null, 2));
  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Query fallita:', err);
  process.exit(1);
});
