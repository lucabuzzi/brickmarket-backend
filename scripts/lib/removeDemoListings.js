// Logic of scripts/remove-demo-listings.js, kept separate (and free of any DB import) so it can be tested
// with a fake client. It removes the demo listings created by scripts/seed-dummy-data.js, which carry the
// marker "__DEMO_SEED__" in their description and are publicly visible on the live site.
//
// Safety, in order:
//   1. dry run by default: it only reports; nothing is written unless apply === true
//   2. it always prints what it found, and stops unless the number to remove is EXACTLY the expected one
//   3. a demo listing that anything else points at (orders, bids, carts, featured purchases...) is BLOCKED.
//      The default is to stop. A person can choose, explicitly:
//        skipWithDependents  -> remove only the listings with nothing attached, leave the blocked ones alone
//        allowDependents     -> accept that rows in named tables (must be ON DELETE CASCADE) go with the listing
//   4. a JSON copy of every row that will disappear (listings AND allowed dependents) is written BEFORE the delete
//   5. the delete runs in one transaction, restricted to those ids AND the marker, and is rolled back
//      unless it removes exactly the listings that were selected
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
  return rows.map((r) => ({ table: r.table_name, column: r.column_name, onDelete: ON_DELETE[r.on_delete] || r.on_delete }));
}

/** -> [{ table, column, onDelete, total, perListing: { [listingId]: n } }] for every referencing table. */
async function countDependents(client, refs, ids) {
  const out = [];
  for (const ref of refs) {
    // ref.table comes out of regclass::text (already quoted where needed); the column is quoted here
    const col = quoteIdent(ref.column);
    const { rows } = await client.query(`SELECT ${col} AS listing_id, count(*)::int AS n FROM ${ref.table} WHERE ${col} = ANY($1) GROUP BY ${col}`, [ids]);
    const perListing = Object.fromEntries(rows.map((r) => [r.listing_id, r.n]));
    out.push({ ...ref, perListing, total: rows.reduce((s, r) => s + r.n, 0) });
  }
  return out;
}

async function fetchDependentRows(client, ref, ids) {
  const { rows } = await client.query(`SELECT to_jsonb(t) AS row FROM ${ref.table} t WHERE t.${quoteIdent(ref.column)} = ANY($1)`, [ids]);
  return rows.map((r) => r.row);
}

/**
 * @param {object} o
 * @param {{query: Function}} o.client   a pg client (already connected)
 * @param {boolean} [o.apply]            false = dry run (default)
 * @param {number}  [o.expect]           how many listings must be selected for removal (default 4)
 * @param {boolean} [o.skipWithDependents] leave listings that have attached rows alone, remove the rest
 * @param {string[]} [o.allowDependents]  tables whose rows may be removed together with their listing (CASCADE only)
 * @param {(payload: object) => string} [o.writeBackup]  persists { listings, dependents } and returns where (required to apply)
 * @param {(msg: string) => void} [o.log]
 */
