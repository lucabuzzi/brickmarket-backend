#!/usr/bin/env node
// Refreshes src/config/sitemapLastmod.json: pages whose text changed since the last run get today's date.
//   node scripts/update-sitemap-lastmod.js          # rewrite the file
//   node scripts/update-sitemap-lastmod.js --check  # only report (exit 1 when the file is out of date)
// Read-only toward the database: nothing here connects to it.
const fs = require('fs');
const path = require('path');
const { STATIC_PATHS } = require('../src/services/sitemapPaths');
const { refreshStored } = require('../src/services/sitemapLastmod');

const FILE = path.join(__dirname, '..', 'src', 'config', 'sitemapLastmod.json');
const today = new Date().toISOString().slice(0, 10);
const current = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const next = refreshStored(STATIC_PATHS, today, current);
const changed = STATIC_PATHS.filter((p) => !current[p] || current[p].hash !== next[p].hash);
const stale = Object.keys(current).filter((p) => !STATIC_PATHS.includes(p));

if (process.argv.includes('--check')) {
  if (changed.length || stale.length) {
    console.error(`sitemapLastmod.json out of date: ${[...changed, ...stale].join(', ')}\nRun: npm run sitemap:lastmod`);
    process.exit(1);
  }
  console.log('sitemapLastmod.json up to date');
} else {
  fs.writeFileSync(FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(changed.length ? `updated ${changed.length} page(s): ${changed.join(', ')}` : 'nothing changed');
  if (stale.length) console.log(`removed: ${stale.join(', ')}`);
}
