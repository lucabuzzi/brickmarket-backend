// Read-only look at what is attached to the demo listings, so a person can decide what to do with it.
// Runs inside a READ ONLY transaction: the database itself refuses any write, whatever this code does.
// Schema-agnostic on purpose (to_jsonb): it prints whatever columns the tables have today.
const { TAG, findReferences } = require('./removeDemoListings');

const quoteIdent = (s) => `"${String(s).replace(/"/g, '""')}"`;
const short = (v, n = 14) => (v == null ? '-' : String(v).length > n ? `${String(v).slice(0, n)}…` : String(v));
const date = (v) => (v == null ? '-' : String(v instanceof Date ? v.toISOString() : v).slice(0, 10));

/** What kind of money is behind a featured purchase, from its own fields. */
function classifyPurchase(p) {
  const method = String(p.method || '').toLowerCase();
  const ref = String(p.payment_ref || '');
  if (method === 'card' || ref.startsWith('pi_')) return 'PAGAMENTO CON CARTA (Stripe): denaro reale';
  if (method === 'wallet') return 'pagato con crediti (nessun denaro)';
  if (method === 'admin') return 'assegnato da admin (nessun pagamento)';
  return `metodo "${p.method ?? '?'}": da verificare`;
}

async function inspect({ client, log = () => {} }) {
  await client.query('BEGIN READ ONLY');
  try {
    const { rows: listings } = await client.query('SELECT id, title, status, type FROM listings WHERE description LIKE $1 ORDER BY created_at', [`%${TAG}%`]);
    if (!listings.length) {
      log('Nessun annuncio demo trovato.');
      return { listings: 0, purchases: [], other: {} };
    }
    const ids = listings.map((l) => l.id);
    const title = new Map(listings.map((l) => [l.id, `${l.title} [${l.status}]`]));
    const refs = await findReferences(client);

    const rowsByTable = {};
    for (const ref of refs) {
      const { rows } = await client.query(`SELECT to_jsonb(t) AS row FROM ${ref.table} t WHERE t.${quoteIdent(ref.column)} = ANY($1)`, [ids]);
      if (rows.length) rowsByTable[ref.table] = { column: ref.column, rows: rows.map((r) => r.row) };
    }

    const userIds = [...new Set(Object.values(rowsByTable).flatMap((t) => t.rows.map((r) => r.user_id)).filter(Boolean))];
    const users = new Map();
    if (userIds.length) {
      const { rows } = await client.query('SELECT id, username, role FROM users WHERE id = ANY($1)', [userIds]);
      rows.forEach((u) => users.set(u.id, u));
    }
    const who = (id) => (id ? `${users.get(id)?.username ?? '(utente non trovato)'} [${users.get(id)?.role ?? '?'}] ${short(id, 8)}` : '-');

    log(`Annunci demo: ${listings.length}. Tabelle con dati collegati: ${Object.keys(rowsByTable).join(', ') || 'nessuna'}.\n`);

    const purchases = (rowsByTable.featured_purchases?.rows || []);
    if (purchases.length) {
      log(`featured_purchases (${purchases.length}): acquisti/assegnazioni di "in evidenza"`);
      purchases.forEach((p) => {
        const amount = p.amount_cents != null ? `${(Number(p.amount_cents) / 100).toFixed(2)} € (${p.amount_cents} cent)` : p.amount_credits != null ? `${p.amount_credits} crediti` : 'nessun importo';
        log(`  ${date(p.created_at)}  ${title.get(p.listing_id) || short(p.listing_id)}`);
        log(`      da: ${who(p.user_id)} | ${p.method} | tariffa ${p.tariff} | ${p.days} giorni | ${amount} | ref ${short(p.payment_ref, 18)}`);
        log(`      => ${classifyPurchase(p)}`);
      });
      log('');
    }

    for (const [table, { rows }] of Object.entries(rowsByTable)) {
      if (table === 'featured_purchases') continue;
      log(`${table} (${rows.length})`);
      rows.forEach((r) => log(`  ${date(r.created_at)}  ${title.get(r.listing_id) || short(r.listing_id)}  utente: ${who(r.user_id)}`));
      log('');
    }

    return { listings: listings.length, purchases: purchases.map((p) => ({ ...p, kind: classifyPurchase(p) })), other: Object.fromEntries(Object.entries(rowsByTable).map(([t, v]) => [t, v.rows.length])) };
  } finally {
    await client.query('ROLLBACK'); // nothing to keep: this was only a look
  }
}

module.exports = { inspect, classifyPurchase };
