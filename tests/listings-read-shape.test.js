// The JSON the public listing reads answer (feed, archive, search, detail), pinned before their seller mapping
// moved to src/repositories/listingSeller.js: same keys, same order, same defaults. The DB is mocked.
jest.mock('../src/db', () => ({ query: jest.fn() }));
jest.mock('../src/middleware/auth', () => (req, res, next) => { req.user = { userId: 'seller-1', role: 'user' }; next(); });
const http = require('http');
const express = require('express');
const { query } = require('../src/db');

const ROW = {
  id: 'l1', title: 'Millennium Falcon', status: 'active', shipping_options: null, package_size: 'M',
  seller_username: 'mario', seller_avatar: 'a.png', seller_rating: '4.5', seller_is_verified: null,
  seller_is_pro: true, seller_seller_type: null, seller_company_name: null,
};
const SELLER = {
  username: 'mario', avatar_url: 'a.png', rating_avg: '4.5', is_verified: false, is_pro: true, seller_type: null, company_name: null,
};

let server;
let base;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/listings', require('../src/routes/listings'));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/listings`;
});
afterAll(() => new Promise((resolve) => server.close(resolve)));
beforeEach(() => {
  query.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const selectsFromListings = (sql) => /FROM listings l\s+JOIN users u/.test(sql);
function answerSelect(rows) {
  query.mockImplementation(async (sql) => (selectsFromListings(sql) ? { rows } : { rows: [], rowCount: 0 }));
}
const get = async (path) => {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, text: await res.text() };
};

test.each([['feed', ''], ['archive', '/archive'], ['search', '/search?q=falcon']])('%s: listing fields, then seller', async (_, path) => {
  answerSelect([ROW]);
  const { status, text } = await get(path);
  expect(status).toBe(200);
  // exact text, so the key order is pinned too
  expect(text).toBe(JSON.stringify([{ id: 'l1', title: 'Millennium Falcon', status: 'active', shipping_options: null, package_size: 'M', seller: SELLER }]));
  const sql = query.mock.calls.map(([q]) => q).find(selectsFromListings);
  for (const col of ['u.username as seller_username', 'u.avatar_url as seller_avatar', 'u.rating_avg as seller_rating',
    'u.is_verified as seller_is_verified', 'u.is_pro as seller_is_pro', 'u.seller_type as seller_seller_type',
    'u.company_name as seller_company_name']) expect(sql).toContain(col);
});

test('detail: highest bidder kept before seller, seller country defaults to it', async () => {
  answerSelect([{ ...ROW, highest_bidder_username: 'luigi' }]);
  const { status, text } = await get('/l1');
  expect(status).toBe(200);
  const body = JSON.parse(text);
  expect(Object.keys(body).slice(0, 7)).toEqual(['id', 'title', 'status', 'shipping_options', 'package_size', 'highest_bidder_username', 'seller']);
  expect(body.seller).toEqual({ ...SELLER, country: 'it' });
  expect(Object.keys(body.seller).at(-1)).toBe('country');
  expect(body.highest_bidder_username).toBe('luigi');
  expect(body).toHaveProperty('shipping_options');
});

test('detail: unknown id -> 404', async () => {
  answerSelect([]);
  const { status } = await get('/nope');
  expect(status).toBe(404);
});
