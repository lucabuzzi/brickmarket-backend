// Covers auto-confirming delivery when the buyer never manually confirms within
// orders.confirm_deadline (src/services/orderAutoConfirm.js, forced via
// POST /api/admin/orders/auto-confirm-now — the same logic the hourly cron runs).
// Confirms it shares the exact same effects as the manual confirm-delivery endpoint
// (order completed, pending credit_bonus_grants created), and that it leaves orders
// whose deadline hasn't passed yet alone.
//
// Runs against the REAL server (spawned as a child process) and the REAL
// (confirmed test/dev) database configured in .env.test — see testServer.js.
//
// Creates its own throwaway seller/buyer/listing/orders directly in the DB, cleaned
// up in afterAll, so it never touches shared fixture accounts.
const crypto = require('crypto');
const { startServer } = require('./helpers/testServer');
const { tokenFor } = require('./helpers/auth');
const db = require('./helpers/db');

const ADMIN_ID = '586be97f-96e1-4c78-b319-8264b34555ba'; // stessa fixture admin di credits-lockdown.test.js

let server;
let adminToken;
let sellerId;
let buyerId;
let buyerToken;
let listingId;
const orderIds = [];

async function post(path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${server.baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  let json = null;
  try { json = await res.json(); } catch (_) { /* non-JSON body */ }
  return { status: res.status, body: json };
}

async function createThrowawayUser(label) {
  const email = `test-autoconfirm-${label}-${Date.now()}-${crypto.randomInt(1e6)}@example.invalid`;
  const result = await db.query(
    `INSERT INTO users (email, password_hash, username, role) VALUES ($1, 'x', $2, 'user') RETURNING id`,
    [email, `${label}_${Date.now()}_${crypto.randomInt(1e6)}`]
  );
  return result.rows[0].id;
}

async function createOrder({ confirmDeadlineOffsetMs, status = 'shipped' }) {
  const result = await db.query(
    `INSERT INTO orders
       (buyer_id, seller_id, listing_id, item_price, platform_fee, seller_fee, total_buyer, seller_payout, status, confirm_deadline)
     VALUES ($1, $2, $3, 20, 1, 1, 20, 20, $4, NOW() + ($5 || ' milliseconds')::interval)
     RETURNING id`,
    [buyerId, sellerId, listingId, status, confirmDeadlineOffsetMs]
  );
  const id = result.rows[0].id;
  orderIds.push(id);
  return id;
}

beforeAll(async () => {
  server = await startServer();
  adminToken = tokenFor(ADMIN_ID, 'admin');

  sellerId = await createThrowawayUser('seller');
  buyerId = await createThrowawayUser('buyer');
  buyerToken = tokenFor(buyerId, 'user');

  const listingRes = await db.query(
    `INSERT INTO listings (seller_id, title, type) VALUES ($1, 'Test listing', 'used') RETURNING id`,
    [sellerId]
  );
  listingId = listingRes.rows[0].id;
}, 30000);

afterAll(async () => {
  if (server) await server.stop();
  if (orderIds.length) await db.query('DELETE FROM orders WHERE id = ANY($1)', [orderIds]);
  if (sellerId || buyerId) await db.query('DELETE FROM users WHERE id = ANY($1)', [[sellerId, buyerId].filter(Boolean)]);
  await db.end();
});

test('an order past its confirm_deadline gets auto-confirmed, with pending grants created', async () => {
  const orderId = await createOrder({ confirmDeadlineOffsetMs: -1000 }); // scaduto un secondo fa

  const { status, body } = await post('/api/admin/orders/auto-confirm-now', { token: adminToken });
  expect(status).toBe(200);
  expect(body.confirmed).toBeGreaterThanOrEqual(1);

  const orderRow = await db.query('SELECT status, confirmed_at FROM orders WHERE id = $1', [orderId]);
  expect(orderRow.rows[0].status).toBe('completed');
  expect(orderRow.rows[0].confirmed_at).not.toBeNull();

  const grants = await db.query('SELECT type, status FROM public.credit_bonus_grants WHERE order_id = $1', [orderId]);
  expect(grants.rows.length).toBe(2);
});

test('an order whose confirm_deadline is still in the future is left alone', async () => {
  const orderId = await createOrder({ confirmDeadlineOffsetMs: 60 * 60 * 1000 }); // tra un'ora

  const { status } = await post('/api/admin/orders/auto-confirm-now', { token: adminToken });
  expect(status).toBe(200);

  const orderRow = await db.query('SELECT status FROM orders WHERE id = $1', [orderId]);
  expect(orderRow.rows[0].status).toBe('shipped');
});

test('an order the buyer already confirmed manually is not double-processed by auto-confirm', async () => {
  const orderId = await createOrder({ confirmDeadlineOffsetMs: 60 * 60 * 1000 });

  const confirmRes = await post(`/api/payments/confirm-delivery/${orderId}`, { token: buyerToken });
  expect(confirmRes.status).toBe(200);

  // Anche se il deadline non fosse ancora scaduto, l'ordine non è più 'shipped':
  // l'auto-confirm (che filtra su status='shipped') non deve toccarlo di nuovo.
  const { status } = await post('/api/admin/orders/auto-confirm-now', { token: adminToken });
  expect(status).toBe(200);

  const grants = await db.query('SELECT id FROM public.credit_bonus_grants WHERE order_id = $1', [orderId]);
  expect(grants.rows.length).toBe(2); // creati una sola volta dalla conferma manuale
});
