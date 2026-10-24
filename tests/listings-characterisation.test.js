// Characterisation of every /api/listings endpoint, pinned before the route file was split into
// src/modules/listings/ (routes -> controller -> service -> repository). Each case records, in order:
// every SQL statement with its parameters, every call to a collaborator (image upload, IndexNow, auction
// and featured expiry, Stripe, live broadcast), and the exact status + response text. The snapshot was
// written against the old src/routes/listings.js; the refactor must reproduce it exactly.
// The DB, Stripe and the services that talk to the outside are mocked; validation and mapping are real.
const http = require('http');
const express = require('express');

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

const mockLog = [];
const sqlRules = [];
const mockStripe = {
  paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
};

jest.mock('stripe', () => jest.fn(() => mockStripe));
jest.mock('../src/db', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('../src/middleware/auth', () => (req, res, next) => {
  if (!req.headers['x-user']) return res.status(401).json({ error: 'test: no user' });
  req.user = { userId: req.headers['x-user'], role: 'user' };
  next();
});
// A pure read of the request: checked on its own (see GET /:id), kept out of the ordered trace.
jest.mock('../src/utils/authToken', () => ({
  optionalUserId: jest.fn((req) => req.headers['x-user'] || null),
}));
jest.mock('../src/services/image', () => ({ uploadOrSaveProcessedImage: jest.fn() }));
jest.mock('../src/integrations/indexnow', () => ({ notifyListingChanged: jest.fn() }));
jest.mock('../src/services/auctionExpiry', () => ({ expireEndedAuctions: jest.fn() }));
jest.mock('../src/services/featured', () => ({
  expireFeaturedListings: jest.fn(),
  getTariffs: jest.fn(),
  getTariff: jest.fn(),
  purchaseExists: jest.fn(),
  applyFeature: jest.fn(),
  recordPurchase: jest.fn(),
}));

const db = require('../src/db');
const image = require('../src/services/image');
const indexnow = require('../src/integrations/indexnow');
const auctionExpiry = require('../src/services/auctionExpiry');
const featured = require('../src/services/featured');
const { optionalUserId } = require('../src/utils/authToken');

const DAY = 24 * 60 * 60 * 1000;
const FUTURE = '2099-01-01T00:00:00.000Z';
const PAST = '2001-01-01T00:00:00.000Z';

/** Dates near "now" become relative markers so the snapshot doesn't depend on the clock. */
function clean(v) {
  if (v instanceof Date) {
    const diff = v.getTime() - Date.now();
    return Math.abs(diff) < DAY ? `<now${diff >= 0 ? '+' : ''}${Math.round(diff / 60000)}min>` : v.toISOString();
  }
  if (Array.isArray(v)) return v.map(clean);
  return v;
}
const norm = (sql) => sql.replace(/\s+/g, ' ').trim();

/** rules: [[regex, result | (params) => result | Error]]; first match wins, default is no rows. */
function answer(sql, params) {
  const q = norm(sql);
  for (const [re, out] of sqlRules) {
    if (re.test(q)) {
      const r = typeof out === 'function' ? out(params) : out;
      if (r instanceof Error) throw r;
      return r;
    }
  }
  return { rows: [], rowCount: 0 };
}

function wire() {
  db.query.mockImplementation(async (sql, params) => {
    mockLog.push(['query', norm(sql), clean(params)]);
    return answer(sql, params);
  });
  db.getClient.mockImplementation(async () => {
    mockLog.push(['getClient']);
    return {
      query: jest.fn(async (sql, params) => {
        mockLog.push(['client.query', norm(sql), clean(params)]);
        return answer(sql, params);
      }),
      release: jest.fn((destroy) => mockLog.push(destroy ? ['release', 'destroyed'] : ['release'])),
    };
  });
  image.uploadOrSaveProcessedImage.mockImplementation(async (buf) => {
    mockLog.push(['uploadImage', buf.length]);
    if (buf.length === 13) throw new Error('sharp exploded');
    return `https://img.test/${buf.length}.webp`;
  });
  indexnow.notifyListingChanged.mockImplementation((id) => mockLog.push(['indexnow', id]));
  auctionExpiry.expireEndedAuctions.mockImplementation(async () => mockLog.push(['expireEndedAuctions']));
  featured.expireFeaturedListings.mockImplementation(async () => mockLog.push(['expireFeaturedListings']));
  featured.getTariffs.mockImplementation(async () => {
    mockLog.push(['getTariffs']);
    return [{ id: '7', days: 7, priceCents: 299, extra: 'x' }, { id: '30', days: 30, priceCents: 999, extra: 'y' }];
  });
  featured.getTariff.mockImplementation(async (id) => {
    mockLog.push(['getTariff', id]);
    return { 7: { id: '7', days: 7, priceCents: 299 } }[id] || null;
  });
  featured.purchaseExists.mockImplementation(async (ref) => {
    mockLog.push(['purchaseExists', ref]);
    return ref === 'pi_done';
  });
  featured.applyFeature.mockImplementation(async (id, opts) => {
    mockLog.push(['applyFeature', id, opts]);
    return { id, is_featured: true };
  });
  featured.recordPurchase.mockImplementation(async (p) => mockLog.push(['recordPurchase', p]));
  mockStripe.paymentIntents.create.mockImplementation(async (p) => {
    mockLog.push(['stripe.create', p]);
    if (p.metadata.listingId === 'boom') throw new Error('stripe down');
    return { client_secret: 'cs_123' };
  });
  mockStripe.paymentIntents.retrieve.mockImplementation(async (id) => {
    mockLog.push(['stripe.retrieve', id]);
    const base = { status: 'succeeded', amount: 250, metadata: { type: 'featured_listing', userId: 'u1', listingId: 'l1', tariff: '7' } };
    return {
      pi_ok: base,
      pi_done: base,
      pi_pending: { ...base, status: 'processing' },
      pi_other: { ...base, metadata: { ...base.metadata, userId: 'u2' } },
      pi_badtariff: { ...base, metadata: { ...base.metadata, tariff: '99' } },
    }[id] || (() => { throw new Error('no such intent'); })();
  });
}

let server;
let base;
function startApp(router) {
  const app = express();
  app.use(express.json());
  app.set('broadcast', (msg) => mockLog.push(['broadcast', msg]));
  app.use('/api/listings', router);
  const s = http.createServer(app);
  return new Promise((resolve) => s.listen(0, '127.0.0.1', () => resolve(s)));
}

beforeAll(async () => {
  server = await startApp(require('../src/modules/listings/listings.routes'));
  base = `http://127.0.0.1:${server.address().port}/api/listings`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  mockLog.length = 0;
  sqlRules.length = 0;
  jest.clearAllMocks();
  wire();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

/** One request -> the full trace. `files` are byte lengths sent as images[] (multipart). */
async function call(method, path, { user, json, form, files, url = base } = {}) {
  const headers = {};
  if (user) headers['x-user'] = user;
  let body;
  if (form || files) {
    body = new FormData();
    for (const [k, v] of Object.entries(form || {})) body.append(k, v);
    for (const n of files || []) body.append('images', new Blob([Buffer.alloc(n, 1)]), `p${n}.jpg`);
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  const res = await fetch(`${url}${path}`, { method, headers, body });
  const text = await res.text();
  // let fire-and-forget work queued before the response settle into the mockLog
  await new Promise((r) => setImmediate(r));
  return { status: res.status, body: text, trace: mockLog.slice() };
}

const rule = (re, out) => sqlRules.push([re, out]);
const listingRow = (extra = {}) => ({
  id: 'l1', title: 'Falcon', status: 'active', type: 'used', seller_id: 'u1', shipping_options: null, package_size: 'M',
  seller_username: 'mario', seller_avatar: null, seller_rating: '4.0', seller_is_verified: true,
  seller_is_pro: false, seller_seller_type: 'private', seller_company_name: null, ...extra,
});

const PUBLISH = {
  title: 'Millennium Falcon', description: 'Bello', setNumber: '75192', theme: 'Star Wars', year: '2017', pieces: '7541',
  type: 'used', condition: 'complete', price: '599.90', shippingCost: '9.5', shippingMethod: 'brt',
  shippingOptions: '[{"carrier":"brt","price":9.5}]', category: 'sets', status: 'active', boxCondition: 'ok', isComplete: 'true',
};

// ─── POST / ───────────────────────────────────────────────────────────────
describe('POST /', () => {
  beforeEach(() => rule(/^INSERT INTO listings/, (p) => ({ rows: [{ id: 'new1', status: p[14], title: p[1] }] })));

  test.each([
    ['too many files -> multer error', { form: PUBLISH, files: Array(11).fill(5) }],
    ['draft without title', { json: { status: 'draft' } }],
    ['publish with a short title', { json: { ...PUBLISH, title: 'abc' } }],
    ['publish without category', { json: { ...PUBLISH, category: undefined } }],
    ['fixed price without price', { json: { ...PUBLISH, price: '' } }],
    ['auction without starting bid', { json: { ...PUBLISH, type: 'auction', price: '', auctionEnd: FUTURE } }],
    ['auction without end date', { json: { ...PUBLISH, type: 'auction', auctionStart: '10' } }],
    ['auction ending in the past', { json: { ...PUBLISH, type: 'auction', auctionStart: '10', auctionEnd: PAST } }],
    ['tcg without game', { json: { ...PUBLISH, productType: 'tcg', condition: 'near_mint' } }],
    ['grading company without grade', { json: { ...PUBLISH, productType: 'tcg', game: 'pokemon', condition: 'near_mint', cardGradingCompany: 'psa' } }],
    ['publish without images', { json: PUBLISH }],
    ['unknown condition', { json: { ...PUBLISH, condition: 'mint' } }],
  ])('rejected: %s', async (_, opts) => {
    expect(await call('POST', '', { user: 'u1', ...opts })).toMatchSnapshot();
  });

  test('publish a LEGO set with two photos', async () => {
    expect(await call('POST', '', { user: 'u1', form: PUBLISH, files: [100, 200] })).toMatchSnapshot();
  });

  test('publish a graded Pokémon card with explicit dimensions and orientation', async () => {
    expect(await call('POST', '', {
      user: 'u1',
      files: [50],
      form: {
        ...PUBLISH, productType: 'tcg', game: 'pokemon', condition: 'near_mint', category: 'sets',
        cardLanguage: 'it', cardRarity: ' Rara ', cardGradingCompany: 'psa', cardGrade: '10', cardSetId: 'sv1', cardNumber: '25', cardExternalId: 'sv1-25',
        weightKg: '0.05', lengthCm: '10', widthCm: '7', heightCm: '1', imageOrientation: 'landscape',
      },
    })).toMatchSnapshot();
  });

  test('publish an auction', async () => {
    expect(await call('POST', '', {
      user: 'u1', files: [10],
      form: { ...PUBLISH, type: 'auction', price: '', auctionStart: '20', auctionEnd: FUTURE, auctionReserve: '50', condition: 'new' },
    })).toMatchSnapshot();
  });

  test('save a draft: legacy type, coerced condition, broken shipping JSON, no photos, no IndexNow', async () => {
    expect(await call('POST', '', {
      user: 'u1',
      json: { title: 'x', status: 'draft', type: 'fixed', condition: 'parts', shippingOptions: '{oops', productType: 'funko', unknownField: 1 },
    })).toMatchSnapshot();
  });

  test('draft with every condition alias', async () => {
    const out = [];
    for (const condition of ['new', 'used', 'good', 'fair', 'complete', 'moderately_played']) {
      mockLog.length = 0;
      const r = await call('POST', '', { user: 'u1', json: { title: 'x', status: 'draft', condition } });
      out.push([condition, r.status, r.trace.find((e) => e[0] === 'query')[2][8]]);
    }
    expect(out).toMatchSnapshot();
  });

  test('image processing fails', async () => {
    expect(await call('POST', '', { user: 'u1', form: PUBLISH, files: [100, 13] })).toMatchSnapshot();
  });

  test('the INSERT fails', async () => {
    sqlRules.length = 0;
    rule(/^INSERT INTO listings/, Object.assign(new Error('value too long'), { code: '22001', detail: 'd' }));
    expect(await call('POST', '', { user: 'u1', form: PUBLISH, files: [100] })).toMatchSnapshot();
  });

  test('without a user the auth guard answers', async () => {
    expect(await call('POST', '', { json: PUBLISH })).toMatchSnapshot();
  });
});

// ─── GET /user/me ─────────────────────────────────────────────────────────
describe('GET /user/me', () => {
  test('own listings', async () => {
    rule(/FROM listings WHERE seller_id/, { rows: [{ id: 'a' }, { id: 'b' }] });
    expect(await call('GET', '/user/me', { user: 'u1' })).toMatchSnapshot();
  });
  test('DB error', async () => {
    rule(/FROM listings WHERE seller_id/, new Error('down'));
    expect(await call('GET', '/user/me', { user: 'u1' })).toMatchSnapshot();
  });
});

// ─── GET / (feed) ─────────────────────────────────────────────────────────
describe('GET / feed', () => {
  beforeEach(() => rule(/FROM listings l JOIN users u/, { rows: [listingRow(), listingRow({ id: 'l2', seller_is_verified: null })] }));
  test.each([
    ['default', ''],
    ['status=all', '?status=all'],
    ['status=sold', '?status=sold'],
    ['status=draft falls back to active', '?status=draft'],
    ['status empty', '?status='],
    ['auctions, sorted by end', '?is_auction=true&sort=auction'],
    ['not auctions', '?is_auction=false'],
    ['featured only', '?is_featured=true'],
    ['not featured', '?is_featured=false'],
    ['every filter', '?type=used&theme=Star&category=sets&product_type=tcg&game=pokemon&card_set=sv1&limit=12'],
    ['malformed card_set ignored', "?card_set=sv1';drop"],
    ['bad limits ignored', '?limit=abc'],
    ['zero limit ignored', '?limit=0'],
  ])('%s', async (_, qs) => {
    expect(await call('GET', qs)).toMatchSnapshot();
  });
  test('DB error', async () => {
    sqlRules.length = 0;
    rule(/FROM listings l JOIN users u/, new Error('down'));
    expect(await call('GET', '')).toMatchSnapshot();
  });
});

// ─── GET /archive, /search ────────────────────────────────────────────────
describe('GET /archive and /search', () => {
  test('archive', async () => {
    rule(/FROM listings l JOIN users u/, { rows: [listingRow({ status: 'sold' })] });
    expect(await call('GET', '/archive')).toMatchSnapshot();
  });
  test('archive DB error', async () => {
    rule(/FROM listings l JOIN users u/, new Error('down'));
    expect(await call('GET', '/archive')).toMatchSnapshot();
  });
  test('search without q', async () => {
    expect(await call('GET', '/search')).toMatchSnapshot();
  });
  test('search', async () => {
    rule(/FROM listings l JOIN users u/, { rows: [listingRow()] });
    expect(await call('GET', '/search?q=fal%25con')).toMatchSnapshot();
  });
  test('search DB error', async () => {
    rule(/FROM listings l JOIN users u/, new Error('down'));
    expect(await call('GET', '/search?q=x')).toMatchSnapshot();
  });
});

// ─── featured ─────────────────────────────────────────────────────────────
describe('featured', () => {
  test('tariffs', async () => {
    expect(await call('GET', '/featured/tariffs')).toMatchSnapshot();
  });

  test.each([
    ['wallet method refused', 'l1', { tariff: '7', method: 'wallet' }, null],
    ['unknown tariff', 'l1', { tariff: '99', method: 'card' }, null],
    ['unknown listing', 'l1', { tariff: '7', method: 'card' }, { rows: [] }],
    ['not the owner', 'l1', { tariff: '7', method: 'card' }, { rows: [{ id: 'l1', seller_id: 'u2', status: 'active' }] }],
    ['not active', 'l1', { tariff: '7', method: 'card' }, { rows: [{ id: 'l1', seller_id: 'u1', status: 'draft' }] }],
    ['payment intent created', 'l1', { tariff: '7', method: 'card' }, { rows: [{ id: 'l1', seller_id: 'u1', status: 'active' }] }],
    ['Stripe fails', 'boom', { tariff: '7', method: 'card' }, { rows: [{ id: 'boom', seller_id: 'u1', status: 'active' }] }],
    ['no body', 'l1', undefined, null],
  ])('POST /:id/feature: %s', async (_, id, json, listing) => {
    if (listing) rule(/SELECT id, seller_id, status FROM listings/, listing);
    expect(await call('POST', `/${id}/feature`, { user: 'u1', json })).toMatchSnapshot();
  });

  test.each([
    ['missing intent id', {}],
    ['payment not completed', { paymentIntentId: 'pi_pending' }],
    ['someone else\'s payment', { paymentIntentId: 'pi_other' }],
    ['tariff gone', { paymentIntentId: 'pi_badtariff' }],
    ['first confirmation applies the feature', { paymentIntentId: 'pi_ok' }],
    ['already applied (webhook first)', { paymentIntentId: 'pi_done' }],
    ['Stripe error', { paymentIntentId: 'pi_unknown' }],
  ])('POST /:id/confirm-feature: %s', async (_, json) => {
    rule(/^SELECT \* FROM listings WHERE id = \$1$/, { rows: [{ id: 'l1', is_featured: true, from: 'db' }] });
    expect(await call('POST', '/l1/confirm-feature', { user: 'u1', json })).toMatchSnapshot();
  });

  test('without Stripe configured both payment routes answer 503 (after the cheap checks)', async () => {
    let router;
    const saved = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    jest.isolateModules(() => { router = require('../src/modules/listings/listings.routes'); });
    process.env.STRIPE_SECRET_KEY = saved;
    const s = await startApp(router);
    const url = `http://127.0.0.1:${s.address().port}/api/listings`;
    try {
      rule(/SELECT id, seller_id, status FROM listings/, { rows: [{ id: 'l1', seller_id: 'u1', status: 'active' }] });
      const out = [
        await call('POST', '/l1/feature', { user: 'u1', json: { tariff: '7', method: 'wallet' }, url }),
        await call('POST', '/l1/feature', { user: 'u1', json: { tariff: '7', method: 'card' }, url }),
        await call('POST', '/l1/confirm-feature', { user: 'u1', json: {}, url }),
      ];
      expect(out).toMatchSnapshot();
    } finally {
      await new Promise((r) => s.close(r));
    }
  });
});

// ─── GET /:id ─────────────────────────────────────────────────────────────
describe('GET /:id', () => {
  const detail = listingRow({
    highest_bidder_username: 'luigi', package_size: 'M',
    shipping_options: [{ carrier: 'brt', price: 9.5 }],
  });
  test('anonymous visitor', async () => {
    rule(/FROM listings l JOIN users u/, { rows: [detail] });
    expect(await call('GET', '/l1')).toMatchSnapshot();
  });
  test('logged-in buyer abroad', async () => {
    rule(/FROM listings l JOIN users u/, { rows: [detail] });
    rule(/SELECT address_country FROM users/, { rows: [{ address_country: 'de' }] });
    expect(await call('GET', '/l1', { user: 'u9' })).toMatchSnapshot();
  });
  test('buyer without a country', async () => {
    rule(/FROM listings l JOIN users u/, { rows: [detail] });
    rule(/SELECT address_country FROM users/, { rows: [{ address_country: null }] });
    expect(await call('GET', '/l1', { user: 'u9' })).toMatchSnapshot();
  });
  test('buyer lookup failing is ignored', async () => {
    rule(/FROM listings l JOIN users u/, { rows: [detail] });
    rule(/SELECT address_country FROM users/, new Error('down'));
    expect(await call('GET', '/l1', { user: 'u9' })).toMatchSnapshot();
  });
  test('view counter failing does not matter', async () => {
    rule(/FROM listings l JOIN users u/, { rows: [detail] });
    rule(/^UPDATE listings SET views_count/, new Error('down'));
    expect(await call('GET', '/l1')).toMatchSnapshot();
  });
  test('the buyer is read from a Bearer token only', async () => {
    rule(/FROM listings l JOIN users u/, { rows: [detail] });
    optionalUserId.mockClear();
    await call('GET', '/l1', { user: 'u9' });
    expect(optionalUserId).toHaveBeenCalledTimes(1);
    expect(optionalUserId.mock.calls[0][1]).toEqual({ bearerOnly: true });
  });
  test('not found', async () => {
    expect(await call('GET', '/nope')).toMatchSnapshot();
  });
  test('DB error', async () => {
    rule(/FROM listings l JOIN users u/, new Error('down'));
    expect(await call('GET', '/l1')).toMatchSnapshot();
  });
});

// ─── PATCH /:id ───────────────────────────────────────────────────────────
describe('PATCH /:id', () => {
  const current = (row) => rule(/^SELECT status, type, auction_start, auction_end FROM listings/, { rows: row ? [row] : [] });
  beforeEach(() => rule(/^UPDATE listings SET/, (p) => ({ rows: [{ id: 'l1', params: p.length }] })));

  test.each([
    ['validation error', null, { title: 'abc' }],
    ['half-filled grading', null, { productType: 'tcg', cardGradingCompany: 'psa' }],
    ['nothing to update', { status: 'active', type: 'used' }, { unknown: 1 }],
    ['not the owner', null, { title: 'Nuovo titolo' }],
    ['plain fields, weight drives package size, shipping options', { status: 'active', type: 'used' },
      { title: 'Nuovo titolo', price: 12, weightKg: 2.5, shippingOptions: '[{"c":1}]', isComplete: true, productType: 'lego' }],
    ['broken shipping JSON and blank shipping options', { status: 'active', type: 'used' }, { shippingOptions: '{x' }],
    ['empty shipping options', { status: 'active', type: 'used' }, { shippingOptions: '' }],
    ['live auction terms are dropped', { status: 'active', type: 'auction', auction_start: 5, auction_end: FUTURE },
      { type: 'used', auctionStart: 9, auctionEnd: FUTURE, title: 'Nuovo titolo' }],
    ['draft auction published', { status: 'draft', type: 'used' },
      { status: 'active', type: 'auction', auctionStart: 15, auctionEnd: FUTURE }],
    ['draft auction published with legacy type', { status: 'draft', type: 'used' }, { type: 'fixed' }],
    ['draft auction published without a bid', { status: 'draft', type: 'auction', auction_start: null, auction_end: FUTURE }, { status: 'active' }],
    ['draft auction published without an end', { status: 'draft', type: 'auction', auction_start: 5, auction_end: null }, { status: 'active' }],
    ['draft auction published already ended', { status: 'draft', type: 'auction', auction_start: 5, auction_end: PAST }, { status: 'active' }],
    ['card details', { status: 'active', type: 'used' }, { productType: 'tcg', game: 'magic', cardLanguage: 'en', cardGradingCompany: '', cardGrade: '' }],
  ])('%s', async (_, row, json) => {
    if (row) current(row);
    if (_ === 'not the owner') { sqlRules.length = 0; rule(/^UPDATE listings SET/, { rows: [] }); }
    expect(await call('PATCH', '/l1', { user: 'u1', json })).toMatchSnapshot();
  });

  test('new photos replace the old ones', async () => {
    current({ status: 'active', type: 'used' });
    expect(await call('PATCH', '/l1', { user: 'u1', form: { title: 'Nuovo titolo' }, files: [30, 40] })).toMatchSnapshot();
  });
  test('photo processing fails', async () => {
    current({ status: 'active', type: 'used' });
    expect(await call('PATCH', '/l1', { user: 'u1', form: { title: 'Nuovo titolo' }, files: [13] })).toMatchSnapshot();
  });
  test('UPDATE fails', async () => {
    current({ status: 'active', type: 'used' });
    sqlRules.unshift([/^UPDATE listings SET/, new Error('down')]);
    expect(await call('PATCH', '/l1', { user: 'u1', json: { title: 'Nuovo titolo' } })).toMatchSnapshot();
  });
  // Used to be an unhandled rejection (no answer, and a crash with no unhandledRejection handler).
  test('pre-edit lookup fails -> 500', async () => {
    rule(/^SELECT status, type, auction_start, auction_end FROM listings/, new Error('pool down'));
    const res = await call('PATCH', '/l1', { user: 'u1', json: { title: 'Nuovo titolo' } });
    expect(res.status).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: 'Errore aggiornamento' });
    expect(res.trace.some(([k, sql]) => k === 'query' && /^UPDATE/.test(sql))).toBe(false);
  });
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────
describe('DELETE /:id', () => {
  test('removed', async () => {
    rule(/^UPDATE listings SET status = 'removed'/, { rows: [{ id: 'l1' }] });
    expect(await call('DELETE', '/l1', { user: 'u1' })).toMatchSnapshot();
  });
  test('not removable', async () => {
    expect(await call('DELETE', '/l1', { user: 'u1' })).toMatchSnapshot();
  });
  test('DB error', async () => {
    rule(/^UPDATE listings SET status = 'removed'/, new Error('down'));
    expect(await call('DELETE', '/l1', { user: 'u1' })).toMatchSnapshot();
  });
});

// ─── POST /:id/bid ────────────────────────────────────────────────────────
describe('POST /:id/bid', () => {
  const auction = (extra) => rule(/^SELECT \* FROM listings WHERE id = \$1 FOR UPDATE/, {
    rows: [{ id: 'l1', type: 'auction', is_auction: false, status: 'active', seller_id: 's1', current_bid: '20.00', bids_count: 3, auction_start: '10', auction_end: new Date(FUTURE), ...extra }],
  });
  beforeEach(() => rule(/^UPDATE listings SET current_bid/, (p) => ({ rows: [{ id: 'l1', current_bid: p[0] }] })));

  test.each([
    ['amount not a number', null, { amount: 'abc' }],
    ['amount zero', null, { amount: 0 }],
    ['unknown listing', undefined, { amount: 30 }],
    ['not an auction', { type: 'used' }, { amount: 30 }],
    ['legacy is_auction flag counts', { type: 'used', is_auction: true }, { amount: 30 }],
    ['not active', { status: 'sold' }, { amount: 30 }],
    ['already ended', { auction_end: new Date(PAST) }, { amount: 30 }],
    ['own listing', { seller_id: 'u1' }, { amount: 30 }],
    ['below current + 1', {}, { amount: 20.5 }],
    ['first bid below the starting price', { bids_count: 0, current_bid: null, starting_price: '15' }, { amount: 14 }],
    ['first bid at the starting price', { bids_count: 0, current_bid: null }, { amount: '10' }],
    ['outbids someone else', {}, { amount: 21 }],
  ])('%s', async (_, extra, json) => {
    if (extra !== undefined && extra !== null) auction(extra);
    if (_ === 'outbids someone else') rule(/^SELECT bidder_id FROM bids/, { rows: [{ bidder_id: 'u7' }] });
    expect(await call('POST', '/l1/bid', { user: 'u1', json })).toMatchSnapshot();
  });

  test('last-two-minutes bid extends the auction; same top bidder gets no notification', async () => {
    auction({ auction_end: new Date(Date.now() + 60 * 1000) });
    rule(/^SELECT bidder_id FROM bids/, { rows: [{ bidder_id: 'u1' }] });
    expect(await call('POST', '/l1/bid', { user: 'u1', json: { amount: 25 } })).toMatchSnapshot();
  });

  test('a DB error rolls back and answers 400 with its message', async () => {
    auction({});
    rule(/^INSERT INTO bids/, new Error('deadlock detected'));
    expect(await call('POST', '/l1/bid', { user: 'u1', json: { amount: 25 } })).toMatchSnapshot();
  });

  // Used to be an unhandled rejection (no answer, and a crash with no unhandledRejection handler).
  test('no connection from the pool -> 500, nothing written', async () => {
    db.getClient.mockImplementationOnce(async () => { throw new Error('timeout acquiring a client'); });
    const res = await call('POST', '/l1/bid', { user: 'u1', json: { amount: 25 } });
    expect(res.status).toBe(500);
    expect(JSON.parse(res.body)).toEqual({ error: "Errore durante l'offerta" });
    expect(res.trace).toEqual([]);
  });

  test('a failed ROLLBACK keeps the original answer and discards the connection', async () => {
    auction({});
    rule(/^INSERT INTO bids/, new Error('deadlock detected'));
    rule(/^ROLLBACK/, new Error('connection terminated'));
    const res = await call('POST', '/l1/bid', { user: 'u1', json: { amount: 25 } });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'deadlock detected' });
    expect(res.trace.at(-1)).toEqual(['release', 'destroyed']);
  });

  test('the outbid notification goes through the pool, not the released transaction client', async () => {
    auction({});
    rule(/^SELECT bidder_id FROM bids/, { rows: [{ bidder_id: 'u7' }] });
    const { trace } = await call('POST', '/l1/bid', { user: 'u1', json: { amount: 21 } });
    const notify = trace.findIndex(([, sql]) => /^INSERT INTO notifications/.test(sql || ''));
    expect(trace[notify][0]).toBe('query');
    expect(trace[notify][2]).toEqual(['u7', 'notifications.outbid', 'l1']);
  });
});
