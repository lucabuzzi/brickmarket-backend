// Covers the referral completion flow (src/services/authService.js
// #completeReferralAndCreditReferrer, src/repositories/userRepository.js#completeReferral):
// crediting the referrer's wallet only once the referred user verifies their email, and
// only once ever per referral, even if verify-email is (attempted to be) replayed.
//
// Linking a referral at registration time (authService.linkReferral, driven by
// ?ref=CODE / the registration form field) isn't exercised here: it sits behind
// POST /api/auth/register, which requires a real Cloudflare Turnstile token and isn't
// safely fakeable from an integration test without depending on Cloudflare's network
// test keys. What's covered here — the atomic pending->completed transition and the
// wallet credit it triggers — is the part with actual money-shaped correctness risk.
//
// Runs against the REAL server (spawned as a child process) and the REAL
// (confirmed test/dev) database configured in .env.test — see testServer.js.
//
// Creates two throwaway users directly in the DB (referrer + referred), bypassing
// registration, so it never touches the shared fixture accounts used by the other
// integration tests. Cleaned up in afterAll.
const crypto = require('crypto');
const { startServer } = require('./helpers/testServer');
const db = require('./helpers/db');

let server;
let referrerId;
let referredId;
let referrerCode;

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

async function createThrowawayUser(label) {
  const email = `test-referral-${label}-${Date.now()}-${crypto.randomInt(1e6)}@example.invalid`;
  const code = crypto.randomBytes(6).toString('hex').toUpperCase().slice(0, 8);
  const result = await db.query(
    `INSERT INTO users (email, password_hash, username, role, referral_code)
     VALUES ($1, 'x', $2, 'buyer', $3) RETURNING id`,
    [email, `${label}_${Date.now()}_${crypto.randomInt(1e6)}`, code]
  );
  return { id: result.rows[0].id, code };
}

function setVerificationToken(userId, rawToken, expiresInMs = 24 * 3600000) {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expires = new Date(Date.now() + expiresInMs);
  return db.query(
    'UPDATE users SET email_verification_token = $1, email_verification_expires = $2, email_verified = false WHERE id = $3',
    [hashedToken, expires, userId]
  );
}

beforeAll(async () => {
  server = await startServer();
  const referrer = await createThrowawayUser('referrer');
  referrerId = referrer.id;
  referrerCode = referrer.code;

  const referred = await createThrowawayUser('referred');
  referredId = referred.id;

  // Equivalente a ciò che authService.linkReferral scrive durante la registrazione
  // con ?ref=CODICE — qui creato direttamente per isolare la parte di completamento.
  await db.query(
    'INSERT INTO public.referrals (referrer_id, referred_id, referral_code) VALUES ($1, $2, $3)',
    [referrerId, referredId, referrerCode]
  );
}, 30000);

afterAll(async () => {
  if (server) await server.stop();
  if (referredId) await db.query('DELETE FROM users WHERE id = $1', [referredId]);
  if (referrerId) await db.query('DELETE FROM users WHERE id = $1', [referrerId]);
  await db.end();
});

test('referred user verifying their email credits the referrer exactly once', async () => {
  const configRes = await db.query("SELECT value FROM public.credit_config WHERE key = 'referral_bonus'");
  const expectedBonus = parseFloat(configRes.rows[0]?.value ?? 5);

  const rawToken = 'referred-user-token-fixture';
  await setVerificationToken(referredId, rawToken);
  const { status } = await post('/api/auth/verify-email', { token: rawToken });
  expect(status).toBe(200);

  const referralRow = await db.query('SELECT status FROM public.referrals WHERE referred_id = $1', [referredId]);
  expect(referralRow.rows[0].status).toBe('completed');

  const referrerWallet = await db.query(
    'SELECT balance_credits FROM public.user_wallets WHERE user_id = $1',
    [referrerId]
  );
  expect(parseFloat(referrerWallet.rows[0].balance_credits)).toBe(expectedBonus);

  const ledger = await db.query(
    "SELECT amount FROM public.credit_transactions WHERE user_id = $1 AND type = 'referral_bonus' AND reference_id = $2",
    [referrerId, referredId]
  );
  expect(ledger.rows.length).toBe(1);
  expect(parseFloat(ledger.rows[0].amount)).toBe(expectedBonus);
});

test('a second verify-email attempt on the same referral never double-credits the referrer', async () => {
  // Il token è già stato consumato dal test precedente (nullato da verifyEmailByToken).
  const { status } = await post('/api/auth/verify-email', { token: 'referred-user-token-fixture' });
  expect(status).toBe(400);

  const ledger = await db.query(
    "SELECT id FROM public.credit_transactions WHERE user_id = $1 AND type = 'referral_bonus' AND reference_id = $2",
    [referrerId, referredId]
  );
  expect(ledger.rows.length).toBe(1); // ancora uno solo
});
