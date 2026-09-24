// scripts/lib/removeDemoListings.js and inspectDemoDependents.js: the safety rails around removing the demo
// listings from production. Uses a fake pg client, so nothing here can reach a database.
const fs = require('fs');
const path = require('path');
const { run, TAG } = require('../scripts/lib/removeDemoListings');
const { inspect, classifyPurchase } = require('../scripts/lib/inspectDemoDependents');

const demo = (id, over = {}) => ({ id, title: `Demo ${id}`, status: 'active', type: 'used', description: `Testo. ${TAG}`, created_at: '2026-08-12T10:00:00Z', ...over });
const FOUR = ['a1', 'a2', 'a3', 'a4'].map((id) => demo(id));

const REFS = [
  { table_name: 'bids', column_name: 'listing_id', on_delete: 'c' },
  { table_name: 'cart_items', column_name: 'listing_id', on_delete: 'c' },
  { table_name: 'featured_purchases', column_name: 'listing_id', on_delete: 'c' },
  { table_name: 'orders', column_name: 'listing_id', on_delete: 'a' },
];

/**
 * A fake client that answers by looking at the SQL and records every call.
 * deps: { table: { listingId: count } }   dependentRows: { table: [row, ...] }
 */
function fakeClient({ rows = FOUR, refs = REFS, deps = {}, dependentRows = {}, deleteCount, users = [] } = {}) {
  const calls = [];
  return {
    calls,
    query: jest.fn(async (sql, params) => {
      calls.push({ sql, params });
      if (/^SELECT \* FROM listings/.test(sql)) return { rows };
      if (/^SELECT id, title, status, type FROM listings/.test(sql)) return { rows };
      if (/FROM pg_constraint/.test(sql)) return { rows: refs };
      const count = sql.match(/AS listing_id, count\(\*\)::int AS n FROM (\S+) WHERE/);
      if (count) return { rows: Object.entries(deps[count[1]] || {}).map(([listing_id, n]) => ({ listing_id, n })) };
      const dep = sql.match(/SELECT to_jsonb\(t\) AS row FROM (\S+) t WHERE/);
      if (dep) return { rows: (dependentRows[dep[1]] || []).map((row) => ({ row })) };
      if (/^SELECT id, username, role FROM users/.test(sql)) return { rows: users };
      if (/^DELETE FROM listings/.test(sql)) return { rowCount: deleteCount ?? params[0].length, rows: params[0].map((id) => ({ id })) };
      return { rows: [], rowCount: 0 }; // BEGIN / COMMIT / ROLLBACK
    }),
  };
}
const wrote = (c) => c.calls.some((x) => /^(BEGIN|DELETE|COMMIT)/.test(x.sql) && !/READ ONLY/.test(x.sql));
const deleted = (c) => c.calls.find((x) => /^DELETE FROM listings/.test(x.sql));
const text = (log) => log.mock.calls.map((x) => x[0]).join('\n');

describe('dry run (the default)', () => {
  test('reports what it found and what depends on it, and changes nothing', async () => {
    const c = fakeClient();
    const log = jest.fn();
    const r = await run({ client: c, log });
    expect(r).toMatchObject({ found: 4, removed: 0, dryRun: true, ids: ['a1', 'a2', 'a3', 'a4'] });
    expect(wrote(c)).toBe(false);
    expect(text(log)).toContain('Annunci demo trovati (4)');
    expect(text(log)).toMatch(/orders\.listing_id \(NO ACTION\): 0/);
    expect(text(log)).toMatch(/bids\.listing_id \(CASCADE\): 0/);
    expect(text(log)).toMatch(/DRY RUN.*--apply/);
  });

  test('the marker travels as a bound parameter, never inside the SQL text', async () => {
    const c = fakeClient();
    await run({ client: c });
    const select = c.calls.find((x) => /^SELECT \* FROM listings/.test(x.sql));
    expect(select.sql).not.toContain(TAG);
    expect(select.params).toEqual([`%${TAG}%`]);
  });

  test('no demo listings at all: a clean no-op', async () => {
    const c = fakeClient({ rows: [] });
    expect(await run({ client: c, apply: true, writeBackup: jest.fn() })).toMatchObject({ found: 0, removed: 0 });
    expect(wrote(c)).toBe(false);
  });
});

