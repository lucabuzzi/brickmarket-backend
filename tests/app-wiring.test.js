// The real app (src/app.js) built with fake dependencies: both databases are mocked (the ClutchVault module would
// otherwise read .env and connect), so nothing here reaches a real DB. Checks the routes that moved out of
// server.js (ClutchVault) and that the shared wiring answers as before.
jest.mock('../src/db', () => ({ query: jest.fn(), getClient: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../src/db/clutchvault-db', () => ({ isMock: false, query: jest.fn(), getMockDbState: jest.fn() }));
// its JWKS client is ESM-only under Jest (same mock as tests/avatar-controller.test.js)
jest.mock('../src/services/appleAuth', () => ({ verifyAppleIdToken: jest.fn() }));
const http = require('http');
const jwt = require('jsonwebtoken');
const mainDb = require('../src/db');
const cvDb = require('../src/db/clutchvault-db');

const SECRET = 'x'.repeat(40);
const saved = process.env.JWT_SECRET;
let server;
let base;
const broadcast = jest.fn();
const onGameChatSettingsChanged = jest.fn();

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  // payments/stripe routes build a Stripe client when loaded; a dummy key, never used for a request here
  if (!process.env.STRIPE_SECRET_KEY) process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_for_wiring_test';
  const { createApp } = require('../src/app');
  const app = createApp({
    broadcast, wss: {}, gameChatRepo: {}, gameChatModerator: {}, onGameChatSettingsChanged,
  });
  expect(app.get('broadcast')).toBe(broadcast);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  process.env.JWT_SECRET = saved;
  if (saved === undefined) delete process.env.JWT_SECRET;
  await new Promise((resolve) => server.close(resolve));
});
beforeEach(() => {
  mainDb.query.mockReset();
  cvDb.query.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const token = () => jwt.sign({ userId: 'u1' }, SECRET);

test('health probe answers without touching the DB', async () => {
  const res = await fetch(`${base}/api/health`);
  expect(res.status).toBe(200);
  expect(mainDb.query).not.toHaveBeenCalled();
});

test('security headers: strict CSP header present, helmet on', async () => {
  const res = await fetch(`${base}/api/health`);
  expect(res.headers.get('content-security-policy')).toMatch(/^script-src 'self'/);
  expect(res.headers.get('x-content-type-options')).toBe('nosniff');
});

test('GET /api/products lists ClutchVault products', async () => {
  cvDb.query.mockResolvedValueOnce({ rows: [{ id: 'p1' }] });
  const res = await fetch(`${base}/api/products`);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ products: [{ id: 'p1' }] });
});

test('GET /api/auctions maps rows to camelCase with numbers', async () => {
  cvDb.query.mockResolvedValueOnce({
    rows: [{
      id: 'a1', product_id: 'p1', title: 'T', description: 'D', image_url: 'i', category: 'lego', market_value: '10.5',
      condition: 'c', grading_info: 'g', current_bid: '3', highest_bidder_id: null, buy_now_price: '20', ends_at: 'e', status: 'active',
    }],
  });
  const res = await fetch(`${base}/api/auctions`);
  expect(await res.json()).toEqual({
    auctions: [{
      id: 'a1', productId: 'p1', title: 'T', description: 'D', imageUrl: 'i', category: 'lego', marketValue: 10.5,
      condition: 'c', gradingInfo: 'g', currentBid: 3, highestBidderId: null, buyNowPrice: 20, endsAt: 'e', status: 'active',
    }],
  });
});

test('GET /api/auctions: DB failure -> 500 with the same message', async () => {
  cvDb.query.mockRejectedValueOnce(new Error('down'));
  const res = await fetch(`${base}/api/auctions`);
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: 'Database error fetching auctions' });
});

test('POST /api/auctions/bid: 401 without a token, 503 (disabled) with one', async () => {
  let res = await fetch(`${base}/api/auctions/bid`, { method: 'POST' });
  expect(res.status).toBe(401);
  mainDb.query.mockResolvedValueOnce({ rows: [{ id: 'u1', username: 'mario', email: 'm@x', role: 'user' }] });
  res = await fetch(`${base}/api/auctions/bid`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ error: 'Aste temporaneamente non disponibili.' });
});

test('POST /api/admin/upload-puzzle-image is admin-only', async () => {
  let res = await fetch(`${base}/api/admin/upload-puzzle-image`, { method: 'POST' });
  expect(res.status).toBe(401);
  mainDb.query.mockResolvedValueOnce({ rows: [{ role: 'user', is_active: true }] });
  res = await fetch(`${base}/api/admin/upload-puzzle-image`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
  expect(res.status).toBe(403);
});

test('POST /api/admin/upload-puzzle-image (admin): inserts product + contest and broadcasts CONTEST_CREATED', async () => {
  mainDb.query.mockResolvedValueOnce({ rows: [{ role: 'admin', is_active: true }] });
  cvDb.query.mockResolvedValue({ rows: [] });
  const fd = new FormData();
  fd.append('title', 'Puzzle');
  fd.append('category', 'pokemon');
  fd.append('totalSlots', '8');
  const res = await fetch(`${base}/api/admin/upload-puzzle-image`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token()}` } });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ success: true, message: 'Jigsaw puzzle uploaded successfully!' });
  expect(body.contestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(cvDb.query).toHaveBeenCalledTimes(2);
  expect(cvDb.query.mock.calls[1][1]).toEqual([expect.any(String), expect.any(String), 8, 10]);
  expect(broadcast).toHaveBeenCalledWith({
    type: 'CONTEST_CREATED',
    payload: expect.objectContaining({ id: body.contestId, title: 'Puzzle', category: 'pokemon', marketValue: 100, slotCostCredits: 10, totalSlots: 8, filledSlots: 0, status: 'open' }),
  });
});

test('POST /api/admin/upload-puzzle-image rejects an unknown category', async () => {
  mainDb.query.mockResolvedValueOnce({ rows: [{ role: 'admin', is_active: true }] });
  const fd = new FormData();
  fd.append('title', 'Puzzle');
  fd.append('category', 'chess');
  const res = await fetch(`${base}/api/admin/upload-puzzle-image`, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token()}` } });
  expect(res.status).toBe(400);
  expect((await res.json()).error).toMatch(/^Invalid category/);
});

test('unknown /api path is not swallowed by the SPA fallback', async () => {
  const res = await fetch(`${base}/api/does-not-exist`);
  expect(res.status).toBe(404);
});
