// Covers GET/PUT /api/admin/credit-config (src/routes/admin.js +
// src/repositories/creditConfigRepository.js): admin-only access, unknown-key/invalid-value
// rejection, and that a PUT round-trips through the DB (not just held in memory).
//
// Runs against the REAL server (spawned as a child process) and the REAL
// (confirmed test/dev) database configured in .env.test — see testServer.js.
const { startServer } = require('./helpers/testServer');
const { tokenFor } = require('./helpers/auth');

// Same pre-existing test accounts used in credits-lockdown.test.js.
const ADMIN_ID = '586be97f-96e1-4c78-b319-8264b34555ba';
const USER_ID = '16a8ef5e-8505-4028-be75-83ce765f18d0';

let server;
let adminToken;
let userToken;

beforeAll(async () => {
  server = await startServer();
  adminToken = tokenFor(ADMIN_ID, 'admin');
  userToken = tokenFor(USER_ID, 'user');
}, 30000);

afterAll(async () => {
  if (server) await server.stop();
});

async function get(path, { token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${server.baseUrl}${path}`, { headers });
  let json = null;
  try { json = await res.json(); } catch (_) { /* non-JSON body */ }
  return { status: res.status, body: json };
}

async function put(path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${server.baseUrl}${path}`, {
    method: 'PUT', headers, body: JSON.stringify(body || {}),
  });
  let json = null;
  try { json = await res.json(); } catch (_) { /* non-JSON body */ }
  return { status: res.status, body: json };
}

describe('GET /api/admin/credit-config', () => {
  test('non-admin -> 403', async () => {
    const { status } = await get('/api/admin/credit-config', { token: userToken });
    expect(status).toBe(403);
  });

  test('admin -> 200 with all six known keys', async () => {
    const { status, body } = await get('/api/admin/credit-config', { token: adminToken });
    expect(status).toBe(200);
    const keys = body.config.map((c) => c.key).sort();
    expect(keys).toEqual([
      'maturation_days', 'min_order_amount', 'purchase_bonus',
      'referral_bonus', 'sale_bonus', 'signup_bonus',
    ]);
    for (const item of body.config) {
      expect(typeof item.value).toBe('number');
    }
  });
});

describe('PUT /api/admin/credit-config/:key', () => {
  test('non-admin -> 403', async () => {
    const { status } = await put('/api/admin/credit-config/signup_bonus', {
      token: userToken, body: { value: 7 },
    });
    expect(status).toBe(403);
  });

  test('unknown key -> 404', async () => {
    const { status } = await put('/api/admin/credit-config/not_a_real_key', {
      token: adminToken, body: { value: 7 },
    });
    expect(status).toBe(404);
  });

  test('negative value -> 400', async () => {
    const { status } = await put('/api/admin/credit-config/signup_bonus', {
      token: adminToken, body: { value: -1 },
    });
    expect(status).toBe(400);
  });

  test('valid update round-trips through GET, then gets restored', async () => {
    const before = await get('/api/admin/credit-config', { token: adminToken });
    const original = before.body.config.find((c) => c.key === 'signup_bonus').value;
    const probeValue = original === 7 ? 8 : 7;

    try {
      const { status } = await put('/api/admin/credit-config/signup_bonus', {
        token: adminToken, body: { value: probeValue },
      });
      expect(status).toBe(200);

      const after = await get('/api/admin/credit-config', { token: adminToken });
      const updated = after.body.config.find((c) => c.key === 'signup_bonus');
      expect(updated.value).toBe(probeValue);
      expect(updated.isDefault).toBe(false);
    } finally {
      await put('/api/admin/credit-config/signup_bonus', { token: adminToken, body: { value: original } });
    }
  });
});
