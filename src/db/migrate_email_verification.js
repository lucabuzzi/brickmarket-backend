/**
 * Migration: colonne per il flusso di verifica email della registrazione classica
 * (email+password). Gli account OAuth (Google/Apple) restano fuori da questo flusso:
 * arrivano già con `email_verified` impostato dal provider (vedi
 * userRepository.createOAuthUser / migrate_oauth_prep.js).
 *
 * Stesso pattern già usato per il reset password (reset_password_token/_expires):
 * token casuale generato lato app, solo l'hash SHA-256 finisce nel DB, con scadenza.
 *
 * Idempotente: sicuro da rieseguire (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
 *
 * Rollback manuale, se mai servisse:
 *   ALTER TABLE users DROP COLUMN email_verification_token;
 *   ALTER TABLE users DROP COLUMN email_verification_expires;
 *
 * Run con: node scripts/run-db-script.js src/db/migrate_email_verification.js --target=test|production
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running email verification migration...');

  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(64),
      ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE;
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);`);

  console.log('✅  users.email_verification_token / email_verification_expires pronte.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
