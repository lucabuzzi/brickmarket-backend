// Covers the card-only "in evidenza" flow (src/routes/listings.js, src/routes/admin.js,
// src/services/featured.js): credits can no longer pay for a promotion, the public
// tariff table is in euro cents, and admins can change prices (validated, DB round-trip).
//
// Runs against the REAL server (spawned as a child process) and the REAL
// (confirmed test/dev) database configured in .env.test — see testServer.js.
// Requires src/db/migrate_featured_card_only.js to have been run on that DB.
const { startServer } = require('./helpers/testServer');
const { tokenFor } = require('./helpers/auth');
const db = require('./helpers/db');

// Same pre-existing test accounts used in credits-lockdown.test.js.
const ADMIN_ID = '586be97f-96e1-4c78-b319-8264b34555ba';
const USER_ID = '16a8ef5e-8505-4028-be75-83ce765f18d0';

let server;
let adminToken;
let userToken;
let originalPrices;

beforeAll(async () => {
  server = await startServer();
  adminToken = tokenFor(ADMIN_ID, 'admin');
  userToken = tokenFor(USER_ID, 'user');
  const r = await db.query('SELECT id, price_cents FROM featured_tariffs');
  originalPrices = r.rows;
}, 30000);

afterAll(async () => {
  if (server) await server.stop();
  // Put back whatever prices the admin had set before this run.
  for (const row of originalPrices || []) {
    await db.query('UPDATE featured_tariffs SET price_cents = $2 WHERE id = $1', [row.id, row.price_cents]);
  }
  await db.end();
});

async function request(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${server.baseUrl}${path}`, {
    method, headers, body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  let json = null;
  try { json = await res.json(); } catch (_) { /* non-JSON body */ }
  return { status: res.status, body: json };
}

async function walletBalance(userId) {
  const r = await db.query('SELECT balance_credits FROM public.user_wallets WHERE user_id = $1', [userId]);
  return r.rows[0] ? parseFloat(r.rows[0].balance_credits) : 0;
}

async function anyActiveListingOf(userId) {
  const r = await db.query(
    "SELECT id FROM listings WHERE seller_id = $1 AND status = 'active' LIMIT 1",
    [userId]
  );
  return r.rows[0]?.id || null;
}

describe('GET /api/listings/featured/tariffs', () => {
  test('euro cents only, sorted by days, no credits field', async () => {
    const { status, body } = await request('GET', '/api/listings/featured/tariffs');
    expect(status).toBe(200);
    expect(body.tariffs.map((t) => t.days)).toEqual([7, 14, 30]);
    for (const t of body.tariffs) {
      expect(Number.isInteger(t.priceCents)).toBe(true);
      expect(t).not.toHaveProperty('credits');
    }
  });
});

describe('POST /api/listings/:id/feature — wallet no longer accepted', () => {
  test("method 'wallet' -> 400 and the wallet balance is untouched", async () => {
    const listingId = await anyActiveListingOf(USER_ID);
    const before = await walletBalance(USER_ID);
    const { status, body } = await request('POST', `/api/listings/${listingId || '00000000-0000-0000-0000-000000000000'}/feature`, {
      token: userToken, body: { tariff: '7', method: 'wallet' },
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/Metodo di pagamento non valido/);
    expect(await walletBalance(USER_ID)).toBe(before);
  });

  test('missing method -> 400 (never defaults to a card charge)', async () => {
    const { status } = await request('POST', '/api/listings/00000000-0000-0000-0000-000000000000/feature', {
      token: userToken, body: { tariff: '7' },
    });
    expect(status).toBe(400);
  });

  test("unknown tariff with method 'card' -> 400", async () => {
    const { status, body } = await request('POST', '/api/listings/00000000-0000-0000-0000-000000000000/feature', {
      token: userToken, body: { tariff: '10', method: 'card' },
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/Tariffa non valida/);
  });
});

describe('Admin /api/admin/featured-tariffs', () => {
  test('non-admin -> 403 on GET and PUT', async () => {
    expect((await request('GET', '/api/admin/featured-tariffs', { token: userToken })).status).toBe(403);
    expect((await request('PUT', '/api/admin/featured-tariffs/7', { token: userToken, body: { priceCents: 600 } })).status).toBe(403);
  });

  test('unknown tariff id -> 404', async () => {
    const { status } = await request('PUT', '/api/admin/featured-tariffs/60', { token: adminToken, body: { priceCents: 600 } });
    expect(status).toBe(404);
  });

  test.each([[49], [0], [-100], [5.5], ['abc'], [100001]])('invalid priceCents %p -> 400', async (priceCents) => {
    const { status } = await request('PUT', '/api/admin/featured-tariffs/7', { token: adminToken, body: { priceCents } });
    expect(status).toBe(400);
  });

  test('valid PUT round-trips through the DB and shows up in the public table', async () => {
    const put = await request('PUT', '/api/admin/featured-tariffs/14', { token: adminToken, body: { priceCents: 1234 } });
    expect(put.status).toBe(200);

    const row = await db.query('SELECT price_cents, updated_by FROM featured_tariffs WHERE id = $1', ['14']);
    expect(row.rows[0].price_cents).toBe(1234);
    expect(row.rows[0].updated_by).toBe(ADMIN_ID);

    const pub = await request('GET', '/api/listings/featured/tariffs');
    expect(pub.body.tariffs.find((t) => t.id === '14').priceCents).toBe(1234);
  });
});