async function run({ client, apply = false, expect = 4, skipWithDependents = false, allowDependents = [], writeBackup, log = () => {} }) {
  const { rows } = await client.query('SELECT * FROM listings WHERE description LIKE $1 ORDER BY created_at', [`%${TAG}%`]);

  if (rows.length === 0) {
    log('Nessun annuncio demo trovato: niente da fare.');
    return { found: 0, removed: 0, dryRun: !apply };
  }

  // Always show what was found BEFORE judging anything: a mismatch is exactly when a person needs the list.
  const fmt = (r) => `  ${r.id}  ${String(r.status).padEnd(9)} ${String(r.type).padEnd(8)} ${String(r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at).slice(0, 10)}  ${r.title}`;
  log(`Annunci demo trovati (${rows.length}):`);
  rows.forEach((r) => log(fmt(r)));

  const ids = rows.map((r) => r.id);
  const refs = await findReferences(client);
  const deps = await countDependents(client, refs, ids);
  log('Dati collegati a questi annunci:');
  deps.forEach((d) => log(`  ${d.table}.${d.column} (${d.onDelete}): ${d.total}`));

  // --allow-dependents: only tables that exist and cascade; anything else could never be honoured safely
  for (const name of allowDependents) {
    const ref = refs.find((r) => r.table === name);
    if (!ref) throw new Error(`--allow-dependents: "${name}" non è una tabella che punta agli annunci. Disponibili: ${refs.map((r) => r.table).join(', ')}.`);
    if (ref.onDelete !== 'CASCADE') throw new Error(`--allow-dependents: "${name}" è ${ref.onDelete}, non CASCADE: non si può accettare, andrebbe risolta a mano.`);
  }
  const allowed = new Set(allowDependents);

  const blockedBy = new Map(); // listing id -> ["table (n)", ...] from tables that were NOT explicitly allowed
  for (const d of deps) {
    if (allowed.has(d.table)) continue;
    for (const [id, n] of Object.entries(d.perListing)) {
      if (!blockedBy.has(id)) blockedBy.set(id, []);
      blockedBy.get(id).push(`${d.table} (${n})`);
    }
  }

  if (blockedBy.size) {
    log('\nAnnunci con dati collegati (bloccati):');
    rows.filter((r) => blockedBy.has(r.id)).forEach((r) => log(`${fmt(r)}\n      -> ${blockedBy.get(r.id).join(', ')}`));
    if (!skipWithDependents) {
      throw new Error(
        `${blockedBy.size} annunci demo hanno dati collegati. Nessuna modifica. Guarda prima cosa sono ` +
        '(scripts/inspect-demo-listing-dependents.js), poi scegli: --skip-with-dependents per rimuovere solo gli altri, ' +
        'oppure --allow-dependents=<tabella> se accetti che quelle righe vengano cancellate insieme all\'annuncio.'
      );
    }
    log(`\n--skip-with-dependents: ${blockedBy.size} annunci restano dove sono.`);
  }

  const selected = rows.filter((r) => !blockedBy.has(r.id));
  if (selected.length === 0) {
    log('\nNessun annuncio da rimuovere.');
    return { found: rows.length, removed: 0, dryRun: !apply, ids: [] };
  }
  log(`\nDa rimuovere (${selected.length}):`);
  selected.forEach((r) => log(fmt(r)));

  if (selected.length !== expect) {
    throw new Error(`Da rimuovere ${selected.length} annunci, ne erano attesi ${expect}. Nessuna modifica. L'elenco è qui sopra: se è quello giusto, rilancia con --expect=${selected.length}.`);
  }

  const selectedIds = selected.map((r) => r.id);
  const cascading = deps.filter((d) => allowed.has(d.table) && selectedIds.some((id) => d.perListing[id]));
  if (cascading.length) log(`Insieme agli annunci verranno cancellate anche: ${cascading.map((d) => `${d.table} (${selectedIds.reduce((s, id) => s + (d.perListing[id] || 0), 0)})`).join(', ')}.`);

  if (!apply) {
    log(`\nDRY RUN: non ho modificato nulla. Per rimuovere questi ${selected.length} annunci rilancia con --apply.`);
    return { found: rows.length, removed: 0, dryRun: true, ids: selectedIds };
  }

  if (typeof writeBackup !== 'function') throw new Error('writeBackup è obbligatorio con --apply: non cancello senza una copia.');
  const dependents = {};
  for (const d of cascading) dependents[d.table] = await fetchDependentRows(client, d, selectedIds);
  const backupPath = writeBackup({ listings: selected, dependents });
  log(`Copia di sicurezza scritta in: ${backupPath}`);

  await client.query('BEGIN');
  try {
    const res = await client.query('DELETE FROM listings WHERE id = ANY($1) AND description LIKE $2 RETURNING id', [selectedIds, `%${TAG}%`]);
    if (res.rowCount !== selected.length) throw new Error(`La cancellazione ha toccato ${res.rowCount} righe invece di ${selected.length}: annullo tutto.`);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  log(`Rimossi ${selected.length} annunci demo.`);
  return { found: rows.length, removed: selected.length, dryRun: false, ids: selectedIds, backupPath };
}

module.exports = { run, findReferences, countDependents, TAG };
