// Unit tests for the guard itself — no DB connection, no spawned server.
// allowedHosts is passed explicitly to keep this deterministic and
// independent of whatever tests/config/allowedTestHosts.js currently
// contains (which is expected to stay empty until a real test DB exists).
const { assertNotProduction } = require('./helpers/guardAgainstProduction');

const PRODUCTION_DATABASE_URL =
  'postgresql://postgres.nrfyvnkoixmotmjdpnss:REDACTED@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const HYPOTHETICAL_TEST_DATABASE_URL = 'postgresql://postgres:pw@db.some-test-project.supabase.co:5432/postgres';

test('empty allowlist -> refuses any DATABASE_URL, including production', () => {
  expect(() => assertNotProduction(PRODUCTION_DATABASE_URL, [])).toThrow(/allowedTestHosts\.js is empty/);
});

test('empty allowlist -> refuses a hypothetical test DATABASE_URL too (no bypass)', () => {
  expect(() => assertNotProduction(HYPOTHETICAL_TEST_DATABASE_URL, [])).toThrow(/allowedTestHosts\.js is empty/);
});

test('non-empty allowlist that does not contain the host -> still refuses production', () => {
  expect(() => assertNotProduction(PRODUCTION_DATABASE_URL, ['db.some-test-project.supabase.co']))
    .toThrow(/is not in tests\/config\/allowedTestHosts\.js/);
});

test('non-empty allowlist that contains the host -> does not throw', () => {
  expect(() => assertNotProduction(HYPOTHETICAL_TEST_DATABASE_URL, ['db.some-test-project.supabase.co']))
    .not.toThrow();
});

test('no DATABASE_URL at all -> refuses with an explicit "not set" error, never silently proceeds', () => {
  expect(() => assertNotProduction(undefined, ['db.some-test-project.supabase.co']))
    .toThrow(/DATABASE_URL is not set/);
});

test('malformed DATABASE_URL -> refuses instead of throwing an unrelated error', () => {
  expect(() => assertNotProduction('not-a-valid-url', ['some-host']))
    .toThrow(/is not a valid URL/);
});

test('the real, committed tests/config/allowedTestHosts.js refuses production too', () => {
  // Exercises the actual file, not an injected list — this is what
  // tests/helpers/db.js and testServer.js rely on by default.
  expect(() => assertNotProduction(PRODUCTION_DATABASE_URL)).toThrow(/allowedTestHosts\.js is empty/);
});
