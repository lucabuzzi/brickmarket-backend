// scripts/lib/removeDemoListings.js: the safety rails around deleting the demo listings from production.
// Uses a fake pg client, so nothing here can reach a database.
const fs = require('fs');
const path = require('path');
const { run, TAG } = require('../scripts/lib/removeDemoListings');

const demo = (i) => ({ id: `d-${i}`, title: `Demo ${i}`, status: 'active', type: 'used', description: `Testo. ${TAG}`, created_at: '2026-09-01T10:00:00Z' });
const FOUR = [1, 2, 3, 4].map(demo);

/** A fake client that answers by looking at the SQL; records every call. */
function fakeClient({ rows = FOUR, refs, counts = {}, deleteCount } = {}) {
  const calls = [];
  const references = refs || [
    { table_name: 'orders', column_name: 'listing_id', on_delete: 'a' },
    { table_name: 'bids', column_name: 'listing_id', on_delete: 'c' },
    { table_name: 'favorites', column_name: 'listing_id', on_delete: 'c' },
  ];
  return {
    calls,
    query: jest.fn(async (sql, params) => {
      calls.push({ sql, params });
      if (/^SELECT \* FROM listings/.test(sql)) return { rows };
      if (/FROM pg_constraint/.test(sql)) return { rows: references };
      const count = sql.match(/SELECT count\(\*\)::int AS n FROM (\S+)/);
      if (count) return { rows: [{ n: counts[count[1]] || 0 }] };
      if (/^DELETE FROM listings/.test(sql)) return { rowCount: deleteCount ?? params[0].length, rows: params[0].map((id) => ({ id })) };
      return { rows: [], rowCount: 0 }; // BEGIN / COMMIT / ROLLBACK
    }),
  };
}
const sqls = (c) => c.calls.map((x) => x.sql.split('\n')[0].trim().slice(0, 30));
const wrote = (c) => c.calls.some((x) => /^(BEGIN|DELETE|COMMIT)/.test(x.sql));

describe('dry run (the default)', () => {
  test('reports what it found and what depends on it, and changes nothing', async () => {
    const c = fakeClient();
    const log = jest.fn();
    const r = await run({ client: c, log });
    expect(r).toMatchObject({ found: 4, removed: 0, dryRun: true, ids: ['d-1', 'd-2', 'd-3', 'd-4'] });
    expect(wrote(c)).toBe(false);
    const out = log.mock.calls.map((x) => x[0]).join('\n');
    expect(out).toContain('Annunci demo trovati (4)');
    expect(out).toContain('d-1');
    expect(out).toMatch(/orders\.listing_id \(NO ACTION\): 0/);
    expect(out).toMatch(/bids\.listing_id \(CASCADE\): 0/);
    expect(out).toMatch(/DRY RUN.*--apply/);
  });

  test('does not even need a backup writer', async () => {
    await expect(run({ client: fakeClient() })).resolves.toMatchObject({ dryRun: true });
  });

  test('the marker travels as a bound parameter, never inside the SQL text', async () => {
    const c = fakeClient();
    await run({ client: c });
    const select = c.calls.find((x) => /^SELECT \* FROM listings/.test(x.sql));
    expect(select.sql).not.toContain(TAG);
    expect(select.params).toEqual([`%${TAG}%`]);
  });
});

describe('it refuses to act when the picture is not what was expected', () => {
  test('a different number of demo listings (in either direction) stops it, even with apply', async () => {
    for (const rows of [FOUR.slice(0, 3), [...FOUR, demo(5)]]) {
      const c = fakeClient({ rows });
      await expect(run({ client: c, apply: true, writeBackup: jest.fn() })).rejects.toThrow(/Trovati \d annunci demo, ne erano attesi 4/);
      expect(wrote(c)).toBe(false);
    }
  });

  test('--expect lets a person confirm a different count after looking at the dry run', async () => {
    const c = fakeClient({ rows: [...FOUR, demo(5)] });
    await expect(run({ client: c, expect: 5 })).resolves.toMatchObject({ found: 5, dryRun: true });
  });

  test('anything referencing the listings blocks it, cascading tables included', async () => {
    for (const counts of [{ orders: 1 }, { bids: 2 }, { favorites: 3 }]) {
      const c = fakeClient({ counts });
      const key = Object.keys(counts)[0];
      await expect(run({ client: c, apply: true, writeBackup: jest.fn() })).rejects.toThrow(new RegExp(`${key}: ${counts[key]}`));
      expect(wrote(c)).toBe(false);
    }
  });

  test('no demo listings at all: a clean no-op', async () => {
    const c = fakeClient({ rows: [] });
    expect(await run({ client: c, apply: true, writeBackup: jest.fn() })).toMatchObject({ found: 0, removed: 0 });
    expect(wrote(c)).toBe(false);
  });

  test('apply without a way to save a backup is refused before anything is written', async () => {
    const c = fakeClient();
    await expect(run({ client: c, apply: true })).rejects.toThrow(/writeBackup/);
    expect(wrote(c)).toBe(false);
  });
});

describe('apply', () => {
  test('backs up first, then deletes exactly those ids inside one transaction', async () => {
    const c = fakeClient();
    const order = [];
    const writeBackup = jest.fn((rows) => { order.push('backup'); expect(rows).toHaveLength(4); return 'backups/x.json'; });
    c.query.mockImplementation(((orig) => async (sql, params) => { if (/^(BEGIN|DELETE|COMMIT)/.test(sql)) order.push(sql.split(' ')[0]); return orig(sql, params); })(c.query.getMockImplementation()));

    const r = await run({ client: c, apply: true, writeBackup });
    expect(order).toEqual(['backup', 'BEGIN', 'DELETE', 'COMMIT']);
    expect(r).toMatchObject({ removed: 4, dryRun: false, backupPath: 'backups/x.json' });
    const del = c.calls.find((x) => /^DELETE FROM listings/.test(x.sql));
    expect(del.params).toEqual([['d-1', 'd-2', 'd-3', 'd-4'], `%${TAG}%`]);
    expect(del.sql).toMatch(/id = ANY\(\$1\) AND description LIKE \$2/); // ids AND marker, never one alone
    expect(del.sql).not.toContain(TAG);
  });

  test('if the delete touches a different number of rows, everything is rolled back and it fails', async () => {
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
});

describe('foreign keys are discovered from the catalog', () => {
  test('every table found is counted, with quoted identifiers', async () => {
    const c = fakeClient({ refs: [{ table_name: '"Odd Table"', column_name: 'weird"col', on_delete: 'r' }] });
    await run({ client: c });
    const count = c.calls.find((x) => /SELECT count/.test(x.sql));
    expect(count.sql).toContain('FROM "Odd Table" WHERE "weird""col" = ANY($1)');
  });
});

describe('the entry script and repo hygiene', () => {
  const root = path.join(__dirname, '..');
  test('the script is a thin wrapper: dry run unless --apply, default expect 4, backup under backups/', () => {
    const src = fs.readFileSync(path.join(root, 'scripts', 'remove-demo-listings.js'), 'utf8');
    expect(src).toContain("process.argv.includes('--apply')");
    expect(src).toMatch(/arg\('expect', 4\)/);
    expect(src).toContain("'backups'");
    expect(src).toContain("require('../src/db')"); // so src/db's guard applies: it only connects through run-db-script.js
  });

  test('backups/ (copies of production rows) can never be committed', () => {
    expect(fs.readFileSync(path.join(root, '.gitignore'), 'utf8')).toMatch(/^backups\/?\s*$/m);
  });
});
