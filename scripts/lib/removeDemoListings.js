// Logic of scripts/remove-demo-listings.js, kept separate (and free of any DB import) so it can be tested
// with a fake client. It removes the demo listings created by scripts/seed-dummy-data.js, which carry the
// marker "__DEMO_SEED__" in their description and are publicly visible on the live site.
//
// Safety, in order:
//   1. dry run by default: it only reports; nothing is written unless apply === true
//   2. it must find EXACTLY the expected number of demo listings (all statuses), else it stops
//   3. it stops if anything else references those listings (orders, bids, favourites, featured purchases...):
//      a demo listing that has real activity attached must be looked at by a person
//   4. a JSON copy of every row is written BEFORE the delete
//   5. the delete runs in one transaction, restricted to those ids AND the marker, and is rolled back
//      unless it removes exactly the rows that were found
const TAG = '__DEMO_SEED__';

const quoteIdent = (s) => `"${String(s).replace(/"/g, '""')}"`;

const ON_DELETE = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };

/** Every single-column foreign key that points at listings(id), read from the catalog, not hard-coded. */
async function findReferences(client) {
  const { rows } = await client.query(
    `SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name, c.confdeltype AS on_delete
     FROM pg_constraint c
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'listings'::regclass AND array_length(c.conkey, 1) = 1
     ORDER BY 1, 2`
  );
  return rows;
}

async function countDependents(client, refs, ids) {
  const out = [];
  for (const ref of refs) {
    // table_name comes out of regclass::text (already quoted where needed); the column is quoted here
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${ref.table_name} WHERE ${quoteIdent(ref.column_name)} = ANY($1)`, [ids]);
    out.push({ table: ref.table_name, column: ref.column_name, onDelete: ON_DELETE[ref.on_delete] || ref.on_delete, rows: rows[0].n });
  }
  return out;
}

/**
 * @param {object} o
 * @param {{query: Function}} o.client   a pg client (already connected)
 * @param {boolean} [o.apply]            false = dry run (default)
 * @param {number}  [o.expect]           how many demo listings we expect to find
 * @param {(rows: object[]) => string} [o.writeBackup]  persists the rows and returns where (required to apply)
 * @param {(msg: string) => void} [o.log]
 */
async function run({ client, apply = false, expect = 4, writeBackup, log = () => {} }) {
  const { rows } = await client.query('SELECT * FROM listings WHERE description LIKE $1 ORDER BY created_at', [`%${TAG}%`]);

  if (rows.length === 0) {
    log('Nessun annuncio demo trovato: niente da fare.');
    return { found: 0, removed: 0, dryRun: !apply };
  }
  if (rows.length !== expect) {
    throw new Error(`Trovati ${rows.length} annunci demo, ne erano attesi ${expect}. Nessuna modifica. Controlla l'elenco con il dry run e, se è giusto, rilancia con --expect=${rows.length}.`);
  }

  log(`Annunci demo trovati (${rows.length}):`);
  rows.forEach((r) => log(`  ${r.id}  ${String(r.status).padEnd(8)} ${String(r.type).padEnd(8)} ${r.title}`));

  const ids = rows.map((r) => r.id);
  const deps = await countDependents(client, await findReferences(client), ids);
  log('Dati collegati a questi annunci:');
  deps.forEach((d) => log(`  ${d.table}.${d.column} (${d.onDelete}): ${d.rows}`));

  const blocking = deps.filter((d) => d.rows > 0);
  if (blocking.length) {
    throw new Error(`Ci sono dati collegati agli annunci demo (${blocking.map((d) => `${d.table}: ${d.rows}`).join(', ')}). Nessuna modifica: vanno guardati a mano.`);
  }

  if (!apply) {
    log(`\nDRY RUN: non ho modificato nulla. Per rimuovere questi ${rows.length} annunci rilancia con --apply.`);
    return { found: rows.length, removed: 0, dryRun: true, ids };
  }

  if (typeof writeBackup !== 'function') throw new Error('writeBackup è obbligatorio con --apply: non cancello senza una copia.');
  const backupPath = writeBackup(rows);
  log(`Copia di sicurezza scritta in: ${backupPath}`);

  await client.query('BEGIN');
  try {
    const res = await client.query('DELETE FROM listings WHERE id = ANY($1) AND description LIKE $2 RETURNING id', [ids, `%${TAG}%`]);
    if (res.rowCount !== rows.length) throw new Error(`La cancellazione ha toccato ${res.rowCount} righe invece di ${rows.length}: annullo tutto.`);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  log(`Rimossi ${rows.length} annunci demo.`);
  return { found: rows.length, removed: rows.length, dryRun: false, ids, backupPath };
}

module.exports = { run, findReferences, countDependents, TAG };
