// Spawns the REAL server.js as a child process on a scratch port, against the
// same DB configured in .env (confirmed test data — see conversation), and
// waits for /api/health before handing control back. Integration-style on
// purpose: these tests assert on real HTTP responses from the real Express
// app + real middleware chain, not on mocked req/res objects.
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const { assertNotProduction } = require('./guardAgainstProduction');

// Fails fast on require, before any test in a file that needs a live server
// even starts running — see guardAgainstProduction.js for why this exists.
// loadTestEnv.js (required transitively by the guard) has already populated
// process.env from .env.test by this point, so the spawn() below — which
// inherits ...process.env — passes the same, already-checked DATABASE_URL
// through to the child server.js process rather than letting its own
// require('dotenv').config() pick up .env instead.
assertNotProduction();

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl, timeoutMs = 20000) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not become healthy within ${timeoutMs}ms: ${lastErr?.message}`);
}

// extraEnv lets a test override NODE_ENV etc. for that one server instance.
async function startServer(extraEnv = {}) {
  const port = await getFreePort();
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  proc.stdout.on('data', (d) => { stdout += d.toString(); });
  proc.stderr.on('data', (d) => { stderr += d.toString(); });

  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForHealth(baseUrl);
  } catch (err) {
    proc.kill();
    throw new Error(`${err.message}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`);
  }

  return {
    baseUrl,
    proc,
    getLogs: () => ({ stdout, stderr }),
    stop: () => new Promise((resolve) => {
      proc.once('exit', resolve);
      proc.kill();
    }),
  };
}

module.exports = { startServer, getFreePort, REPO_ROOT };
