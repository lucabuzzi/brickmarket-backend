// Characterisation of every /api/admin endpoint served by the admin router, pinned before src/routes/admin.js
// was split into src/modules/admin/. Each case records, in order: every SQL statement with its parameters,
// every call to a collaborator (analytics snapshots, featured, credits, disputes, auto-confirm, private
// documents, live broadcast), and the exact status + response text. The snapshot was written against the old
// file; the refactor must reproduce it exactly. The DB and the services behind it are mocked; validation is real.
// Only Date is faked (fixed at 2026-07-15T10:00:00Z) so generated_at and "today" are stable.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');

const mockLog = [];
const mockRules = [];

jest.mock('../src/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('../src/middleware/auth', () => {
  const auth = (req, res, next) => next();
  auth.adminAuth = (req, res, next) => {
    if (!req.headers['x-admin']) return res.status(403).json({ error: 'test: not admin' });
    req.user = { userId: req.headers['x-admin'], role: 'admin' };
    next();
  };
  return auth;
});
jest.mock('../src/services/analyticsSnapshot', () => ({ computeDaySnapshot: jest.fn(), backfillSnapshots: jest.fn() }));
jest.mock('../src/services/featured', () => ({
  getTariffs: jest.fn(), setTariffPrice: jest.fn(), unfeature: jest.fn(), applyFeature: jest.fn(), recordPurchase: jest.fn(),
}));
jest.mock('../src/repositories/creditConfigRepository', () => ({
  DEFAULTS: { signup_bonus: 5, maturation_days: 15 }, getAll: jest.fn(), set: jest.fn(),
}));
jest.mock('../src/services/creditMaturation', () => ({ processMaturedGrants: jest.fn(), reviewFlaggedGrant: jest.fn() }));
jest.mock('../src/services/orderDisputeService', () => ({ listDisputedOrders: jest.fn(), resolveDispute: jest.fn() }));
jest.mock('../src/services/orderAutoConfirm', () => ({ processAutoConfirmations: jest.fn() }));
jest.mock('../src/repositories/creditBonusGrantRepository', () => ({ findFlaggedGrants: jest.fn() }));
jest.mock('../src/services/privateDocuments', () => ({
  getDocumentUrl: jest.fn(), resolveSignedLocalDocument: jest.fn(), LINK_TTL_SECONDS: 300,
}));

const db = require('../src/db');
const analytics = require('../src/services/analyticsSnapshot');
const featured = require('../src/services/featured');
const creditConfig = require('../src/repositories/creditConfigRepository');
const maturation = require('../src/services/creditMaturation');
const disputes = require('../src/services/orderDisputeService');
const autoConfirm = require('../src/services/orderAutoConfirm');
const grants = require('../src/repositories/creditBonusGrantRepository');
const docs = require('../src/services/privateDocuments');

const norm = (sql) => sql.replace(/\s+/g, ' ').trim();
const fail = (msg = 'down') => new Error(msg);
const DOC = path.join(os.tmpdir(), `admin-char-${process.pid}.txt`);

function answer(sql, params) {
  const q = norm(sql);
  for (const [re, out] of mockRules) {
    if (re.test(q)) {
      const r = typeof out === 'function' ? out(params) : out;
      if (r instanceof Error) throw r;
      return r;
    }
  }
  return { rows: [], rowCount: 0 };
}

/** A service mock that logs its call; `out` is its result, or an Error to reject with. */
function service(mock, name, out) {
  mock.mockImplementation(async (...args) => {
    mockLog.push([name, ...args]);
    if (out instanceof Error) throw out;
    return typeof out === 'function' ? out(...args) : out;
  });
}

