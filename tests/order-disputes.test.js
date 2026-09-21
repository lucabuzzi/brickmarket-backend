// Covers the minimal dispute/refund flow and its credit clawback
// (src/services/orderDisputeService.js):
//  - buyer opens a dispute -> admin rejects it -> order back to 'completed', nothing
//    touched on the credits side
//  - buyer opens a dispute -> admin refunds -> a still-pending grant is cancelled,
//    never credited
//  - a grant already matured (credited) gets clawed back from the wallet, with a
//    matching negative 'clawback' ledger row
//  - if the bonus was already partly spent, the clawback clamps to what's left
//    instead of pushing the balance negative
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
  const email = `test-dispute-${label}-${Date.now()}-${crypto.randomInt(1e6)}@example.invalid`;
  const result = await db.query(
    `INSERT INTO users (email, password_hash, username, role) VALUES ($1, 'x', $2, 'buyer') RETURNING id`,
    [email, `${label}_${Date.now()}_${crypto.randomInt(1e6)}`]
  );
  return result.rows[0].id;
}

async function createCompletedOrder() {
  const result = await db.query(
    `INSERT INTO orders
       (buyer_id, seller_id, listing_id, item_price, platform_fee, seller_fee, total_buyer, seller_payout, status, confirmed_at)
     VALUES ($1, $2, $3, 20, 1, 1, 20, 20, 'completed', NOW())
     RETURNING id`,
    [buyerId, sellerId, listingId]
  );
  const id = result.rows[0].id;
  orderIds.push(id);
  return id;
}

async function insertGrant(orderId, { userId, type, amount, status }) {
  const result = await db.query(
    `INSERT INTO public.credit_bonus_grants (user_id, type, amount, order_id, matures_at, status, matured_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '15 days', $5, CASE WHEN $5 = 'matured' THEN NOW() ELSE NULL END)
     RETURNING id`,
    [userId, type, amount, orderId, status]
  );
  return result.rows[0].id;
}

beforeAll(async () => {
  server = await startServer();
  adminToken = tokenFor(ADMIN_ID, 'admin');

  sellerId = await createThrowawayUser('seller');
  buyerId = await createThrowawayUser('buyer');
  buyerToken = tokenFor(buyerId, 'buyer');

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

test('opening then rejecting a dispute leaves the order completed again', async () => {
  const orderId = await createCompletedOrder();

  const openRes = await post(`/api/orders/${orderId}/dispute`, { token: buyerToken, body: { reason: 'Oggetto non ricevuto' } });
  expect(openRes.status).toBe(200);

  const disputedRow = await db.query('SELECT status FROM orders WHERE id = $1', [orderId]);
  expect(disputedRow.rows[0].status).toBe('disputed');

  const resolveRes = await post(`/api/admin/orders/${orderId}/dispute-resolution`, { token: adminToken, body: { outcome: 'reject' } });
  expect(resolveRes.status).toBe(200);

  const finalRow = await db.query('SELECT status FROM orders WHERE id = $1', [orderId]);
  expect(finalRow.rows[0].status).toBe('completed');
});

test('refunding an order with a still-pending grant cancels it without ever crediting anyone', async () => {
  const orderId = await createCompletedOrder();
  await insertGrant(orderId, { userId: sellerId, type: 'sale_bonus', amount: 5, status: 'pending' });

  await post(`/api/orders/${orderId}/dispute`, { token: buyerToken, body: { reason: 'Prodotto danneggiato' } });
  const resolveRes = await post(`/api/admin/orders/${orderId}/dispute-resolution`, { token: adminToken, body: { outcome: 'refund' } });
  expect(resolveRes.status).toBe(200);

  const grant = await db.query("SELECT status FROM public.credit_bonus_grants WHERE order_id = $1", [orderId]);
  expect(grant.rows[0].status).toBe('cancelled');

  const ledger = await db.query("SELECT id FROM public.credit_transactions WHERE reference_id = $1", [orderId]);
  expect(ledger.rows.length).toBe(0);
});

test('refunding an order with an already-matured grant claws back the wallet', async () => {
  const orderId = await createCompletedOrder();
  await insertGrant(orderId, { userId: sellerId, type: 'sale_bonus', amount: 5, status: 'matured' });
  // Simula quello che il cron di maturazione avrebbe già fatto: credito reale in wallet.
  await db.query(
    `INSERT INTO public.user_wallets (user_id, balance_credits) VALUES ($1, 5)
     ON CONFLICT (user_id) DO UPDATE SET balance_credits = public.user_wallets.balance_credits + 5`,
    [sellerId]
  );

  await post(`/api/orders/${orderId}/dispute`, { token: buyerToken, body: { reason: 'Non conforme alla descrizione' } });
  const resolveRes = await post(`/api/admin/orders/${orderId}/dispute-resolution`, { token: adminToken, body: { outcome: 'refund' } });
  expect(resolveRes.status).toBe(200);

  const grant = await db.query("SELECT status FROM public.credit_bonus_grants WHERE order_id = $1", [orderId]);
  expect(grant.rows[0].status).toBe('clawed_back');

  const wallet = await db.query('SELECT balance_credits FROM public.user_wallets WHERE user_id = $1', [sellerId]);
  expect(parseFloat(wallet.rows[0].balance_credits)).toBe(0);

  const ledger = await db.query(
    "SELECT amount FROM public.credit_transactions WHERE reference_id = $1 AND type = 'clawback'",
    [orderId]
  );
  expect(ledger.rows.length).toBe(1);
  expect(parseFloat(ledger.rows[0].amount)).toBe(-5);
});

test('clawback clamps to what is left in the wallet if the bonus was already partly spent', async () => {
  const orderId = await createCompletedOrder();
  await insertGrant(orderId, { userId: sellerId, type: 'sale_bonus', amount: 5, status: 'matured' });
  // Il venditore aveva già speso parte del bonus altrove: gliene restano solo 2.
  await db.query(
    `INSERT INTO public.user_wallets (user_id, balance_credits) VALUES ($1, 2)
     ON CONFLICT (user_id) DO UPDATE SET balance_credits = 2`,
    [sellerId]
  );

  await post(`/api/orders/${orderId}/dispute`, { token: buyerToken, body: { reason: 'Reso richiesto' } });
  const resolveRes = await post(`/api/admin/orders/${orderId}/dispute-resolution`, { token: adminToken, body: { outcome: 'refund' } });
  expect(resolveRes.status).toBe(200);

  const wallet = await db.query('SELECT balance_credits FROM public.user_wallets WHERE user_id = $1', [sellerId]);
  expect(parseFloat(wallet.rows[0].balance_credits)).toBe(0); // mai sotto zero

  const ledger = await db.query(
    "SELECT amount FROM public.credit_transactions WHERE reference_id = $1 AND type = 'clawback'",
    [orderId]
  );
  expect(parseFloat(ledger.rows[0].amount)).toBe(-2); // tolto solo quel che c'era, non i 5 pieni
});
