// Hostnames of database servers that are safe for automated tests to connect
// to. tests/helpers/guardAgainstProduction.js refuses to let any test run
// unless DATABASE_URL's host is in this list.
//
// Deliberately empty: no separate test database exists yet in this project —
// the only Postgres instance configured today (.env's DATABASE_URL) is the
// same one the cardbrix.com production service on Render uses. A previous
// test run connected to it directly because nothing checked; see the
// conversation this file came out of, and the residual-cleanup notes there.
//
// Add a host here ONLY once it points at a genuinely separate database
// (see the "DB DI TEST" setup steps) — never the production connection
// string, and never as a way to quiet this guard without actually fixing
// the underlying database. There is no bypass/opt-in flag by design: an
// empty array here means tests do not run, period.
module.exports = [];
