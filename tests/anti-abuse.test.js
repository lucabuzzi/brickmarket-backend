// Covers the mandatory anti-abuse rules (CLAUDE.md — "nessun bonus se venditore e
// compratore condividono IP, dispositivo, metodo di pagamento o indirizzo di
// spedizione; tetto mensile di bonus per coppia venditore-compratore; tetti
// giornalieri/mensili per utente"):
//  - a buyer and seller who share an identity signal (same IP here) never get any
//    sale_bonus/purchase_bonus grant at all for their order
//  - a grant that would push a user over their daily cap is created but
//    flagged_for_review, and the maturation cron leaves it alone
//  - admin rejecting a flagged grant cancels it, never credits anyone
//  - admin approving a flagged grant matures it immediately (wallet credited)
//  - a grant that would push a buyer-seller PAIR over their monthly cap is flagged too
//
// Runs against the REAL server (spawned as a child process) and the REAL
// (confirmed test/dev) database configured in .env.test — see testServer.js.
//
// Creates its own throwaway users/listings/orders directly in the DB, cleaned up in
// afterAll, so it never touches shared fixture accounts.
const crypto = require('crypto');
const { startServer } = require('./helpers/testServer');
const { tokenFor } = require('./helpers/auth');
const db = require('./helpers/db');

const ADMIN_ID = '586be97f-96e1-4c78-b319-8264b34555ba'; // stessa fixture admin di credits-lockdown.test.js

let server;
let adminToken;
const userIds = [];
const listingIds = [];
const orderIds = [];

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

