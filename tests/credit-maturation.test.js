// Covers the sale_bonus/purchase_bonus maturation flow end to end:
//  - confirming delivery on an order above min_order_amount creates two pending
//    credit_bonus_grants (src/repositories/paymentsRepository.js#completeDeliveryConfirmation)
//  - an order below min_order_amount creates none
//  - forcing maturation (POST /api/admin/credit-bonus-grants/mature-now, the same
//    logic the nightly cron runs — src/services/creditMaturation.js) credits both
//    wallets exactly once, with a matching ledger row each
//  - a grant whose order is 'disputed' by the time it's due gets cancelled instead of
//    matured, and never touches anyone's wallet
//
// Runs against the REAL server (spawned as a child process) and the REAL
// (confirmed test/dev) database configured in .env.test — see testServer.js.
//
// Creates its own throwaway seller/buyer/listing/orders directly in the DB (order
// creation normally goes through Stripe checkout, which isn't safely fakeable from an
// integration test) so it never touches shared fixture accounts. Cleaned up in afterAll.
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
  const email = `test-maturation-${label}-${Date.now()}-${crypto.randomInt(1e6)}@example.invalid`;
  const result = await db.query(
    `INSERT INTO users (email, password_hash, username, role) VALUES ($1, 'x', $2, 'buyer') RETURNING id`,
    [email, `${label}_${Date.now()}_${crypto.randomInt(1e6)}`]
  );
  return result.rows[0].id;
}

