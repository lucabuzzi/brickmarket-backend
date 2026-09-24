// READ-ONLY. Shows what is attached to the demo listings ("__DEMO_SEED__"): featured-listing purchases (and
// whether real card money is behind them), carts, watchlists... so you can decide before removing anything.
// It runs inside a READ ONLY database transaction: it cannot change data. Like every DB script here it goes
// through the wrapper, which asks you to type PRODUCTION in a real terminal:
//
//   node scripts/run-db-script.js scripts/inspect-demo-listing-dependents.js --target=production
const { getClient } = require('../src/db');
const { inspect } = require('./lib/inspectDemoDependents');

(async () => {
  const client = await getClient();
  let code = 0;
  try {
    await inspect({ client, log: (m) => console.log(m) });
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    code = 1;
  } finally {
    client.release();
    process.exit(code);
  }
})();
