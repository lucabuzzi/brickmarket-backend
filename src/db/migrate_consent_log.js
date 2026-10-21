/**
 * Migration: registro dei consensi cookie (prova del consenso, art. 7.1 GDPR).
 *
 * - consent_log: una riga per scelta fatta nel banner (accettato / rifiutato), con versione
 *   dell'informativa, origine della scelta (banner, segnale GPC, pannello "Gestisci cookie"),
 *   utente se loggato, impronta HMAC dell'IP (mai l'IP in chiaro) e user agent troncato.
 *   Append-only. Conservazione: vedi Informativa privacy; la pulizia a scadenza è
 *   src/services/consentLog.js#purgeOlderThan, da pianificare.
 * - RLS attiva (tests/rls-enabled.test.js): la tabella non deve essere esposta dall'API REST di Supabase.
 *
 * Idempotente (IF NOT EXISTS). Rollback reversibile:
 *   node scripts/run-db-script.js src/db/migrate_consent_log.js --target=<t> --down
 *
 * Run con: node scripts/run-db-script.js src/db/migrate_consent_log.js --target=test|production
 */
require('dotenv').config();
const { query } = require('./index');

async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.consent_log (
      id             BIGSERIAL PRIMARY KEY,
      choice         VARCHAR(10) NOT NULL CHECK (choice IN ('accepted', 'rejected')),
      source         VARCHAR(10) NOT NULL CHECK (source IN ('banner', 'gpc', 'settings')),
      policy_version VARCHAR(20) NOT NULL,
      user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
      ip_hash        VARCHAR(64),
      user_agent     VARCHAR(200),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_consent_log_created_at ON public.consent_log(created_at);
    ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;
  `);
  console.log('consent_log ready.');
}

async function down() {
  await query(`DROP TABLE IF EXISTS public.consent_log;`);
  console.log('consent_log dropped.');
}

// The wrapper require()s this file, so detect the flag in argv instead of argv[2].
(process.argv.includes('--down') ? down() : up())
  .then(() => process.exit(0))
  .catch((err) => { console.error('Migration failed:', err.message); process.exit(1); });