async function createOrder({ totalBuyer, status = 'shipped' }) {
  const result = await db.query(
    `INSERT INTO orders
       (buyer_id, seller_id, listing_id, item_price, platform_fee, seller_fee, total_buyer, seller_payout, status)
     VALUES ($1, $2, $3, $4, 1, 1, $4, $4, $5)
     RETURNING id`,
    [buyerId, sellerId, listingId, totalBuyer, status]
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

test('confirming delivery above min_order_amount creates two pending grants', async () => {
  const configRes = await db.query("SELECT value FROM public.credit_config WHERE key = 'min_order_amount'");
  const minOrderAmount = parseFloat(configRes.rows[0]?.value ?? 5);
  const orderId = await createOrder({ totalBuyer: minOrderAmount + 20 });

  const { status } = await post(`/api/payments/confirm-delivery/${orderId}`, { token: buyerToken });
  expect(status).toBe(200);

  const grants = await db.query(
    `SELECT user_id, type, status, amount FROM public.credit_bonus_grants WHERE order_id = $1 ORDER BY type`,
    [orderId]
  );
  expect(grants.rows.length).toBe(2);
  for (const g of grants.rows) {
    expect(g.status).toBe('pending');
  }
  const saleGrant = grants.rows.find((g) => g.type === 'sale_bonus');
  const purchaseGrant = grants.rows.find((g) => g.type === 'purchase_bonus');
  expect(saleGrant.user_id).toBe(sellerId);
  expect(purchaseGrant.user_id).toBe(buyerId);
});

test('confirming delivery below min_order_amount creates no grants', async () => {
  const configRes = await db.query("SELECT value FROM public.credit_config WHERE key = 'min_order_amount'");
  const minOrderAmount = parseFloat(configRes.rows[0]?.value ?? 5);
  const orderId = await createOrder({ totalBuyer: Math.max(minOrderAmount - 1, 0.5) });

  const { status } = await post(`/api/payments/confirm-delivery/${orderId}`, { token: buyerToken });
  expect(status).toBe(200);

  const grants = await db.query('SELECT id FROM public.credit_bonus_grants WHERE order_id = $1', [orderId]);
  expect(grants.rows.length).toBe(0);
});

test('forcing maturation credits both wallets exactly once, with a ledger row each', async () => {
  const configRes = await db.query("SELECT value FROM public.credit_config WHERE key = 'min_order_amount'");
  const minOrderAmount = parseFloat(configRes.rows[0]?.value ?? 5);
  const orderId = await createOrder({ totalBuyer: minOrderAmount + 20 });
  await post(`/api/payments/confirm-delivery/${orderId}`, { token: buyerToken });

  // Simula il tempo passato: la maturazione è dovuta.
  await db.query(
    "UPDATE public.credit_bonus_grants SET matures_at = NOW() - INTERVAL '1 day' WHERE order_id = $1",
    [orderId]
  );

  const { status, body } = await post('/api/admin/credit-bonus-grants/mature-now', { token: adminToken });
  expect(status).toBe(200);
  expect(body.matured).toBeGreaterThanOrEqual(2);

  const grants = await db.query(
    "SELECT status FROM public.credit_bonus_grants WHERE order_id = $1",
    [orderId]
  );
  for (const g of grants.rows) {
    expect(g.status).toBe('matured');
  }

  const [saleConfig, purchaseConfig] = await Promise.all([
    db.query("SELECT value FROM public.credit_config WHERE key = 'sale_bonus'"),
    db.query("SELECT value FROM public.credit_config WHERE key = 'purchase_bonus'"),
  ]);
  const saleBonus = parseFloat(saleConfig.rows[0]?.value ?? 5);
  const purchaseBonus = parseFloat(purchaseConfig.rows[0]?.value ?? 5);

  const sellerWallet = await db.query('SELECT balance_credits FROM public.user_wallets WHERE user_id = $1', [sellerId]);
  const buyerWallet = await db.query('SELECT balance_credits FROM public.user_wallets WHERE user_id = $1', [buyerId]);
  expect(parseFloat(sellerWallet.rows[0].balance_credits)).toBe(saleBonus);
  expect(parseFloat(buyerWallet.rows[0].balance_credits)).toBe(purchaseBonus);

  const ledger = await db.query(
    "SELECT user_id, type FROM public.credit_transactions WHERE reference_id = $1 AND type IN ('sale_bonus', 'purchase_bonus')",
    [orderId]
  );
  expect(ledger.rows.length).toBe(2);

  // Rigiocare la maturazione non deve accreditare di nuovo nessuno dei due.
  await post('/api/admin/credit-bonus-grants/mature-now', { token: adminToken });
  const sellerWalletAfter = await db.query('SELECT balance_credits FROM public.user_wallets WHERE user_id = $1', [sellerId]);
  expect(parseFloat(sellerWalletAfter.rows[0].balance_credits)).toBe(saleBonus);
});

test('a grant whose order is disputed by maturation time is cancelled, never credited', async () => {
  const configRes = await db.query("SELECT value FROM public.credit_config WHERE key = 'min_order_amount'");
  const minOrderAmount = parseFloat(configRes.rows[0]?.value ?? 5);
  const orderId = await createOrder({ totalBuyer: minOrderAmount + 20 });
  await post(`/api/payments/confirm-delivery/${orderId}`, { token: buyerToken });

  await db.query(
    "UPDATE public.credit_bonus_grants SET matures_at = NOW() - INTERVAL '1 day' WHERE order_id = $1",
    [orderId]
  );
  await db.query("UPDATE orders SET status = 'disputed' WHERE id = $1", [orderId]);

  const { status } = await post('/api/admin/credit-bonus-grants/mature-now', { token: adminToken });
  expect(status).toBe(200);

  const grants = await db.query(
    "SELECT status, cancel_reason FROM public.credit_bonus_grants WHERE order_id = $1",
    [orderId]
  );
  for (const g of grants.rows) {
    expect(g.status).toBe('cancelled');
    expect(g.cancel_reason).toBe('order_status:disputed');
  }

  const ledger = await db.query(
    "SELECT id FROM public.credit_transactions WHERE reference_id = $1 AND type IN ('sale_bonus', 'purchase_bonus')",
    [orderId]
  );
  expect(ledger.rows.length).toBe(0);
});
