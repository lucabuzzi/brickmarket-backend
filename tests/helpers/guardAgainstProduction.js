// Refuses to let tests run against any database whose host isn't explicitly
// allowlisted as a test database (tests/config/allowedTestHosts.js).
//
// This guard did not exist the first time this test suite ran, and it
// connected straight to the real production database — same DATABASE_URL as
// the cardbrix.com Render deploy, confirmed by comparing hostnames byte for
// byte. tests/helpers/db.js and tests/helpers/testServer.js both call
// assertNotProduction() before doing anything else (opening a pool, spawning
// the server).
//
// No bypass/opt-in flag exists by design: an empty allowlist means tests
// never run, full stop — see tests/config/allowedTestHosts.js.
require('./loadTestEnv');

function assertNotProduction(
  databaseUrl = process.env.DATABASE_URL,
  allowedHosts = require('../config/allowedTestHosts')
) {
  if (!databaseUrl) {
    throw new Error(
      'guardAgainstProduction: DATABASE_URL is not set after loading .env.test. ' +
      "Tests never fall back to .env (the production connection string). Create " +
      ".env.test with a real test database's DATABASE_URL first — see " +
      'tests/config/allowedTestHosts.js and the test-database setup steps.'
    );
  }

  let host;
  try {
    host = new URL(databaseUrl).hostname;
  } catch (err) {
    throw new Error(`guardAgainstProduction: DATABASE_URL is not a valid URL (${err.message}).`);
  }

  if (allowedHosts.length === 0) {
    throw new Error(
      'guardAgainstProduction: tests/config/allowedTestHosts.js is empty — no database is ' +
      `trusted as a test database yet. Refusing to run tests against "${host}" (or any host) ` +
      'until a real, separate test database is provisioned and its hostname is added there. ' +
      'There is no bypass flag by design.'
    );
  }

  if (!allowedHosts.includes(host)) {
    throw new Error(
      `guardAgainstProduction: "${host}" is not in tests/config/allowedTestHosts.js. Refusing ` +
      'to run tests against a database that is not explicitly allowlisted as a test database ' +
      '— this is very likely production.'
    );
  }
}

module.exports = { assertNotProduction };