async function post(path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${server.baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  let json = null;
  try { json = await res.json(); } catch (_) { /* non-JSON body */ }
  return { status: res.status, body: json };
}

async function createUser(label) {
  const email = `test-antiabuse-${label}-${Date.now()}-${crypto.randomInt(1e6)}@example.invalid`;
  const result = await db.query(
    `INSERT INTO users (email, password_hash, username, role) VALUES ($1, 'x', $2, 'buyer') RETURNING id`,
    [email, `${label}_${Date.now()}_${crypto.randomInt(1e6)}`]
  );
  userIds.push(result.rows[0].id);
  return result.rows[0].id;
}

async function createListing(sellerId) {
  const result = await db.query(
    `INSERT INTO listings (seller_id, title, type) VALUES ($1, 'Test listing', 'used') RETURNING id`,
    [sellerId]
  );
  listingIds.push(result.rows[0].id);
  return result.rows[0].id;
}

// Ordine 'shipped', pronto per passare da confirm-delivery (che innesca il vero
// createCreditBonusGrantsForOrder — l'unico punto dove tutte queste regole vivono).
async function createShippedOrder({ buyerId, sellerId, listingId, totalBuyer }) {
  const result = await db.query(
    `INSERT INTO orders
       (buyer_id, seller_id, listing_id, item_price, platform_fee, seller_fee, total_buyer, seller_payout, status)
     VALUES ($1, $2, $3, $4, 1, 1, $4, $4, 'shipped')
     RETURNING id`,
    [buyerId, sellerId, listingId, totalBuyer]
  );
  orderIds.push(result.rows[0].id);
  return result.rows[0].id;
}

// Grant "già esistente" usato per far salire artificialmente la somma di un tetto
// prima del vero test — serve un ordine fixture a sé perché (order_id, type) è UNIQUE.
async function seedExistingGrant({ userId, sellerId, buyerId, listingId, type, amount }) {
  const orderId = await createShippedOrder({ buyerId, sellerId, listingId, totalBuyer: amount + 10 });
  await db.query(
    `INSERT INTO public.credit_bonus_grants (user_id, type, amount, order_id, matures_at, status)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '15 days', 'pending')`,
    [userId, type, amount, orderId]
  );
}

beforeAll(async () => {
  server = await startServer();
  adminToken = tokenFor(ADMIN_ID, 'admin');
}, 30000);

afterAll(async () => {
  if (server) await server.stop();
  if (orderIds.length) await db.query('DELETE FROM orders WHERE id = ANY($1)', [orderIds]);
  if (listingIds.length) await db.query('DELETE FROM listings WHERE id = ANY($1)', [listingIds]);
  if (userIds.length) await db.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
  await db.end();
});

test('a buyer and seller sharing an IP signal get no bonus grant at all', async () => {
  const sellerId = await createUser('shared-seller');
  const buyerId = await createUser('shared-buyer');
  const listingId = await createListing(sellerId);
  const buyerToken = tokenFor(buyerId, 'buyer');

  const sharedIp = hashValue('203.0.113.99'); // stesso hash per entrambi
  await db.query(
    "INSERT INTO public.user_identity_signals (user_id, signal_type, signal_hash) VALUES ($1, 'ip', $2), ($3, 'ip', $2)",
    [sellerId, sharedIp, buyerId]
  );

  const orderId = await createShippedOrder({ buyerId, sellerId, listingId, totalBuyer: 30 });
  const { status } = await post(`/api/payments/confirm-delivery/${orderId}`, { token: buyerToken });
  expect(status).toBe(200);

  const grants = await db.query('SELECT id FROM public.credit_bonus_grants WHERE order_id = $1', [orderId]);
  expect(grants.rows.length).toBe(0);
});

let flaggedDailyGrantId;

test('a grant that would exceed the daily per-user cap is created but flagged for review', async () => {
  const sellerId = await createUser('daily-seller');
  const buyerId = await createUser('daily-buyer');
  const listingId = await createListing(sellerId);
  const buyerToken = tokenFor(buyerId, 'buyer');

  const configRes = await db.query("SELECT value FROM public.credit_config WHERE key = 'daily_bonus_cap_per_user'");
  const dailyCap = parseFloat(configRes.rows[0]?.value ?? 20);
  const saleBonusRes = await db.query("SELECT value FROM public.credit_config WHERE key = 'sale_bonus'");
  const saleBonus = parseFloat(saleBonusRes.rows[0]?.value ?? 5);

  // Il venditore ha già quasi raggiunto il tetto giornaliero con un altro ordine.
  await seedExistingGrant({
    userId: sellerId, sellerId, buyerId, listingId,
    type: 'sale_bonus', amount: dailyCap - saleBonus + 1,
  });

  const orderId = await createShippedOrder({ buyerId, sellerId, listingId, totalBuyer: 30 });
  const { status } = await post(`/api/payments/confirm-delivery/${orderId}`, { token: buyerToken });
  expect(status).toBe(200);

  const grant = await db.query(
    "SELECT flagged_for_review, flag_reason, status FROM public.credit_bonus_grants WHERE order_id = $1 AND type = 'sale_bonus'",
    [orderId]
  );
  expect(grant.rows[0].flagged_for_review).toBe(true);
  expect(grant.rows[0].flag_reason).toBe('daily_cap_exceeded');
  expect(grant.rows[0].status).toBe('pending');

  const grantIdRes = await db.query(
    "SELECT id FROM public.credit_bonus_grants WHERE order_id = $1 AND type = 'sale_bonus'",
    [orderId]
  );
  flaggedDailyGrantId = grantIdRes.rows[0].id;

  // Il cron di maturazione non deve toccarlo anche forzandolo subito.
  await db.query("UPDATE public.credit_bonus_grants SET matures_at = NOW() - INTERVAL '1 day' WHERE id = $1", [flaggedDailyGrantId]);
  await post('/api/admin/credit-bonus-grants/mature-now', { token: adminToken });

  const stillPending = await db.query('SELECT status FROM public.credit_bonus_grants WHERE id = $1', [flaggedDailyGrantId]);
  expect(stillPending.rows[0].status).toBe('pending');
});

test('admin rejecting a flagged grant cancels it, never credits anyone', async () => {
  const { status } = await post(`/api/admin/credit-bonus-grants/${flaggedDailyGrantId}/review`, {
    token: adminToken, body: { decision: 'reject' },
  });
  expect(status).toBe(200);

  const grant = await db.query('SELECT status FROM public.credit_bonus_grants WHERE id = $1', [flaggedDailyGrantId]);
  expect(grant.rows[0].status).toBe('cancelled');

  const ledger = await db.query(
    "SELECT id FROM public.credit_transactions WHERE type = 'sale_bonus' AND reference_id = (SELECT order_id::text FROM public.credit_bonus_grants WHERE id = $1)",
    [flaggedDailyGrantId]
  );
  expect(ledger.rows.length).toBe(0);
});

test('a grant that would exceed the monthly per-pair cap is flagged, then approved credits the wallet', async () => {
  const sellerId = await createUser('pair-seller');
  const buyerId = await createUser('pair-buyer');
  const listingId = await createListing(sellerId);
  const buyerToken = tokenFor(buyerId, 'buyer');

  const pairCapRes = await db.query("SELECT value FROM public.credit_config WHERE key = 'monthly_bonus_cap_per_pair'");
  const pairCap = parseFloat(pairCapRes.rows[0]?.value ?? 15);
  const saleBonusRes = await db.query("SELECT value FROM public.credit_config WHERE key = 'sale_bonus'");
  const saleBonus = parseFloat(saleBonusRes.rows[0]?.value ?? 5);

  await seedExistingGrant({
    userId: sellerId, sellerId, buyerId, listingId,
    type: 'sale_bonus', amount: pairCap - saleBonus + 1,
  });

  const orderId = await createShippedOrder({ buyerId, sellerId, listingId, totalBuyer: 30 });
  const { status } = await post(`/api/payments/confirm-delivery/${orderId}`, { token: buyerToken });
  expect(status).toBe(200);

  const grantRes = await db.query(
    "SELECT id, flagged_for_review, flag_reason FROM public.credit_bonus_grants WHERE order_id = $1 AND type = 'sale_bonus'",
    [orderId]
  );
  expect(grantRes.rows[0].flagged_for_review).toBe(true);
  expect(grantRes.rows[0].flag_reason).toBe('pair_cap_exceeded');
  const grantId = grantRes.rows[0].id;

  const listRes = await (await fetch(`${server.baseUrl}/api/admin/credit-bonus-grants/flagged`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).json();
  expect(listRes.grants.some((g) => g.id === grantId)).toBe(true);

  const reviewRes = await post(`/api/admin/credit-bonus-grants/${grantId}/review`, {
    token: adminToken, body: { decision: 'approve' },
  });
  expect(reviewRes.status).toBe(200);

  const grantAfter = await db.query('SELECT status FROM public.credit_bonus_grants WHERE id = $1', [grantId]);
  expect(grantAfter.rows[0].status).toBe('matured');

  const wallet = await db.query('SELECT balance_credits FROM public.user_wallets WHERE user_id = $1', [sellerId]);
  expect(parseFloat(wallet.rows[0].balance_credits)).toBe(saleBonus);
});
