/**
 * Migration: indice sulle notifiche per utente (fase 5 del refactor).
 *
 * La campanella chiede ogni 10 secondi, per ogni utente collegato, quante notifiche non lette ha
 * (src/routes/notifications.js): WHERE user_id = $1 AND is_read = FALSE. La pagina notifiche le elenca per data
 * (WHERE user_id = $1 ORDER BY created_at DESC) e "segna tutte come lette" aggiorna WHERE user_id = $1.
 * Senza indice su user_id Postgres legge TUTTA la tabella ogni volta: oggi è minuscola, con molti utenti
 * rallenterebbe tutto il database. Questo indice (utente, data più recente prima) serve a tutte e tre le query.
 *
 * Creato CONCURRENTLY: mentre si costruisce, il sito continua a scrivere notifiche senza blocchi (per questo
 * non gira dentro una transazione). Se una costruzione concorrente fallisce a metà, Postgres lascia l'indice
 * "invalido": la migrazione lo rileva e lo ricostruisce.
 *
 * Nessun dato viene modificato. Idempotente. Reversibile:
 *   node scripts/run-db-script.js src/db/migrate_notifications_user_index.js --target=<t>           (up)
 *   node scripts/run-db-script.js src/db/migrate_notifications_user_index.js --target=<t> --down    (down: elimina l'indice)
 */
require('dotenv').config();
const { query } = require('./index');

const INDEX = 'idx_notifications_user_created';

async function indexState() {
  const r = await query(
    `SELECT i.indisvalid AS valid
       FROM pg_class c
       JOIN pg_index i ON i.indexrelid = c.oid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = $1 AND n.nspname = 'public'`,
    [INDEX]
  );
  if (!r.rows.length) return 'missing';
  return r.rows[0].valid ? 'valid' : 'invalid';
}

async function up() {
  if (await indexState() === 'invalid') {
    console.log(`${INDEX} was left invalid by an interrupted build: rebuilding it.`);
    await query(`DROP INDEX CONCURRENTLY IF EXISTS public.${INDEX};`);
  }
  await query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${INDEX} ON public.notifications (user_id, created_at DESC);`);

  const state = await indexState();
  if (state !== 'valid') throw new Error(`${INDEX} is ${state} after the build`);
  console.log(`${INDEX} ready on public.notifications (user_id, created_at DESC).`);
}

async function down() {
  await query(`DROP INDEX CONCURRENTLY IF EXISTS public.${INDEX};`);
  console.log(`${INDEX} dropped.`);
}

// The wrapper require()s this file, so detect the flag in argv instead of argv[2].
(process.argv.includes('--down') ? down() : up())
  .then(() => process.exit(0))
  .catch((err) => { console.error('Migration failed:', err.message); process.exit(1); });
