// Every table in the public schema must have Row Level Security enabled: without it,
// Supabase's REST API exposes the table to anyone holding the public anon key.
// The backend itself is unaffected (it connects as `postgres`, owner + BYPASSRLS).
// Catches new tables created without RLS — see src/db/migrate_enable_rls_remaining.js.
//
// Runs against the REAL (confirmed test/dev) database configured in .env.test.
const db = require('./helpers/db');

afterAll(async () => {
  await db.end();
});

test('RLS is enabled on every public table', async () => {
  const r = await db.query(
    `SELECT c.relname
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      ORDER BY c.relname`
  );
  expect(r.rows.map((row) => row.relname)).toEqual([]);
});

test('the backend role can still bypass RLS (otherwise enabling it would break the app)', async () => {
  const r = await db.query('SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user');
  expect(r.rows[0].rolbypassrls).toBe(true);
});
