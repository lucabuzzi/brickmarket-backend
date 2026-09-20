#!/usr/bin/env node
/**
 * The only sanctioned way to run a migration or seed script (src/db/migrate_*.js,
 * src/db/seed_*.js, scripts/seed-dummy-data.js) — see CLAUDE.md.
 *
 * Usage:
 *   node scripts/run-db-script.js <path-to-script> --target=test
 *   node scripts/run-db-script.js <path-to-script> --target=production
 *
 * --target is required, with no default — the whole point of this wrapper is
 * that nobody can run a DB script without first saying, explicitly, which
 * database they mean to hit.
 *
 *   --target=test        loads ONLY .env.test (never .env). Also requires the
 *                         resulting DATABASE_URL's host to be listed in
 *                         tests/config/allowedTestHosts.js — the same allowlist
 *                         the Jest suite's guard uses, so there is exactly one
 *                         place that says "this is a real test database", not two
 *                         that can drift apart. That file starts out empty (no
 *                         test database exists yet), so --target=test refuses
 *                         until one is provisioned and added there.
 *
 *   --target=production  loads .env. Prints ONLY the target host (never the
 *                         username or password) and requires an interactive
 *                         typed confirmation. Refuses outright — before even
 *                         prompting — if stdin is not a real TTY (a script, CI
 *                         job, or piped input can never get past this).
 *
 * Either way, the wrapper sets DB_TARGET_CONFIRMED=1 before requiring the
 * target script, which is what src/db/index.js checks for before it will open
 * a connection pool at all (see that file).
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const readline = require('readline');

const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = argv.slice(2);
  const targetFlag = args.find((a) => a.startsWith('--target='));
  const scriptArg = args.find((a) => !a.startsWith('--'));
  const target = targetFlag ? targetFlag.slice('--target='.length) : null;
  return { scriptArg, target };
}

function usageAndExit(message) {
  if (message) console.error(`❌ ${message}\n`);
  console.error(
    'Usage:\n' +
    '  node scripts/run-db-script.js <path-to-script> --target=test\n' +
    '  node scripts/run-db-script.js <path-to-script> --target=production\n'
  );
  process.exit(1);
}

function maskedHost(databaseUrl) {
  try {
    return new URL(databaseUrl).hostname;
  } catch (err) {
    return '(could not parse DATABASE_URL as a URL)';
  }
}

function ask(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function runAgainstTest(scriptPath) {
  const envTestPath = path.join(REPO_ROOT, '.env.test');
  if (!fs.existsSync(envTestPath)) {
    usageAndExit(`.env.test does not exist at ${envTestPath}. Create it first (see .env.test.example) — this wrapper never falls back to .env.`);
  }

  const result = dotenv.config({ path: envTestPath });
  if (result.error) {
    usageAndExit(`Failed to load .env.test: ${result.error.message}`);
  }

  if (!process.env.DATABASE_URL) {
    usageAndExit('.env.test was loaded but does not define DATABASE_URL.');
  }

  const host = maskedHost(process.env.DATABASE_URL);
  const allowedHosts = require('../tests/config/allowedTestHosts');
  if (!allowedHosts.includes(host)) {
    usageAndExit(
      `"${host}" (from .env.test) is not in tests/config/allowedTestHosts.js. ` +
      'This wrapper uses the same allowlist as the Jest test suite\'s guard, so ' +
      'there is one single source of truth for "this is a real test database". ' +
      'Add the host there once it is a genuine, separate test database.'
    );
  }

  console.log(`Target: ${host} (test)`);
  process.env.DB_TARGET_CONFIRMED = '1';
  require(path.resolve(scriptPath));
}

async function runAgainstProduction(scriptPath, originalScriptArg) {
  const result = dotenv.config({ path: path.join(REPO_ROOT, '.env') });
  if (result.error) {
    usageAndExit(`Failed to load .env: ${result.error.message}`);
  }
  if (!process.env.DATABASE_URL) {
    usageAndExit('.env was loaded but does not define DATABASE_URL.');
  }

  const host = maskedHost(process.env.DATABASE_URL);
  console.log(`Target: ${host} (PRODUCTION) — credentials are never printed by this wrapper.`);

  if (!process.stdin.isTTY) {
    usageAndExit(
      'Refusing to run against production: stdin is not an interactive TTY. ' +
      'This wrapper cannot be scripted, piped, or run from CI against production by design — ' +
      'run it by hand, in a real terminal, and type the confirmation yourself.'
    );
  }

  const answer = await ask(`Type PRODUCTION (all caps, exactly) to run "${originalScriptArg}" against ${host}: `);
  if (answer !== 'PRODUCTION') {
    console.error('❌ Confirmation did not match "PRODUCTION" exactly. Aborting — nothing was run.');
    process.exit(1);
  }

  process.env.DB_TARGET_CONFIRMED = '1';
  require(path.resolve(scriptPath));
}

async function main() {
  const { scriptArg, target } = parseArgs(process.argv);

  if (!scriptArg) {
    usageAndExit('Missing <path-to-script> argument.');
  }
  if (!fs.existsSync(path.resolve(scriptArg))) {
    usageAndExit(`Script not found: ${scriptArg}`);
  }
  if (target !== 'test' && target !== 'production') {
    usageAndExit(`--target must be exactly "test" or "production" (got: ${JSON.stringify(target)}). No default — say which one you mean.`);
  }

  if (target === 'test') {
    await runAgainstTest(scriptArg);
  } else {
    await runAgainstProduction(scriptArg, scriptArg);
  }
}

main().catch((err) => {
  console.error('❌ run-db-script.js failed:', err.message);
  process.exit(1);
});