function wire() {
  db.query.mockImplementation(async (sql, params) => {
    mockLog.push(['query', norm(sql), params]);
    return answer(sql, params);
  });
  service(analytics.computeDaySnapshot, 'computeDaySnapshot', (d) => ({ date: d, visitors: 3, live: true }));
  service(analytics.backfillSnapshots, 'backfillSnapshots', [{}, {}, {}]);
  service(featured.getTariffs, 'getTariffs', [{ id: '7', days: 7, priceCents: 500, isDefault: true }]);
  service(featured.setTariffPrice, 'setTariffPrice', undefined);
  service(featured.unfeature, 'unfeature', (id) => ({ id, is_featured: false }));
  service(featured.applyFeature, 'applyFeature', (id, o) => ({ id, is_featured: true, ...o }));
  service(featured.recordPurchase, 'recordPurchase', undefined);
  service(creditConfig.getAll, 'creditConfig.getAll', [{ key: 'signup_bonus', value: 5, isDefault: true }]);
  service(creditConfig.set, 'creditConfig.set', undefined);
  service(maturation.processMaturedGrants, 'processMaturedGrants', { matured: 2, skipped: 1 });
  service(maturation.reviewFlaggedGrant, 'reviewFlaggedGrant', (id) => (id === 'g1' ? { grantId: 'g1', status: 'matured' } : null));
  service(disputes.listDisputedOrders, 'listDisputedOrders', [{ id: 'o1' }]);
  service(disputes.resolveDispute, 'resolveDispute', (id) => (id === 'o1' ? { orderId: 'o1', status: 'completed' } : null));
  service(autoConfirm.processAutoConfirmations, 'processAutoConfirmations', { confirmed: 1 });
  service(grants.findFlaggedGrants, 'findFlaggedGrants', [{ id: 'g1' }]);
  docs.getDocumentUrl.mockImplementation((u) => { mockLog.push(['getDocumentUrl', u]); return u ? `signed:${u}` : null; });
  docs.resolveSignedLocalDocument.mockImplementation((f, exp, sig) => {
    mockLog.push(['resolveSignedLocalDocument', f, exp, sig]);
    if (sig !== 'good') return null;
    return f === 'present.txt' ? DOC : path.join(os.tmpdir(), 'admin-char-missing-file.txt');
  });
}

