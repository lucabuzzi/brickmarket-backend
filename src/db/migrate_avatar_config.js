/**
 * Migration: CardBrix Town — aspetto del personaggio dell'utente.
 *
 * - users.avatar_config: JSONB nullable con un intero per ogni parte personalizzabile
 *   (pelle, capelli, vestiti, accessorio...). NULL = personaggio mai creato; il client
 *   mostra un aspetto di default. Validato dal server in src/services/avatarConfig.js.
 *
 * Nessun valore monetario né bonus legato al personaggio (CLAUDE.md, regole sui crediti).
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS). Rollback reversibile:
 *   node scripts/run-db-script.js src/db/migrate_avatar_config.js --target=<t> --down
 *
 * Run con: node scripts/run-db-script.js src/db/migrate_avatar_config.js --target=test|production
 */
require('dotenv').config();
const { query } = require('./index');

async function up() {
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_config JSONB;`);
  console.log('users.avatar_config ready.');
}

async function down() {
  await query(`ALTER TABLE users DROP COLUMN IF EXISTS avatar_config;`);
  console.log('users.avatar_config dropped.');
}

// The wrapper require()s this file, so detect the flag in argv instead of argv[2].
(process.argv.includes('--down') ? down() : up())
  .then(() => process.exit(0))
  .catch((err) => { console.error('Migration failed:', err.message); process.exit(1); });
