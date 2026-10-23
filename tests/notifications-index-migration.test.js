// src/db/migrate_notifications_user_index.js against a fake database: builds the index without blocking writes,
// rebuilds one left invalid, refuses to report success when the index isn't usable, and goes back with --down.
// The queries it covers must be able to use the index: checked on the route's own SQL.
const fs = require('fs');
const path = require('path');

const INDEX = 'idx_notifications_user_created';

/** Runs the migration with a fake DB whose index is `state` before the build. */
async function run(argv, { before = 'missing', after = 'valid' } = {}) {
  jest.resetModules();
  const calls = [];
  let built = false;
  jest.doMock('../src/db', () => ({
    query: jest.fn(async (sql) => {
      const q = sql.replace(/\s+/g, ' ').trim();
      calls.push(q);
      if (/FROM pg_class/.test(q)) {
        const state = built ? after : before;
        return { rows: state === 'missing' ? [] : [{ valid: state === 'valid' }] };
      }
      if (/^CREATE INDEX/.test(q)) built = true;
      return { rows: [], rowCount: 0 };
    }),
  }));
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  const saved = process.argv;
  process.argv = ['node', 'x', ...argv];
  require('../src/db/migrate_notifications_user_index');
  await new Promise((r) => setTimeout(r, 20));
  process.argv = saved;
  const code = exit.mock.calls[0]?.[0];
  const errors = err.mock.calls.map((c) => c.join(' '));
  exit.mockRestore();
  log.mockRestore();
  err.mockRestore();
  return { calls, code, errors, ddl: calls.filter((q) => /^(CREATE|DROP) INDEX/.test(q)) };
}

afterEach(() => jest.dontMock('../src/db'));

test('up: one index on (user_id, created_at DESC), built CONCURRENTLY, idempotent', async () => {
  const { code, ddl } = await run([]);
  expect(code).toBe(0);
  expect(ddl).toEqual([`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${INDEX} ON public.notifications (user_id, created_at DESC);`]);
});

test('up never touches data and never runs in a transaction (CONCURRENTLY would fail inside one)', async () => {
  const { calls } = await run([]);
  for (const q of calls) expect(q).not.toMatch(/^(INSERT|UPDATE|DELETE|TRUNCATE|BEGIN|ALTER TABLE)/i);
});

test('up: an index left invalid by an interrupted build is dropped and rebuilt', async () => {
  const { code, ddl } = await run([], { before: 'invalid' });
  expect(code).toBe(0);
  expect(ddl).toEqual([
    `DROP INDEX CONCURRENTLY IF EXISTS public.${INDEX};`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${INDEX} ON public.notifications (user_id, created_at DESC);`,
  ]);
});

test('up: an index still invalid after the build is a failure (exit 1), not a success', async () => {
  const { code, errors } = await run([], { after: 'invalid' });
  expect(code).toBe(1);
  expect(errors.join(' ')).toMatch(/is invalid after the build/);
});

test('down: drops only this index, CONCURRENTLY', async () => {
  const { code, ddl } = await run(['--down']);
  expect(code).toBe(0);
  expect(ddl).toEqual([`DROP INDEX CONCURRENTLY IF EXISTS public.${INDEX};`]);
});

test("the notification routes filter on user_id first (the index's leading column)", () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/routes/notifications.js'), 'utf8');
  expect(src).toMatch(/FROM notifications WHERE user_id = \$1 AND is_read = FALSE/);
  expect(src).toMatch(/WHERE n\.user_id = \$1\s+ORDER BY n\.created_at DESC/);
  expect(src).toMatch(/UPDATE notifications SET is_read = TRUE WHERE user_id = \$1/);
});