let server;
let base;
beforeAll(async () => {
  fs.writeFileSync(DOC, 'documento');
  jest.useFakeTimers({
    now: new Date('2026-07-15T10:00:00Z'),
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval',
      'clearInterval', 'queueMicrotask', 'hrtime', 'performance'],
  });
  const app = express();
  app.use(express.json());
  app.set('broadcast', (msg) => mockLog.push(['broadcast', msg]));
  app.use('/api/admin', require('../src/modules/admin/admin.routes'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/admin`;
});
afterAll(async () => {
  jest.useRealTimers();
  fs.rmSync(DOC, { force: true });
  await new Promise((resolve) => server.close(resolve));
});
beforeEach(() => {
  mockLog.length = 0;
  mockRules.length = 0;
  jest.clearAllMocks();
  wire();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  console.error.mockRestore();
});

const rule = (re, out) => mockRules.push([re, out]);
async function call(method, p, { admin = 'a1', json } = {}) {
  const headers = {};
  if (admin) headers['x-admin'] = admin;
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  const res = await fetch(`${base}${p}`, { method, headers, body });
  const text = await res.text();
  await new Promise((r) => setImmediate(r));
  const out = { status: res.status, body: text, trace: mockLog.slice() };
  const cache = res.headers.get('cache-control');
  if (cache) out.cacheControl = cache;
  return out;
}
const snap = async (...args) => expect(await call(...args)).toMatchSnapshot();

// ─── guard ──────────────────────────────────────────────────────────────────
test('every admin route but the signed document link requires an admin', async () => {
  const routes = [
    ['GET', '/stats'], ['GET', '/users/detailed'], ['GET', '/users/u1/history'], ['GET', '/users'], ['GET', '/users/u1'],
    ['GET', '/users/u1/documents'], ['GET', '/users/u1/activity'], ['PATCH', '/users/u1'], ['GET', '/wallet/transactions'],
    ['GET', '/credit-config'], ['PUT', '/credit-config/signup_bonus'], ['GET', '/featured-tariffs'], ['PUT', '/featured-tariffs/7'],
    ['POST', '/credit-bonus-grants/mature-now'], ['GET', '/credit-bonus-grants/flagged'], ['POST', '/credit-bonus-grants/g1/review'],
    ['POST', '/orders/auto-confirm-now'], ['GET', '/orders/disputed'], ['POST', '/orders/o1/dispute-resolution'],
    ['GET', '/payouts'], ['POST', '/payouts/o1/mark-paid'], ['POST', '/payouts/o1/unmark'], ['POST', '/payouts/o1/archive'],
    ['GET', '/archive'], ['GET', '/analytics/interactions'], ['GET', '/analytics/overview'], ['GET', '/analytics/sessions'],
    ['GET', '/analytics/behavior'], ['GET', '/listings'], ['POST', '/listings/l1/hide'], ['POST', '/listings/l1/unhide'],
    ['DELETE', '/listings/l1'], ['POST', '/listings/l1/feature'], ['POST', '/listings/l1/restore'],
    ['GET', '/analytics/calendar'], ['GET', '/analytics/day'], ['POST', '/analytics/snapshot/backfill'],
  ];
  const out = [];
  for (const [m, p] of routes) out.push(`${m} ${p} ${(await call(m, p, { admin: null, json: m === 'GET' ? undefined : {} })).status}`);
  expect(out).toMatchSnapshot();
  expect(mockLog).toEqual([]);
});

test('an unknown admin path falls through (404 from Express, no guard)', async () => {
  await snap('GET', '/nope', { admin: null });
});

// ─── stats ──────────────────────────────────────────────────────────────────
describe('GET /stats', () => {
  test('ok', async () => {
    rule(/FROM users$/, { rows: [{ total_users: 10 }] });
    rule(/FROM listings$/, { rows: [{ total_listings: 4 }] });
    rule(/FROM orders$/, { rows: [{ total_orders: 2 }] });
    rule(/FROM reviews$/, { rows: [{ total_reviews: 1 }] });
    rule(/FROM master_sets$/, { rows: [{ total_sets: 99 }] });
    await snap('GET', '/stats');
  });
  test('error', async () => {
    rule(/FROM reviews$/, fail());
    await snap('GET', '/stats');
  });
});

// ─── users ──────────────────────────────────────────────────────────────────
describe('users', () => {
  test.each([
    ['defaults', ''],
    ['country, role, page and limit', '?country=it&role=admin&page=3&limit=5'],
    ['role only', '?role=user'],
  ])('GET /users/detailed %s', async (_, qs) => {
    rule(/^SELECT COUNT\(\*\) FROM users/, { rows: [{ count: '41' }] });
    rule(/FROM users u WHERE/, { rows: [{ id: 'u1' }] });
    rule(/GROUP BY UPPER\(address_country\)/, { rows: [{ country: 'IT', user_count: 3 }] });
    await snap('GET', `/users/detailed${qs}`);
  });
  test('GET /users/detailed error', async () => {
    rule(/^SELECT COUNT/, fail());
    await snap('GET', '/users/detailed');
  });

  test('GET /users/:id/history', async () => {
    rule(/FROM bids b JOIN listings/, { rows: [{ id: 'b1' }] });
    rule(/GROUP BY l.theme/, { rows: [{ theme: 'Star Wars', sales_count: 2 }] });
    rule(/AVG\(amount\)/, { rows: [{ avg_bid_amount: '12.50' }] });
    await snap('GET', '/users/u1/history');
  });
  test('GET /users/:id/history without bids', async () => {
    await snap('GET', '/users/u1/history');
  });
  test('GET /users/:id/history error', async () => {
    rule(/AVG\(amount\)/, fail());
    await snap('GET', '/users/u1/history');
  });

  test.each([
    ['defaults', ''],
    ['search and paging', '?search=mar&limit=500&offset=20'],
    ['bad numbers', '?limit=abc&offset=xyz'],
  ])('GET /users %s', async (_, qs) => {
    rule(/LEFT JOIN public.user_wallets w/, { rows: [
      { id: 'u1', username: 'mario', email: 'm@x', role: 'user', is_active: true, created_at: 'c', balance_credits: '10.50', wallet_updated_at: 'w' },
      { id: 'u2', username: 'luigi', email: 'l@x', role: 'admin', is_active: false, created_at: 'c', balance_credits: null, wallet_updated_at: null },
    ] });
    rule(/^SELECT COUNT\(\*\)::int AS total FROM users/, { rows: [{ total: 2 }] });
    await snap('GET', `/users${qs}`);
  });
  test('GET /users with no count row', async () => {
    await snap('GET', '/users');
  });
  test('GET /users error', async () => {
    rule(/LEFT JOIN public.user_wallets w/, fail());
    await snap('GET', '/users');
  });

  test('GET /users/:id', async () => {
    rule(/WHERE u.id = \$1/, { rows: [{
      id: 'u1', username: 'mario', email: 'm@x', full_name: 'Mario', avatar_url: 'a', role: 'user', is_active: true,
      account_status: null, is_verified: true, is_pro: false, seller_type: 'private', company_name: null,
      address_country: 'IT', city: 'Roma', rating_avg: '4.50', rating_count: 3, sales_count: 2, created_at: 'c', balance_credits: '7',
    }] });
    await snap('GET', '/users/u1');
  });
  test('GET /users/:id with null numbers', async () => {
    rule(/WHERE u.id = \$1/, { rows: [{ id: 'u1', account_status: 'banned', rating_avg: null, balance_credits: null }] });
    await snap('GET', '/users/u1');
  });
  test('GET /users/:id not found', async () => {
    await snap('GET', '/users/u1');
  });
  test('GET /users/:id error', async () => {
    rule(/WHERE u.id = \$1/, fail());
    await snap('GET', '/users/u1');
  });

  test('GET /users/:id/documents', async () => {
    rule(/SELECT id_scan_url/, { rows: [{ id_scan_url: 'private/id.jpg', business_license_url: null }] });
    await snap('GET', '/users/u1/documents');
  });
  test('GET /users/:id/documents not found', async () => {
    await snap('GET', '/users/u1/documents');
  });
  test('GET /users/:id/documents error', async () => {
    rule(/SELECT id_scan_url/, fail());
    await snap('GET', '/users/u1/documents');
  });

  test.each([
    ['valid link', '/documents/present.txt?exp=1&sig=good'],
    ['bad signature', '/documents/present.txt?exp=1&sig=bad'],
    ['file gone', '/documents/missing.txt?exp=1&sig=good'],
  ])('GET /documents/:filename %s (no bearer)', async (_, p) => {
    await snap('GET', p, { admin: null });
  });

  test('GET /users/:id/activity', async () => {
    rule(/FROM analytics_sessions WHERE user_id/, { rows: [{ session_count: 4, total_time_seconds: 300, first_seen_at: 'f', last_seen_at: 'l' }] });
    rule(/AS total_pageviews/, { rows: [{ total_pageviews: 12 }] });
    rule(/GROUP BY p.path/, { rows: [{ path: '/', views: 5 }] });
    await snap('GET', '/users/u1/activity');
  });
  test('GET /users/:id/activity error', async () => {
    rule(/AS total_pageviews/, fail());
    await snap('GET', '/users/u1/activity');
  });

  test.each([
    ['empty body', 'u1', {}],
    ['unknown field', 'u1', { role: 'admin', foo: 1 }],
    ['bad role', 'u1', { role: 'root' }],
    ['ban self', 'a1', { status: 'banned' }],
    ['demote self', 'a1', { role: 'user' }],
    ['self, harmless', 'a1', { role: 'admin', status: 'active' }],
    ['role only', 'u1', { role: 'admin' }],
    ['status only', 'u1', { status: 'banned' }],
    ['both', 'u1', { role: 'user', status: 'deleted' }],
    ['not found', 'zz', { status: 'active' }],
  ])('PATCH /users/:id %s', async (_, id, json) => {
    rule(/^UPDATE users SET/, (p) => (p.at(-1) === 'zz' ? { rows: [] }
      : { rows: [{ id: p.at(-1), username: 'mario', role: 'user', is_active: false, account_status: 'banned', extra: 1 }] }));
    await snap('PATCH', `/users/${id}`, { json });
  });
  test('PATCH /users/:id error', async () => {
    rule(/^UPDATE users SET/, fail());
    await snap('PATCH', '/users/u1', { json: { role: 'admin' } });
  });
});

// ─── wallet ─────────────────────────────────────────────────────────────────
describe('GET /wallet/transactions', () => {
  test.each([
    ['defaults', ''],
    ['one user, paged', '?userId=u1&limit=1000&offset=5'],
  ])('%s', async (_, qs) => {
    rule(/FROM public.credit_transactions ct JOIN users/, { rows: [
      { id: 't1', user_id: 'u1', username: 'mario', email: 'm@x', amount: '5.00', type: 'bonus', reference_id: 'r', created_at: 'c', current_balance: '10' },
      { id: 't2', user_id: 'u2', username: 'luigi', email: 'l@x', amount: '-2', type: 'entry', reference_id: null, created_at: 'c', current_balance: null },
    ] });
    rule(/SELECT COUNT\(\*\)::int AS total FROM public.credit_transactions/, { rows: [{ total: 2 }] });
    await snap('GET', `/wallet/transactions${qs}`);
  });
  test('error', async () => {
    rule(/FROM public.credit_transactions ct JOIN users/, fail());
    await snap('GET', '/wallet/transactions');
  });
});

// ─── credits ────────────────────────────────────────────────────────────────
describe('credits', () => {
  test('GET /credit-config', async () => { await snap('GET', '/credit-config'); });
  test('GET /credit-config error', async () => {
    service(creditConfig.getAll, 'creditConfig.getAll', fail());
    await snap('GET', '/credit-config');
  });
  test.each([
    ['unknown key', 'nope', { value: 3 }],
    ['negative', 'signup_bonus', { value: -1 }],
    ['not a number', 'signup_bonus', { value: 'abc' }],
    ['ok', 'signup_bonus', { value: '7.5' }],
    ['zero', 'maturation_days', { value: 0 }],
  ])('PUT /credit-config/:key %s', async (_, key, json) => {
    await snap('PUT', `/credit-config/${key}`, { json });
  });
  test('PUT /credit-config/:key error', async () => {
    service(creditConfig.set, 'creditConfig.set', fail());
    await snap('PUT', '/credit-config/signup_bonus', { json: { value: 1 } });
  });

  test('POST /credit-bonus-grants/mature-now', async () => { await snap('POST', '/credit-bonus-grants/mature-now'); });
  test('POST /credit-bonus-grants/mature-now error', async () => {
    service(maturation.processMaturedGrants, 'processMaturedGrants', fail());
    await snap('POST', '/credit-bonus-grants/mature-now');
  });
  test('GET /credit-bonus-grants/flagged', async () => { await snap('GET', '/credit-bonus-grants/flagged'); });
  test('GET /credit-bonus-grants/flagged error', async () => {
    service(grants.findFlaggedGrants, 'findFlaggedGrants', fail());
    await snap('GET', '/credit-bonus-grants/flagged');
  });
  test.each([
    ['bad decision', 'g1', { decision: 'maybe' }],
    ['approve', 'g1', { decision: 'approve' }],
    ['reject, not found', 'g9', { decision: 'reject' }],
  ])('POST /credit-bonus-grants/:id/review %s', async (_, id, json) => {
    await snap('POST', `/credit-bonus-grants/${id}/review`, { json });
  });
  test('POST /credit-bonus-grants/:id/review error', async () => {
    service(maturation.reviewFlaggedGrant, 'reviewFlaggedGrant', fail());
    await snap('POST', '/credit-bonus-grants/g1/review', { json: { decision: 'approve' } });
  });
});

// ─── featured tariffs ───────────────────────────────────────────────────────
describe('featured tariffs', () => {
  test('GET', async () => { await snap('GET', '/featured-tariffs'); });
  test('GET error', async () => {
    service(featured.getTariffs, 'getTariffs', fail());
    await snap('GET', '/featured-tariffs');
  });
  test.each([
    ['unknown tariff', '99', { priceCents: 500 }],
    ['too cheap', '7', { priceCents: 49 }],
    ['not an integer', '7', { priceCents: 5.5 }],
    ['missing', '7', {}],
    ['ok', '14', { priceCents: '1200' }],
  ])('PUT %s', async (_, id, json) => {
    await snap('PUT', `/featured-tariffs/${id}`, { json });
  });
  test('PUT error', async () => {
    service(featured.setTariffPrice, 'setTariffPrice', fail());
    await snap('PUT', '/featured-tariffs/7', { json: { priceCents: 500 } });
  });
});

// ─── orders ─────────────────────────────────────────────────────────────────
describe('orders and payouts', () => {
  test('POST /orders/auto-confirm-now', async () => { await snap('POST', '/orders/auto-confirm-now'); });
  test('POST /orders/auto-confirm-now error', async () => {
    service(autoConfirm.processAutoConfirmations, 'processAutoConfirmations', fail());
    await snap('POST', '/orders/auto-confirm-now');
  });
  test('GET /orders/disputed', async () => { await snap('GET', '/orders/disputed'); });
  test('GET /orders/disputed error', async () => {
    service(disputes.listDisputedOrders, 'listDisputedOrders', fail());
    await snap('GET', '/orders/disputed');
  });
  test.each([
    ['bad outcome', 'o1', { outcome: 'keep' }],
    ['refund', 'o1', { outcome: 'refund' }],
    ['reject, not found', 'o9', { outcome: 'reject' }],
  ])('POST /orders/:id/dispute-resolution %s', async (_, id, json) => {
    await snap('POST', `/orders/${id}/dispute-resolution`, { json });
  });
  test('POST /orders/:id/dispute-resolution error', async () => {
    service(disputes.resolveDispute, 'resolveDispute', fail());
    await snap('POST', '/orders/o1/dispute-resolution', { json: { outcome: 'refund' } });
  });

  test.each([['default', ''], ['paid', '?status=paid'], ['archived', '?status=archived'], ['bogus', '?status=x']])('GET /payouts %s', async (_, qs) => {
    rule(/FROM orders o JOIN listings l ON l.id = o.listing_id/, { rows: [{
      id: 'o1', item_price: '10.00', shipping_cost: '5', seller_payout: '9.10', order_status: 'completed', payout_status: 'pending',
      payout_paid_at: null, payout_notes: null, created_at: 'c', listing_title: 'Falcon', set_number: '75192',
      seller_id: 's1', seller_username: 'mario', buyer_username: 'luigi',
    }] });
    await snap('GET', `/payouts${qs}`);
  });
  test('GET /payouts error', async () => {
    rule(/FROM orders o JOIN listings/, fail());
    await snap('GET', '/payouts');
  });
  test.each([
    ['mark-paid with notes', 'mark-paid', { notes: 'bonifico' }, true],
    ['mark-paid without notes', 'mark-paid', {}, true],
    ['mark-paid not pending', 'mark-paid', {}, false],
    ['unmark', 'unmark', {}, true],
    ['unmark not paid', 'unmark', {}, false],
    ['archive', 'archive', {}, true],
    ['archive not paid', 'archive', {}, false],
  ])('POST /payouts/:orderId/%s', async (_, action, json, found) => {
    rule(/^UPDATE orders SET payout_status/, { rows: found ? [{ id: 'o1' }] : [] });
    await snap('POST', `/payouts/o1/${action}`, { json });
  });
  test.each(['mark-paid', 'unmark', 'archive'])('POST /payouts/:orderId/%s error', async (action) => {
    rule(/^UPDATE orders SET payout_status/, fail());
    await snap('POST', `/payouts/o1/${action}`, { json: {} });
  });

  test('GET /archive', async () => {
    rule(/WHERE l.status IN \('sold', 'expired', 'removed'\)/, { rows: [{ id: 'l1', order_id: 'o1' }] });
    await snap('GET', '/archive');
  });
  test('GET /archive error', async () => {
    rule(/WHERE l.status IN/, fail());
    await snap('GET', '/archive');
  });
});

// ─── analytics ──────────────────────────────────────────────────────────────
describe('analytics', () => {
  test('GET /analytics/interactions', async () => {
    rule(/GROUP BY ub.id/, { rows: [{ buyer_id: 'b', trade_count: 2 }] });
    await snap('GET', '/analytics/interactions');
  });
  test('GET /analytics/interactions error', async () => {
    rule(/GROUP BY ub.id/, fail());
    await snap('GET', '/analytics/interactions');
  });

  const overview = (funnel, auth) => {
    rule(/AS last_30d FROM analytics_sessions/, { rows: [{ today: 1, last_7d: 5, last_30d: 9 }] });
    rule(/AS avg_duration_seconds FROM analytics_sessions/, { rows: [{ today: 2, last_7d: 6, avg_duration_seconds: 40 }] });
    rule(/^SELECT COUNT\(\*\) FILTER \(WHERE viewed_at/, { rows: [{ today: 3, last_7d: 30 }] });
    rule(/^SELECT path, COUNT\(\*\)::int AS count/, { rows: [{ path: '/', count: 20 }] });
    rule(/FROM users$/, { rows: [{ today: 0, last_7d: 1 }] });
    rule(/'registration_started'/, { rows: [funnel] });
    rule(/generate_series/, { rows: [{ date: '2026-07-14', visitors: 4, pageviews: 8 }] });
    rule(/COALESCE\(country, '\?\?'\)/, { rows: [{ country: 'IT', visitors: 7 }] });
    rule(/^WITH visited AS/, { rows: [auth] });
  };
  test('GET /analytics/overview', async () => {
    overview({ started: 7, completed: 3 }, { total_visitors: 9, authenticated_visitors: 2 });
    await snap('GET', '/analytics/overview');
  });
  test('GET /analytics/overview with no traffic', async () => {
    overview({ started: 0, completed: 0 }, { total_visitors: 0, authenticated_visitors: 0 });
    await snap('GET', '/analytics/overview');
  });
  test('GET /analytics/overview error', async () => {
    rule(/generate_series/, fail());
    await snap('GET', '/analytics/overview');
  });

  test.each([['default', ''], ['capped', '?limit=999'], ['bad', '?limit=abc'], ['small', '?limit=3']])('GET /analytics/sessions %s', async (_, qs) => {
    rule(/FROM analytics_sessions s LEFT JOIN users/, { rows: [{ id: 's1' }] });
    await snap('GET', `/analytics/sessions${qs}`);
  });
  test('GET /analytics/sessions error', async () => {
    rule(/FROM analytics_sessions s LEFT JOIN users/, fail());
    await snap('GET', '/analytics/sessions');
  });

  test('GET /analytics/behavior', async () => {
    rule(/^WITH page_durations/, { rows: [{ path: '/', views: 3, avg_duration_seconds: 20 }] });
    rule(/GROUP BY target_label, target_type/, { rows: [{ target_label: 'Vendi', count: 4 }] });
    rule(/GROUP BY path, target_label/, { rows: [{ path: '/', target_label: 'Vendi', count: 2 }] });
    await snap('GET', '/analytics/behavior');
  });
  test('GET /analytics/behavior error', async () => {
    rule(/GROUP BY path, target_label/, fail());
    await snap('GET', '/analytics/behavior');
  });

  test.each([
    ['bad params', '?year=x&month=7', null],
    ['month 13', '?year=2026&month=13', null],
    ['past month', '?year=2026&month=6', [{ date: '2026-06-01', visitors: 1 }]],
    ['current month adds today live', '?year=2026&month=7', [{ date: '2026-07-14', visitors: 2 }]],
    ['current month already has today', '?year=2026&month=7', [{ date: '2026-07-15', visitors: 2 }]],
  ])('GET /analytics/calendar %s', async (_, qs, rows) => {
    if (rows) rule(/FROM analytics_daily_snapshots WHERE date >=/, { rows });
    await snap('GET', `/analytics/calendar${qs}`);
  });
  test('GET /analytics/calendar error', async () => {
    rule(/FROM analytics_daily_snapshots WHERE date >=/, fail());
    await snap('GET', '/analytics/calendar?year=2026&month=6');
  });

  test.each([
    ['bad date', '?date=15-07-2026', null],
    ['missing date', '', null],
    ['stored', '?date=2026-07-01', [{ date: '2026-07-01', visitors: 4 }]],
    ['computed live', '?date=2026-07-15', []],
  ])('GET /analytics/day %s', async (_, qs, rows) => {
    if (rows) rule(/FROM analytics_daily_snapshots WHERE date = \$1/, { rows });
    await snap('GET', `/analytics/day${qs}`);
  });
  test('GET /analytics/day error', async () => {
    rule(/FROM analytics_daily_snapshots WHERE date = \$1/, fail());
    await snap('GET', '/analytics/day?date=2026-07-01');
  });

  test.each([
    ['bad date', { fromDate: 'yesterday' }],
    ['no body', undefined],
    ['ok', { fromDate: '2026-07-01' }],
  ])('POST /analytics/snapshot/backfill %s', async (_, json) => {
    await snap('POST', '/analytics/snapshot/backfill', { json });
  });
  test('POST /analytics/snapshot/backfill error', async () => {
    service(analytics.backfillSnapshots, 'backfillSnapshots', fail());
    await snap('POST', '/analytics/snapshot/backfill', { json: { fromDate: '2026-07-01' } });
  });
});

// ─── listings moderation ────────────────────────────────────────────────────
describe('listings moderation', () => {
  test.each([
    ['defaults', ''],
    ['every filter', '?search=fal&featured=true&status=hidden&type=auction&limit=500&offset=10'],
    ['not featured, fixed, status all', '?featured=false&type=fixed&status=all'],
    ['bad numbers', '?limit=x&offset=y'],
  ])('GET /listings %s', async (_, qs) => {
    rule(/LEFT JOIN users hb/, { rows: [{ id: 'l1' }] });
    await snap('GET', `/listings${qs}`);
  });
  test('GET /listings error', async () => {
    rule(/LEFT JOIN users hb/, fail());
    await snap('GET', '/listings');
  });

  const hideOrRemove = [
    ['hide', 'POST', '/listings/l1/hide', /SET status = 'hidden'/],
    ['delete', 'DELETE', '/listings/l1', /SET status = 'removed'/],
  ];
  test.each(hideOrRemove)('%s needs a reason', async (_, m, p) => {
    await snap(m, p, { json: { reason: '   ' } });
  });
  test.each(hideOrRemove)('%s without a body', async (_, m, p) => {
    await snap(m, p);
  });
  test.each(hideOrRemove)('%s ok: notifies the seller and broadcasts', async (_, m, p, re) => {
    rule(re, { rows: [{ id: 'l1', seller_id: 's1', status: 'x' }] });
    await snap(m, p, { json: { reason: '  Foto non sue  ' } });
  });
  test.each(hideOrRemove)('%s: a failed notification does not fail the request', async (_, m, p, re) => {
    rule(re, { rows: [{ id: 'l1', seller_id: 's1' }] });
    rule(/^INSERT INTO notifications/, fail('notif down'));
    await snap(m, p, { json: { reason: 'spam' } });
  });
  test.each(hideOrRemove)('%s: not found', async (_, m, p) => {
    await snap(m, p, { json: { reason: 'spam' } });
  });
  test.each(hideOrRemove)('%s: error', async (_, m, p, re) => {
    rule(re, fail());
    await snap(m, p, { json: { reason: 'spam' } });
  });

  test.each([
    ['unhide', '/listings/l1/unhide', /WHERE id = \$1 AND status = 'hidden'/],
    ['restore', '/listings/l1/restore', /WHERE id = \$1 RETURNING \*/],
  ])('%s', async (_, p, re) => {
    rule(re, { rows: [{ id: 'l1', status: 'active' }] });
    await snap('POST', p);
  });
  test.each(['/listings/l1/unhide', '/listings/l1/restore'])('%s not found', async (p) => {
    await snap('POST', p);
  });
  test.each([
    ['/listings/l1/unhide', /status = 'hidden'/],
    ['/listings/l1/restore', /RETURNING \*/],
  ])('%s error', async (p, re) => {
    rule(re, fail());
    await snap('POST', p);
  });

  test.each([
    ['unfeature', { unfeature: true }],
    ['pin', { pin: true }],
    ['days', { days: '30' }],
    ['days zero', { days: 0 }],
    ['days too many', { days: 366 }],
    ['no body', undefined],
  ])('POST /listings/:id/feature %s', async (_, json) => {
    rule(/^SELECT id FROM listings/, { rows: [{ id: 'l1' }] });
    await snap('POST', '/listings/l1/feature', { json });
  });
  test('POST /listings/:id/feature: a failed purchase record is ignored', async () => {
    rule(/^SELECT id FROM listings/, { rows: [{ id: 'l1' }] });
    service(featured.recordPurchase, 'recordPurchase', fail());
    await snap('POST', '/listings/l1/feature', { json: { days: 7 } });
  });
  test('POST /listings/:id/feature not found', async () => {
    await snap('POST', '/listings/l1/feature', { json: { pin: true } });
  });
  test('POST /listings/:id/feature error', async () => {
    rule(/^SELECT id FROM listings/, { rows: [{ id: 'l1' }] });
    service(featured.applyFeature, 'applyFeature', fail());
    await snap('POST', '/listings/l1/feature', { json: { pin: true } });
  });
});
