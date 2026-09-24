// Removes the demo listings ("__DEMO_SEED__" in the description) that scripts/seed-dummy-data.js left on
// the live site. It touches PRODUCTION data, so like every DB script here it only runs through the wrapper,
// which asks you to type PRODUCTION in a real terminal:
//
//   1) look first (changes nothing):
//      node scripts/run-db-script.js scripts/remove-demo-listings.js --target=production
//   2) then remove for real (writes a JSON copy to backups/ first):
//      node scripts/run-db-script.js scripts/remove-demo-listings.js --target=production --apply
//
//   --expect=N   how many demo listings you expect (default 4); it stops if it finds a different number.
//
// It does not touch users, orders or anything else: see scripts/lib/removeDemoListings.js for the checks.
const fs = require('fs');
const path = require('path');
const { getClient } = require('../src/db');
const { run } = require('./lib/removeDemoListings');

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

function writeBackup(rows) {
  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `demo-listings-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), note: 'rows deleted from listings by remove-demo-listings.js', rows }, null, 2));
  return file;
}

(async () => {
  const client = await getClient();
  let code = 0;
  try {
    await run({ client, apply: process.argv.includes('--apply'), expect: Number(arg('expect', 4)), writeBackup, log: (m) => console.log(m) });
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    code = 1;
  } finally {
    client.release();
    process.exit(code); // the pool would otherwise keep the process alive for a while
  }
})();
