// Covers the Definition of Done for the credits/auctions/admin-auth lockdown:
//  - 404 on the euro<->crediti endpoints (wallet top-up, convert, stripe simulate-checkout —
//    removed outright, not just disabled, once the phase-0 cleanup shipped)
//  - 503 on the ClutchVault-style auction bid endpoint
//  - 403 for a deactivated admin on the three hardened admin endpoints
//  - refund idempotency under two genuinely concurrent requests
//
// Runs against the REAL server (spawned as a child process) and the REAL
// (confirmed test/dev) database configured in .env — see testServer.js.
const { startServer } = require('./helpers/testServer');
const { tokenFor } = require('./helpers/auth');
const db = require('./helpers/db');

// Real, pre-existing accounts in the test DB (see conversation: 1 admin "Ludex",
// several non-admin buyer/seller test accounts, all with small CR wallet balances).
const ADMIN_ID = '586be97f-96e1-4c78-b319-8264b34555ba';
const USER_ID = '16a8ef5e-8505-4028-be75-83ce765f18d0';
const PARTICIPANT_IDS = [
  '16a8ef5e-8505-4028-be75-83ce765f18d0', // fabriziogianni1992
  'f39e4f8e-ab13-49e4-b18a-6dddcfd14399', // Flo
  '10c085c2-0415-4f85-baf1-5357295359bd', // liccio
];

let server;
let adminToken;
let userToken;

beforeAll(async () => {
  server = await startServer();
  adminToken = tokenFor(ADMIN_ID, 'admin');
  userToken = tokenFor(USER_ID, 'buyer');
}, 30000);

afterAll(async () => {
  if (server) await server.stop();
  // Always leave the admin account active, even if a test failed mid-way.
  await db.query('UPDATE users SET is_active = true WHERE id = $1', [ADMIN_ID]);
  await db.end();
});

async function post(path, { token, body, isForm = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let fetchBody;
  if (isForm) {
    fetchBody = body; // already a FormData
  } else {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body || {});
  }
  const res = await fetch(`${server.baseUrl}${path}`, { method: 'POST', headers, body: fetchBody });
  let json = null;
  try { json = await res.json(); } catch (_) { /* non-JSON body */ }
  return { status: res.status, body: json };
}

describe('Euro<->crediti flow rimosso (route inesistenti, 404)', () => {
  test('POST /api/wallet/create-topup-intent -> 404', async () => {
    const { status } = await post('/api/wallet/create-topup-intent', {
      token: userToken, body: { amountEuros: 10 },
    });
    expect(status).toBe(404);
  });

  test('POST /api/wallet/confirm-topup -> 404', async () => {
    const { status } = await post('/api/wallet/confirm-topup', {
      token: userToken, body: { paymentIntentId: 'pi_fake' },
    });
    expect(status).toBe(404);
  });

  test('POST /api/wallet/convert -> 404', async () => {
    const { status } = await post('/api/wallet/convert', {
      token: userToken, body: { credits: 10 },
    });
    expect(status).toBe(404);
  });

  test('GET /api/wallet/payout-status -> 404', async () => {
    const res = await fetch(`${server.baseUrl}/api/wallet/payout-status`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status).toBe(404);
  });

  test('POST /api/webhooks/simulate-checkout -> 404', async () => {
    const { status } = await post('/api/webhooks/simulate-checkout', {
      token: userToken, body: { amountEuros: 10 },
    });
    expect(status).toBe(404);
  });
});

describe('Aste ClutchVault disattivate (503)', () => {
  test('POST /api/auctions/bid -> 503', async () => {
    const { status, body } = await post('/api/auctions/bid', {
      token: userToken, body: { auctionId: 'a1000000-0000-0000-0000-000000000001', bidAmount: 999 },
    });
    expect(status).toBe(503);
    expect(body.error).toMatch(/non disponibili/i);
  });
});

describe('adminAuth: admin disattivato -> 403 anche con JWT valido', () => {
  beforeAll(async () => {
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [ADMIN_ID]);
  });

  afterAll(async () => {
    await db.query('UPDATE users SET is_active = true WHERE id = $1', [ADMIN_ID]);
  });

  test('POST /api/admin/upload-puzzle-image -> 403', async () => {
    const { status } = await post('/api/admin/upload-puzzle-image', { token: adminToken, body: { title: 'x' } });
    expect(status).toBe(403);
  });

  test('POST /api/contest/refund/:contestId -> 403', async () => {
    const { status } = await post('/api/contest/refund/00000000-0000-0000-0000-000000000000', { token: adminToken });
    expect(status).toBe(403);
  });

  test('POST /api/contest/create -> 403', async () => {
    const { status } = await post('/api/contest/create', { token: adminToken, body: { title: 'x' } });
    expect(status).toBe(403);
  });
});

describe('Refund contest idempotente sotto richieste parallele', () => {
  let contestId;
  const slotCost = 1;

  beforeAll(async () => {
    // Admin (active) creates a real throwaway contest.
    const form = new FormData();
    form.set('title', `TEST idempotency ${Date.now()}`);
    form.set('category', 'lego');
    form.set('marketValue', '50');
    form.set('slotCostCredits', String(slotCost));
    form.set('totalSlots', '10');
    const { status, body } = await post('/api/contest/create', { token: adminToken, isForm: true, body: form });
    expect(status).toBe(200);
    contestId = body.contestId;

    // Three real users each buy one slot.
    for (const userId of PARTICIPANT_IDS) {
      const tok = tokenFor(userId, 'buyer');
      const { status: buyStatus } = await post('/api/contest/buy-slot', { token: tok, body: { contestId } });
      expect(buyStatus).toBe(200);
    }
  }, 20000);

  test('two concurrent refund requests credit each participant exactly once', async () => {
    const before = await db.query(
      'SELECT user_id, balance_credits FROM public.user_wallets WHERE user_id = ANY($1)',
      [PARTICIPANT_IDS]
    );
    const balanceBefore = Object.fromEntries(before.rows.map((r) => [r.user_id, parseFloat(r.balance_credits)]));

    // Fire both requests genuinely in parallel — this is the scenario that would
    // double-refund everyone without the idempotency guard in contestRepository.js.
    const [r1, r2] = await Promise.all([
      post(`/api/contest/refund/${contestId}`, { token: adminToken }),
      post(`/api/contest/refund/${contestId}`, { token: adminToken }),
    ]);

    expect([r1.status, r2.status]).toEqual([200, 200]);

    const after = await db.query(
      'SELECT user_id, balance_credits FROM public.user_wallets WHERE user_id = ANY($1)',
      [PARTICIPANT_IDS]
    );
    for (const row of after.rows) {
      const delta = parseFloat(row.balance_credits) - balanceBefore[row.user_id];
      expect(delta).toBe(slotCost); // exactly one refund, never 2x
    }

    const ledgerRows = await db.query(
      "SELECT user_id FROM public.credit_transactions WHERE reference_id = $1 AND type = 'contest_refund'",
      [contestId]
    );
    expect(ledgerRows.rows.length).toBe(PARTICIPANT_IDS.length); // one ledger row per participant, not two
  });
});
