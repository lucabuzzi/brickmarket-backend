// src/db/clutchvault-db.js must refuse to start with the in-memory mock wallet
// when NODE_ENV=production and no DB is configured — it should exit(1) loudly
// instead of silently running with balances that live only in RAM.
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO_ROOT, 'src', 'db', 'clutchvault-db.js');

// Run from a directory with no .env file, so dotenv.config() inside the module
// can't silently pick up the real DATABASE_URL from the repo's .env and
// invalidate the "no DB configured" scenario this test is checking.
const NO_ENV_CWD = os.tmpdir();

function run(extraEnv) {
  // Start from the real process env (so Windows has SystemRoot/TEMP/etc. and node
  // resolves correctly) but strip anything that would configure a DB connection —
  // that's the exact condition this test needs, "no DB configured".
  const cleanEnv = { ...process.env };
  delete cleanEnv.DATABASE_URL;
  delete cleanEnv.SUPABASE_DB_URL;
  delete cleanEnv.SUPABASE_URL;
  delete cleanEnv.SUPABASE_SERVICE_KEY;
  cleanEnv.NODE_PATH = path.join(REPO_ROOT, 'node_modules');

  return new Promise((resolve) => {
    const proc = spawn(process.execPath, ['-e', `require(${JSON.stringify(MODULE_PATH)});`], {
      cwd: NO_ENV_CWD,
      env: { ...cleanEnv, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('exit', (code) => resolve({ code, stdout, stderr }));

    // Safety net: if it neither exits nor errors within 5s, treat it as "did not exit".
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill();
    }, 5000);
  });
}

test('NODE_ENV=production + no DATABASE_URL -> process exits(1) with an explicit error', async () => {
  const { code, stderr } = await run({ NODE_ENV: 'production' });
  expect(code).toBe(1);
  expect(stderr).toMatch(/ClutchVault DB unavailable in production/);
}, 10000);

test('NODE_ENV=development + no DATABASE_URL -> falls back to the in-memory mock (clean exit, not code 1)', async () => {
  const { code, stderr } = await run({ NODE_ENV: 'development' });
  // The module never calls process.exit here — it just seeds the in-memory mock and
  // returns, so the script naturally runs to completion with exit code 0 (nothing
  // keeps the event loop alive, unlike the real server which stays up via app.listen()).
  // console.warn (Node) writes to stderr, hence checking stderr here, not stdout.
  expect(code).toBe(0);
  expect(stderr).toMatch(/Mock\/In-Memory database fallback/);
}, 10000);