describe('the number to remove must be exactly the expected one', () => {
  test('a different number stops it (even with apply), and the list is printed first', async () => {
    for (const rows of [FOUR.slice(0, 3), [...FOUR, demo('a5', { status: 'sold' }), demo('a6', { status: 'draft', created_at: new Date('2026-08-15T00:00:00Z') })]]) {
      const c = fakeClient({ rows });
      const log = jest.fn();
      await expect(run({ client: c, apply: true, writeBackup: jest.fn(), log })).rejects.toThrow(/Da rimuovere \d annunci, ne erano attesi 4.*--expect=\d/);
      expect(wrote(c)).toBe(false);
      expect(text(log)).toContain(`Annunci demo trovati (${rows.length})`);
    }
    const log = jest.fn();
    await expect(run({ client: fakeClient({ rows: [...FOUR, demo('a5', { status: 'draft', created_at: new Date('2026-08-15T00:00:00Z') })] }), log })).rejects.toThrow();
    expect(text(log)).toMatch(/a5\s+draft\s+used\s+2026-08-15\s+Demo a5/); // id, status, type, date and title
  });

  test('--expect lets a person confirm another count after reading the list', async () => {
    const c = fakeClient({ rows: [...FOUR, demo('a5')] });
    await expect(run({ client: c, expect: 5 })).resolves.toMatchObject({ found: 5, dryRun: true });
  });
});

