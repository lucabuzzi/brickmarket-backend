// Covers POST /api/auth/verify-email (src/services/authService.js#verifyEmail +
// src/repositories/userRepository.js#verifyEmailByToken): invalid/expired token
// rejection, the happy path crediting the signup_bonus exactly once (real wallet +
// ledger row, not just the HTTP response), and that reusing the same token a second
// time is a no-op rather than a double credit.
//
// Runs against the REAL server (spawned as a child process) and the REAL
// (confirmed test/dev) database configured in .env.test — see testServer.js.
//
// Creates its own throwaway user directly in the DB (bypassing registration, which
// needs a real Turnstile token) so it never touches the shared fixture accounts used
// by credits-lockdown.test.js / credit-config.test.js. Cleaned up in afterAll.
const crypto = require('crypto');
const { startServer } = require('./helpers/testServer');
const db = require('./helpers/db');

let server;
let userId;

async function post(path, body) {
  const res = await fetch(`${server.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  let json = null;
  try { json = await res.json(); } catch (_) { /* non-JSON body */ }
  return { status: res.status, body: json };
}

function setVerificationToken(rawToken, expiresInMs) {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expires = new Date(Date.now() + expiresInMs);
  return db.query(
    'UPDATE users SET email_verification_token = $1, email_verification_expires = $2, email_verified = false WHERE id = $3',
    [hashedToken, expires, userId]
  );
}

beforeAll(async () => {
  server = await startServer();
  const email = `test-email-verification-${Date.now()}@example.invalid`;
  const result = await db.query(
    `INSERT INTO users (email, password_hash, username, role)
     VALUES ($1, 'x', $2, 'buyer') RETURNING id`,
    [email, `tester_${Date.now()}`]
  );
  userId = result.rows[0].id;
}, 30000);

afterAll(async () => {
  if (server) await server.stop();
  if (userId) await db.query('DELETE FROM users WHERE id = $1', [userId]);
  await db.end();
});

test('unknown token -> 400, nothing credited', async () => {
  const { status } = await post('/api/auth/verify-email', { token: 'this-token-does-not-exist' });
  expect(status).toBe(400);

  const wallet = await db.query('SELECT balance_credits FROM public.user_wallets WHERE user_id = $1', [userId]);
  expect(wallet.rows.length).toBe(0);
});

test('expired token -> 400, nothing credited', async () => {
  const rawToken = 'expired-token-fixture';
  await setVerificationToken(rawToken, -1000); // già scaduto

  const { status } = await post('/api/auth/verify-email', { token: rawToken });
  expect(status).toBe(400);
});

test('valid token -> 200, wallet credited exactly once, ledger row written', async () => {
  const rawToken = 'valid-token-fixture';
  await setVerificationToken(rawToken, 24 * 3600000);

  const configRes = await db.query("SELECT value FROM public.credit_config WHERE key = 'signup_bonus'");
  const expectedBonus = parseFloat(configRes.rows[0]?.value ?? 5);

  const { status, body } = await post('/api/auth/verify-email', { token: rawToken });
  expect(status).toBe(200);
  expect(body.bonusAmount).toBe(expectedBonus);

  const userRow = await db.query('SELECT email_verified, email_verification_token FROM users WHERE id = $1', [userId]);
  expect(userRow.rows[0].email_verified).toBe(true);
  expect(userRow.rows[0].email_verification_token).toBeNull();

  const wallet = await db.query('SELECT balance_credits FROM public.user_wallets WHERE user_id = $1', [userId]);
  expect(parseFloat(wallet.rows[0].balance_credits)).toBe(expectedBonus);

  const ledger = await db.query(
    "SELECT amount FROM public.credit_transactions WHERE user_id = $1 AND type = 'signup_bonus'",
    [userId]
  );
  expect(ledger.rows.length).toBe(1);
  expect(parseFloat(ledger.rows[0].amount)).toBe(expectedBonus);
});

test('reusing the same (already-consumed) token -> 400, no second credit', async () => {
  const { status } = await post('/api/auth/verify-email', { token: 'valid-token-fixture' });
  expect(status).toBe(400);

  const ledger = await db.query(
    "SELECT id FROM public.credit_transactions WHERE user_id = $1 AND type = 'signup_bonus'",
    [userId]
  );
  expect(ledger.rows.length).toBe(1); // ancora uno solo, non due
});
