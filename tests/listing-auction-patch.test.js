// PATCH /api/listings/:id — an auction's type/starting bid/end date can only ever be set while the
// listing is still a draft (that's how a drafted auction gets its terms the first time: see
// client/src/lib/auction/payload.js, which never sends them on create for a draft because the server's
// draft schema rejects type:'auction'). Once the listing is no longer a draft those three fields are
// locked for good — a PATCH that tries to change them has those fields silently dropped, while every
// other field in the same request still updates normally.
//
// The database and the auth middleware are mocked (same pattern as tests/card-details.test.js), so this
// runs without a real DB connection. query() is called twice per PATCH here: a pre-fetch SELECT (status/
// type/auction_start/auction_end), then the final UPDATE ... RETURNING *.
jest.mock('../src/db', () => ({ query: jest.fn() }));
jest.mock('../src/middleware/auth', () => (req, res, next) => { req.user = { userId: 'seller-1', role: 'user' }; next(); });

const http = require('http');
const express = require('express');
const { query } = require('../src/db');

describe('PATCH /api/listings/:id — auction terms are draft-only', () => {
  let server;
  let base;

  beforeAll(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const app = express();
    app.use(express.json());
    app.use('/api/listings', require('../src/modules/listings/listings.routes'));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/api/listings`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    jest.restoreAllMocks();
  });
  beforeEach(() => query.mockReset());

  const patch = (body) => fetch(`${base}/abc`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const updateCall = () => query.mock.calls.find(([sql]) => /UPDATE listings/.test(sql));
  const future = (days = 1) => new Date(Date.now() + days * 86400000).toISOString();

  // Queues the pre-fetch SELECT's result, then the final UPDATE...RETURNING*'s.
  function mockCurrent(row) {
    query.mockResolvedValueOnce({ rows: [row] });
    query.mockResolvedValueOnce({ rows: [{ id: 'abc', ...row }] });
  }

  test('publishing a draft auction writes type, auction_start, auction_end and seeds current_bid', async () => {
    mockCurrent({ status: 'draft', type: 'used', auction_start: null, auction_end: null });
    const res = await patch({ type: 'auction', status: 'active', auctionStart: 50, auctionEnd: future() });
    expect(res.status).toBe(200);
    const [sql, params] = updateCall();
    expect(sql).toMatch(/type = \$/);
    expect(sql).toMatch(/auction_start = \$/);
    expect(sql).toMatch(/auction_end = \$/);
    expect(sql).toMatch(/current_bid = \$/);
    expect(params).toContain('auction');
    expect(params).toContain(50);
  });

  test('publishing without a starting bid is rejected before any UPDATE', async () => {
    mockCurrent({ status: 'draft', type: 'used', auction_start: null, auction_end: null });
    const res = await patch({ type: 'auction', status: 'active', auctionEnd: future() });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/base d'asta/);
    expect(updateCall()).toBeUndefined();
  });

  test('publishing without an end date is rejected', async () => {
    mockCurrent({ status: 'draft', type: 'used', auction_start: null, auction_end: null });
    const res = await patch({ type: 'auction', status: 'active', auctionStart: 50 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/scadenza/);
  });

  test('publishing with a past end date is rejected', async () => {
    mockCurrent({ status: 'draft', type: 'used', auction_start: null, auction_end: null });
    const res = await patch({ type: 'auction', status: 'active', auctionStart: 50, auctionEnd: '2000-01-01T00:00:00.000Z' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/futuro/);
  });

  test('an already-live auction cannot have its type, bid or end date rewritten; other fields still update', async () => {
    mockCurrent({ status: 'active', type: 'auction', auction_start: '50.00', auction_end: future(7) });
    const res = await patch({ type: 'used', auctionStart: 999, auctionEnd: future(30), description: 'just editing the description' });
    expect(res.status).toBe(200);
    const [sql, params] = updateCall();
    expect(sql).not.toMatch(/type = \$/);
    expect(sql).not.toMatch(/auction_start = \$/);
    expect(sql).not.toMatch(/auction_end = \$/);
    expect(sql).not.toMatch(/current_bid = \$/);
    expect(sql).toMatch(/description = \$/);
    expect(params).toContain('just editing the description');
  });

  test('pausing a live auction back to draft does not let the same request sneak in a new bid', async () => {
    mockCurrent({ status: 'active', type: 'auction', auction_start: '50.00', auction_end: future(7) });
    const res = await patch({ status: 'draft', auctionStart: 1 });
    expect(res.status).toBe(200);
    const [sql] = updateCall();
    expect(sql).not.toMatch(/auction_start = \$/);
    expect(sql).toMatch(/status = \$/);
  });

  test('re-editing a still-draft auction can update the bid alone and reuses the already-stored end date', async () => {
    mockCurrent({ status: 'draft', type: 'used', auction_start: '30.00', auction_end: future(5) });
    const res = await patch({ type: 'auction', status: 'active', auctionStart: 45 });
    expect(res.status).toBe(200); // effectiveEnd falls back to the row's own auction_end, which is valid
    const [, params] = updateCall();
    expect(params).toContain(45);
  });

  test('publishing a normal (non-auction) draft is untouched by any of this', async () => {
    mockCurrent({ status: 'draft', type: 'used', auction_start: null, auction_end: null });
    const res = await patch({ status: 'active', price: 19.99 });
    expect(res.status).toBe(200);
    const [sql] = updateCall();
    expect(sql).toMatch(/price = \$/);
    expect(sql).not.toMatch(/auction_start = \$/);
  });
});
