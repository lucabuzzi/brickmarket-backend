/**
 * Migration: normalizza users.address_country a ISO 3166-1 alpha-2 MAIUSCOLO ('IT').
 *
 * La colonna era testo libero: lo stesso paese finiva nel DB come 'it', 'IT', 'Italia', 'ITALIA'...
 * e la directory utenti mostrava due gruppi "Italia". Da ora il backend (authValidators) salva solo
 * codici ISO; questa migrazione sistema le righe già esistenti.
 *
 * Sicurezza:
 * - DEFAULT = DRY-RUN: senza flag stampa soltanto cosa cambierebbe (valori distinti e conteggi), non scrive nulla.
 * - `--apply`: in UNA transazione crea public.users_country_backup (user_id, old_value) con il valore
 *   originale delle sole righe modificate, poi le aggiorna. Valori non riconosciuti NON vengono toccati: li
 *   elenca, decide una persona.
 * - `--down`: ripristina i valori originali dal backup (solo dove la colonna non è cambiata di nuovo dopo la
 *   migrazione), poi elimina la tabella di backup.
 * - Idempotente: una seconda --apply non trova nulla da cambiare (il backup non viene sovrascritto).
 *
 * Run con (i flag dopo lo script sono letti da questo file):
 *   node scripts/run-db-script.js src/db/migrate_normalize_user_country.js --target=production
 *   node scripts/run-db-script.js src/db/migrate_normalize_user_country.js --target=production --apply
 *   node scripts/run-db-script.js src/db/migrate_normalize_user_country.js --target=production --down
 */
require('dotenv').config();
const { query, getClient } = require('./index');
const { planCountryNormalization } = require('../utils/country');

const APPLY = process.argv.includes('--apply');
const DOWN = process.argv.includes('--down');

function countBy(items, key) {
  const m = new Map();
  for (const it of items) m.set(it[key], (m.get(it[key]) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

async function up() {
  const { rows } = await query('SELECT id, address_country FROM users WHERE address_country IS NOT NULL');
  const { changes, unrecognized } = planCountryNormalization(rows);

  console.log(`Utenti con address_country: ${rows.length}`);
  console.log(`Da normalizzare: ${changes.length}`);
  for (const [k, n] of countBy(changes.map((c) => ({ k: `${JSON.stringify(c.old)} -> ${c.code}` })), 'k')) {
    console.log(`  ${k}: ${n}`);
  }
  console.log(`Non riconosciuti (NON toccati): ${unrecognized.length}`);
  for (const [v, n] of countBy(unrecognized, 'old')) console.log(`  ${JSON.stringify(v)}: ${n}`);

  if (!APPLY) {
    console.log('\nDRY-RUN: nessuna modifica. Riesegui con --apply per applicare.');
    return;
  }
  if (changes.length === 0) {
    console.log('Niente da fare.');
    return;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users_country_backup (
        user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        old_value  VARCHAR(100) NOT NULL,
        new_value  VARCHAR(2)   NOT NULL,
        backed_up_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
      );
    `);
    // RLS attivo su tutte le tabelle public (vedi migrate_enable_rls*): nessuna policy = solo il ruolo del backend.
    await client.query('ALTER TABLE public.users_country_backup ENABLE ROW LEVEL SECURITY;');
    for (const { id, old, code } of changes) {
      // DO NOTHING: se esiste già un backup per l'utente (run precedente) il valore originale resta quello vero.
      await client.query(
        'INSERT INTO public.users_country_backup (user_id, old_value, new_value) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING',
        [id, old, code]
      );
      await client.query('UPDATE users SET address_country = $1 WHERE id = $2 AND address_country = $3', [code, id, old]);
    }
    await client.query('COMMIT');
    console.log(`✅  Normalizzati ${changes.length} utenti. Backup in public.users_country_backup.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const exists = await client.query("SELECT to_regclass('public.users_country_backup') AS t");
    if (!exists.rows[0].t) {
      console.log('Nessuna tabella di backup: niente da ripristinare.');
      await client.query('COMMIT');
      return;
    }
    // Ripristina solo dove il valore è ancora quello scritto dalla migrazione (non sovrascrive modifiche successive dell'utente).
    const res = await client.query(`
      UPDATE users u SET address_country = b.old_value
      FROM public.users_country_backup b
      WHERE u.id = b.user_id AND u.address_country = b.new_value
    `);
    await client.query('DROP TABLE public.users_country_backup');
    await client.query('COMMIT');
    console.log(`✅  Ripristinati ${res.rowCount} utenti, tabella di backup eliminata.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

(DOWN ? down() : up())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌  Migration failed:', err);
    process.exit(1);
  });
