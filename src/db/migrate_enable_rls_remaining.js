/**
 * Migration: attiva la Row Level Security sulle 8 tabelle create dopo
 * migrate_enable_rls.sql, segnalate come "critical" dal Security Advisor di Supabase
 * (rls_disabled). Senza RLS sono leggibili e modificabili da chiunque abbia la anon key
 * pubblica tramite la REST API di Supabase — es. i valori dei bonus in credit_config o
 * gli hash di IP/dispositivo in user_identity_signals.
 *
 * Stesso schema già usato per le altre tabelle: RLS attiva, NESSUNA policy. Il backend
 * non è toccato: si collega come `postgres`, owner di queste tabelle e con BYPASSRLS
 * (verificato il 2026-09-23: rolbypassrls = true, nessuna FORCE ROW LEVEL SECURITY).
 * Nessun codice usa supabase-js/anon key su queste tabelle.
 *
 * Idempotente: ENABLE su una tabella che ha già RLS è un no-op.
 * Dopo l'up verifica da sola che tutte e 8 abbiano davvero RLS attiva, e fallisce se no.
 *
 * Reversibile (sempre tramite il wrapper — src/db/index.js rifiuta l'esecuzione diretta):
 *   node scripts/run-db-script.js src/db/migrate_enable_rls_remaining.js --target=production          (up)
 *   node scripts/run-db-script.js src/db/migrate_enable_rls_remaining.js --target=production --down   (down)
 * "--down" e non "down": il wrapper carica lo script con require(), quindi process.argv
 * è quello del wrapper.
 *
 * Nuove tabelle: vanno create con RLS già attiva (vedi migrate_featured_card_only.js).
 */
require('dotenv').config();
const { query } = require('./index');

const TABLES = [
  'shipments',
  'shipping_quotes',
  'contest_piece_locks',
  'cart_items',
  'credit_config',
  'referrals',
  'credit_bonus_grants',
  'user_identity_signals',
];

async function rlsStatus() {
  const r = await query(
    `SELECT c.relname, c.relrowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1)`,
    [TABLES]
  );
  return new Map(r.rows.map((row) => [row.relname, row.relrowsecurity]));
}

async function up() {
  const before = await rlsStatus();
  const missing = TABLES.filter((t) => !before.has(t));
  if (missing.length) {
    throw new Error(`Tabelle non trovate in public: ${missing.join(', ')} — niente è stato modificato.`);
  }

  for (const table of TABLES) {
    await query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    console.log(`  RLS attiva: ${table}${before.get(table) ? ' (lo era già)' : ''}`);
  }

  const after = await rlsStatus();
  const stillOff = TABLES.filter((t) => !after.get(t));
  if (stillOff.length) {
    throw new Error(`RLS ancora disattiva su: ${stillOff.join(', ')}`);
  }
  console.log(`✅  RLS attiva su tutte le ${TABLES.length} tabelle.`);
}

async function down() {
  for (const table of TABLES) {
    await query(`ALTER TABLE IF EXISTS public.${table} DISABLE ROW LEVEL SECURITY;`);
    console.log(`  RLS disattivata: ${table}`);
  }
  console.log('✅  Rollback completato (le tabelle tornano esposte alla anon key).');
}

const direction = process.argv.includes('--down') ? down : up;

direction()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  });