describe('listings with something attached are blocked', () => {
  test('by default one blocked listing stops everything, and the log says which listing and which table', async () => {
    for (const deps of [{ orders: { a2: 1 } }, { bids: { a3: 2 } }, { cart_items: { a1: 1 } }, { featured_purchases: { a4: 4 } }]) {
      const c = fakeClient({ deps });
      const log = jest.fn();
      const table = Object.keys(deps)[0];
      const [id, n] = Object.entries(deps[table])[0];
      await expect(run({ client: c, apply: true, writeBackup: jest.fn(), log })).rejects.toThrow(/1 annunci demo hanno dati collegati.*--skip-with-dependents.*--allow-dependents/);
      expect(wrote(c)).toBe(false);
      expect(text(log)).toContain('Annunci con dati collegati (bloccati)');
      expect(text(log)).toContain(`-> ${table} (${n})`);
      expect(text(log)).toContain(id);
    }
  });

  test('--skip-with-dependents removes only the listings with nothing attached and leaves the blocked ones', async () => {
    const rows = ['c1', 'c2', 'c3', 'c4', 'b1', 'b2'].map((id) => demo(id));
    const c = fakeClient({ rows, deps: { featured_purchases: { b1: 3 }, cart_items: { b2: 1 } } });
    const log = jest.fn();
    const backups = [];
    const r = await run({ client: c, apply: true, skipWithDependents: true, writeBackup: (p) => { backups.push(p); return 'b.json'; }, log });
    expect(r).toMatchObject({ removed: 4, ids: ['c1', 'c2', 'c3', 'c4'] });
    expect(deleted(c).params[0]).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(deleted(c).params[0]).not.toContain('b1');
    expect(deleted(c).params[0]).not.toContain('b2');
    expect(text(log)).toContain('2 annunci restano dove sono');
    expect(backups[0].listings.map((l) => l.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(backups[0].dependents).toEqual({}); // nothing attached to the removed ones, nothing cascaded
  });

  test('--skip-with-dependents still checks the count of what will really be removed', async () => {
    const rows = ['c1', 'c2', 'c3', 'b1'].map((id) => demo(id));
    const c = fakeClient({ rows, deps: { orders: { b1: 1 } } });
    await expect(run({ client: c, skipWithDependents: true })).rejects.toThrow(/Da rimuovere 3 annunci, ne erano attesi 4.*--expect=3/);
    await expect(run({ client: fakeClient({ rows, deps: { orders: { b1: 1 } } }), skipWithDependents: true, expect: 3 })).resolves.toMatchObject({ dryRun: true, ids: ['c1', 'c2', 'c3'] });
  });

  test('if every listing is blocked and skipping is chosen, there is simply nothing to do', async () => {
    const c = fakeClient({ rows: [demo('b1')], deps: { orders: { b1: 1 } } });
    expect(await run({ client: c, skipWithDependents: true, apply: true, writeBackup: jest.fn() })).toMatchObject({ removed: 0 });
    expect(wrote(c)).toBe(false);
  });
});

describe('--allow-dependents: accepting a cascade, explicitly, table by table', () => {
  const rows = ['a1', 'a2', 'a3', 'a4'].map((id) => demo(id));
  const dependentRows = { featured_purchases: [{ id: 'f1', listing_id: 'a2', method: 'admin' }, { id: 'f2', listing_id: 'a2', method: 'admin' }] };

  test('the allowed table no longer blocks, the cascaded rows are announced and saved in the backup', async () => {
    const c = fakeClient({ rows, deps: { featured_purchases: { a2: 2 } }, dependentRows });
    const log = jest.fn();
    const backups = [];
    const r = await run({ client: c, apply: true, allowDependents: ['featured_purchases'], writeBackup: (p) => { backups.push(p); return 'b.json'; }, log });
    expect(r.removed).toBe(4);
    expect(text(log)).toContain('anche: featured_purchases (2)');
    expect(backups[0].dependents.featured_purchases).toEqual(dependentRows.featured_purchases);
    expect(deleted(c).params[0]).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  test('only the named table is allowed: another table with rows still blocks', async () => {
    const c = fakeClient({ rows, deps: { featured_purchases: { a2: 2 }, cart_items: { a3: 1 } } });
    await expect(run({ client: c, apply: true, allowDependents: ['featured_purchases'], writeBackup: jest.fn() })).rejects.toThrow(/1 annunci demo hanno dati collegati/);
    expect(wrote(c)).toBe(false);
  });

  test('a table that does not cascade can never be allowed, and unknown names are rejected', async () => {
    await expect(run({ client: fakeClient({ rows }), allowDependents: ['orders'] })).rejects.toThrow(/"orders" è NO ACTION, non CASCADE/);
    await expect(run({ client: fakeClient({ rows }), allowDependents: ['users'] })).rejects.toThrow(/"users" non è una tabella che punta agli annunci/);
  });

  test('the backup of cascaded rows is fetched before the delete', async () => {
    const c = fakeClient({ rows, deps: { featured_purchases: { a2: 2 } }, dependentRows });
    await run({ client: c, apply: true, allowDependents: ['featured_purchases'], writeBackup: () => 'b.json' });
    const iFetch = c.calls.findIndex((x) => /to_jsonb\(t\)/.test(x.sql));
    const iDelete = c.calls.findIndex((x) => /^DELETE FROM listings/.test(x.sql));
    expect(iFetch).toBeGreaterThan(-1);
    expect(iFetch).toBeLessThan(iDelete);
  });
});

describe('the real situation seen on production: 10 demo listings, some with featured purchases and a cart', () => {
  const rows = [
    demo('act1', { title: 'Modulare Piazza centrale' }), demo('act2', { title: 'MOC nave spaziale custom', type: 'moc' }),
    demo('act3', { title: 'Millennium Falcon UCS' }), demo('act4', { title: 'Castello Disney sigillato', type: 'sealed' }),
    demo('exp1', { status: 'expired', type: 'auction' }), demo('exp2', { status: 'expired', type: 'auction' }), demo('exp3', { status: 'expired', type: 'auction' }),
    demo('exp4', { status: 'expired', type: 'auction' }), demo('exp5', { status: 'expired', type: 'auction' }), demo('sold1', { status: 'sold', type: 'sealed' }),
  ];
  const deps = { featured_purchases: { exp1: 1, exp2: 1, sold1: 2 }, cart_items: { exp5: 1 } };

  test('by default it stops and names the 4 blocked listings', async () => {
    const log = jest.fn();
    await expect(run({ client: fakeClient({ rows, deps }), expect: 10, log })).rejects.toThrow(/4 annunci demo hanno dati collegati/);
    for (const id of ['exp1', 'exp2', 'exp5', 'sold1']) expect(text(log)).toContain(id);
  });

  test('skipping the blocked ones leaves 6 to remove: the 4 active plus the 2 expired auctions with nothing attached', async () => {
    // with the default expectation of 4 it refuses and says the real number...
    await expect(run({ client: fakeClient({ rows, deps }), skipWithDependents: true })).rejects.toThrow(/Da rimuovere 6 annunci, ne erano attesi 4.*--expect=6/);
    // ...and with --expect=6 it goes ahead, touching neither the blocked ones nor anything they have attached
    const c = fakeClient({ rows, deps });
    const r = await run({ client: c, skipWithDependents: true, expect: 6, apply: true, writeBackup: () => 'b.json' });
    expect(r.ids).toEqual(['act1', 'act2', 'act3', 'act4', 'exp3', 'exp4']);
    expect(deleted(c).params[0]).toEqual(['act1', 'act2', 'act3', 'act4', 'exp3', 'exp4']);
    for (const blocked of ['exp1', 'exp2', 'exp5', 'sold1']) expect(deleted(c).params[0]).not.toContain(blocked);
  });
});

describe('apply mechanics', () => {
  test('backs up first, then deletes exactly those ids inside one transaction; ids AND marker, never one alone', async () => {
    const c = fakeClient();
    const order = [];
    const writeBackup = jest.fn((payload) => { order.push('backup'); expect(payload.listings).toHaveLength(4); return 'backups/x.json'; });
    const inner = c.query.getMockImplementation();
    c.query.mockImplementation(async (sql, params) => { if (/^(BEGIN|DELETE|COMMIT)/.test(sql)) order.push(sql.split(' ')[0]); return inner(sql, params); });
    const r = await run({ client: c, apply: true, writeBackup });
    expect(order).toEqual(['backup', 'BEGIN', 'DELETE', 'COMMIT']);
    expect(r).toMatchObject({ removed: 4, dryRun: false, backupPath: 'backups/x.json' });
    expect(deleted(c).params).toEqual([['a1', 'a2', 'a3', 'a4'], `%${TAG}%`]);
    expect(deleted(c).sql).toMatch(/id = ANY\(\$1\) AND description LIKE \$2/);
    expect(deleted(c).sql).not.toContain(TAG);
  });

  test('apply without a way to save a backup is refused before anything is written', async () => {
    const c = fakeClient();
    await expect(run({ client: c, apply: true })).rejects.toThrow(/writeBackup/);
    expect(wrote(c)).toBe(false);
  });

  test('a delete that touches a different number of rows is rolled back', async () => {
    const c = fakeClient({ deleteCount: 5 });
    await expect(run({ client: c, apply: true, writeBackup: () => 'b.json' })).rejects.toThrow(/5 righe invece di 4/);
    expect(c.calls.some((x) => x.sql === 'ROLLBACK')).toBe(true);
    expect(c.calls.some((x) => x.sql === 'COMMIT')).toBe(false);
  });

  test('a database error during the delete is rolled back and rethrown', async () => {
    const c = fakeClient();
    const inner = c.query.getMockImplementation();
    c.query.mockImplementation(async (sql, params) => { if (/^DELETE/.test(sql)) throw new Error('violates foreign key'); return inner(sql, params); });
    await expect(run({ client: c, apply: true, writeBackup: () => 'b.json' })).rejects.toThrow('violates foreign key');
    expect(c.calls.some((x) => x.sql === 'ROLLBACK')).toBe(true);
    expect(c.calls.some((x) => x.sql === 'COMMIT')).toBe(false);
  });

  test('foreign keys are discovered from the catalog and identifiers are quoted', async () => {
    const c = fakeClient({ refs: [{ table_name: '"Odd Table"', column_name: 'weird"col', on_delete: 'r' }] });
    await run({ client: c });
    const count = c.calls.find((x) => /AS listing_id, count/.test(x.sql));
    expect(count.sql).toContain('FROM "Odd Table" WHERE "weird""col" = ANY($1) GROUP BY "weird""col"');
  });
});

describe('inspect (read-only look at what is attached)', () => {
  const rows = [demo('e1', { title: 'Asta Rivendell', status: 'expired' }), demo('s1', { title: 'Ferrari', status: 'sold' })];
  const dependentRows = {
    featured_purchases: [
      { listing_id: 'e1', user_id: 'u1', method: 'card', tariff: 'week', days: 7, amount_cents: 500, payment_ref: 'pi_3Abcdefghijklmnop', created_at: '2026-08-20T10:00:00Z' },
      { listing_id: 's1', user_id: 'u2', method: 'admin', tariff: 'week', days: 7, amount_cents: null, amount_credits: null, payment_ref: null, created_at: '2026-08-21T10:00:00Z' },
    ],
    cart_items: [{ listing_id: 'e1', user_id: 'u1', created_at: '2026-08-22T10:00:00Z' }],
  };
  const users = [{ id: 'u1', username: 'mario', role: 'user' }, { id: 'u2', username: 'admin', role: 'admin' }];

  test('runs inside a READ ONLY transaction that is rolled back, and never writes', async () => {
    const c = fakeClient({ rows, dependentRows, users });
    await inspect({ client: c });
    expect(c.calls[0].sql).toBe('BEGIN READ ONLY');
    expect(c.calls[c.calls.length - 1].sql).toBe('ROLLBACK');
    expect(c.calls.some((x) => /^(INSERT|UPDATE|DELETE|COMMIT)/.test(x.sql))).toBe(false);
  });

  test('says which purchases are real card money, which are credits and which are admin grants', async () => {
    const log = jest.fn();
    const r = await inspect({ client: fakeClient({ rows, dependentRows, users }), log });
    const out = text(log);
    expect(out).toContain('featured_purchases (2)');
    expect(out).toMatch(/Asta Rivendell \[expired\]/);
    expect(out).toContain('da: mario [user]');
    expect(out).toContain('5.00 € (500 cent)');
    expect(out).toContain('PAGAMENTO CON CARTA (Stripe): denaro reale');
    expect(out).toContain('assegnato da admin (nessun pagamento)');
    expect(out).toContain('cart_items (1)');
    expect(r.purchases.map((p) => p.kind)).toEqual(['PAGAMENTO CON CARTA (Stripe): denaro reale', 'assegnato da admin (nessun pagamento)']);
    expect(out).not.toContain('pi_3Abcdefghijklmnop'); // the reference is shortened, not dumped in full
  });

  test('classification from the purchase itself', () => {
    expect(classifyPurchase({ method: 'card' })).toMatch(/denaro reale/);
    expect(classifyPurchase({ method: 'wallet', payment_ref: 'wallet_tx_1' })).toMatch(/crediti/);
    expect(classifyPurchase({ method: 'x', payment_ref: 'pi_123' })).toMatch(/denaro reale/); // a Stripe reference wins over the label
    expect(classifyPurchase({ method: 'strano' })).toMatch(/da verificare/);
  });

  test('no demo listings: reports it and still rolls back', async () => {
    const c = fakeClient({ rows: [] });
    const log = jest.fn();
    await inspect({ client: c, log });
    expect(text(log)).toContain('Nessun annuncio demo trovato');
    expect(c.calls[c.calls.length - 1].sql).toBe('ROLLBACK');
  });
});

describe('entry scripts and repo hygiene', () => {
  const root = path.join(__dirname, '..');
  test('the removal script parses its flags and keeps dry-run as the default', () => {
    const src = fs.readFileSync(path.join(root, 'scripts', 'remove-demo-listings.js'), 'utf8');
    expect(src).toContain("process.argv.includes('--apply')");
    expect(src).toContain("process.argv.includes('--skip-with-dependents')");
    expect(src).toMatch(/arg\('expect', 4\)/);
    expect(src).toMatch(/arg\('allow-dependents'/);
    expect(src).toContain("'backups'");
    expect(src).toContain("require('../src/db')"); // so src/db's guard applies: it only connects through run-db-script.js
  });

  test('the inspect script goes through src/db too (so the wrapper guard applies)', () => {
    const src = fs.readFileSync(path.join(root, 'scripts', 'inspect-demo-listing-dependents.js'), 'utf8');
    expect(src).toContain("require('../src/db')");
    expect(src).not.toMatch(/INSERT|UPDATE|DELETE/);
  });

  test('backups/ (copies of production rows) can never be committed', () => {
    expect(fs.readFileSync(path.join(root, '.gitignore'), 'utf8')).toMatch(/^backups\/?\s*$/m);
  });
});
