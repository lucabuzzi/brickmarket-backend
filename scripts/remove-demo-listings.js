// Removes the demo listings ("__DEMO_SEED__" in the description) that scripts/seed-dummy-data.js left on
// the live site. It touches PRODUCTION data, so like every DB script here it only runs through the wrapper,
// which asks you to type PRODUCTION in a real terminal:
//
//   0) look at what is attached to them first (read-only):
//      node scripts/run-db-script.js scripts/inspect-demo-listing-dependents.js --target=production
//   1) dry run of the removal (changes nothing):
//      node scripts/run-db-script.js scripts/remove-demo-listings.js --target=production [flags]
//   2) for real (writes a JSON copy of every deleted row to backups/ first):
//      node scripts/run-db-script.js scripts/remove-demo-listings.js --target=production [flags] --apply
//
// Flags:
//   --expect=N                   how many listings you expect to remove (default 4); it stops on any other number
//   --skip-with-dependents       leave alone the demo listings that have rows attached (orders, carts, featured
//                                purchases...) and remove only the others
//   --allow-dependents=a,b       accept that the rows of these tables (must be ON DELETE CASCADE) are deleted
//                                together with their listing
// By default a listing with anything attached is BLOCKED and nothing is changed.
// It does not touch users or anything else: see scripts/lib/removeDemoListings.js for the checks.
const fs = require('fs');
const path = require('path');
const { getClient } = require('../src/db');
const { run } = require('./lib/removeDemoListings');

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

function writeBackup(payload) {
  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `demo-listings-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), note: 'rows deleted by remove-demo-listings.js (listings + dependents cascaded with them)', ...payload }, null, 2));
  return file;
}

(async () => {
  const client = await getClient();
  let code = 0;
  try {
    await run({
      client,
      apply: process.argv.includes('--apply'),
      expect: Number(arg('expect', 4)),
      skipWithDependents: process.argv.includes('--skip-with-dependents'),
      allowDependents: arg('allow-dependents', '').split(',').map((s) => s.trim()).filter(Boolean),
      writeBackup,
      log: (m) => console.log(m),
    });
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    code = 1;
  } finally {
    client.release();
    process.exit(code); // the pool would otherwise keep the process alive for a while
  }
})();
