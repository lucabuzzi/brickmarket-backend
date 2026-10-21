// How the game asks the real marketplace for goods / auctions and summarises a listing
// (client/src/lib/game/marketQueries.js): only whitelisted filters, never an invented value.
const {
  cleanQuery, listingsUrl, auctionsUrl, siteCategoryPath, goodsTitleKey, displayPrice, bidCount, sellerName, isOwn,
  isAuction, timeLeft, formatTimeLeft, runningAuctions, nextEndingAuction, clockText, CARD_GAMES,
} = require('../client/src/lib/game/marketQueries');

const params = (url) => Object.fromEntries(new URL(url, 'http://x').searchParams);

test('cleanQuery keeps only known product types, and a game only for cards', () => {
  expect(cleanQuery({ product_type: 'lego', game: 'pokemon', status: 'draft' })).toEqual({ product_type: 'lego' });
  expect(cleanQuery({ product_type: 'tcg', game: 'pokemon' })).toEqual({ product_type: 'tcg', game: 'pokemon' });
  expect(cleanQuery({ product_type: 'tcg', game: 'chess' })).toEqual({ product_type: 'tcg' });
  expect(cleanQuery({ product_type: 'cars' })).toEqual({});
  expect(cleanQuery()).toEqual({});
});

test('merchants ask for active fixed-price listings, the auction board for running auctions ending first', () => {
  expect(params(listingsUrl({ product_type: 'tcg', game: 'magic' }))).toEqual({ status: 'active', is_auction: 'false', product_type: 'tcg', game: 'magic', limit: '12' });
  expect(listingsUrl({ status: 'all' }).startsWith('/api/listings?')).toBe(true);
  expect(params(listingsUrl({ status: 'all' })).status).toBe('active');
  expect(params(auctionsUrl(5))).toEqual({ status: 'active', is_auction: 'true', sort: 'auction', limit: '5' });
});

test('the "see everything" link points at the matching page of the site', () => {
  expect(siteCategoryPath({ product_type: 'lego' })).toBe('/annunci/lego');
  expect(siteCategoryPath({ product_type: 'funko' })).toBe('/annunci/funko');
  expect(siteCategoryPath({ product_type: 'tcg' })).toBe('/annunci/carte-collezionabili');
  for (const g of CARD_GAMES) expect(siteCategoryPath({ product_type: 'tcg', game: g })).toBe(`/annunci/carte-collezionabili/${g}`);
  expect(siteCategoryPath({})).toBe('/annunci');
  expect(goodsTitleKey({ product_type: 'tcg', game: 'onepiece' })).toBe('game.panel.goods.tcg_onepiece');
  expect(goodsTitleKey({})).toBe('game.panel.goods.all');
});

test('every card game a merchant can show has a page in App.jsx', () => {
  const app = require('fs').readFileSync(require('path').join(__dirname, '../client/src/App.jsx'), 'utf8');
  for (const g of CARD_GAMES) expect(app).toContain(`'annunci/carte-collezionabili/${g}'`);
});

test('displayPrice: fixed price, current bid, else the starting price; null when the API has none', () => {
  expect(displayPrice({ price: '12.50' })).toEqual({ amount: 12.5, kind: 'price' });
  expect(displayPrice({ price: null })).toEqual({ amount: null, kind: 'price' });
  expect(displayPrice({ is_auction: true, current_bid: '30', starting_price: '10' })).toEqual({ amount: 30, kind: 'bid' });
  expect(displayPrice({ type: 'auction', current_bid: null, starting_price: '10' })).toEqual({ amount: 10, kind: 'start' });
  expect(displayPrice({ is_auction: true })).toEqual({ amount: null, kind: 'start' });
});

test('bids, seller and own listings', () => {
  expect(bidCount({ bids_count: 3 })).toBe(3);
  expect(bidCount({ bids_count: '0' })).toBe(0);
  expect(bidCount({})).toBeNull();
  expect(sellerName({ seller: { username: 'ann' } })).toBe('ann');
  expect(sellerName({ seller_username: 'bob' })).toBe('bob');
  expect(sellerName({})).toBeNull();
  expect(isOwn({ seller: { username: 'ann' } }, 'ann')).toBe(true);
  expect(isOwn({ seller: { username: 'ann' } }, 'bob')).toBe(false);
  expect(isOwn({ seller: { username: 'ann' } }, null)).toBe(false);
  expect(isAuction({ type: 'auction' })).toBe(true);
  expect(isAuction({ type: 'sale' })).toBe(false);
});

test('time left, its labels and the auction house clock', () => {
  const now = Date.UTC(2026, 0, 1);
  expect(timeLeft(null, now)).toBeNull();
  expect(timeLeft('nope', now)).toBeNull();
  expect(timeLeft(new Date(now - 1000).toISOString(), now)).toEqual({ ended: true, total: 0 });
  const left = timeLeft(new Date(now + ((2 * 24 + 5) * 3600 + 7 * 60 + 9) * 1000).toISOString(), now);
  expect(left).toMatchObject({ ended: false, d: 2, h: 5, m: 7, s: 9 });
  expect(formatTimeLeft(left)).toBe('2g 05h');
  expect(formatTimeLeft(timeLeft(new Date(now + 3725e3).toISOString(), now))).toBe('1h 02m');
  expect(formatTimeLeft(timeLeft(new Date(now + 189e3).toISOString(), now))).toBe('03m 09s');
  expect(formatTimeLeft(null)).toBe('');
  expect(clockText(left, { d: 'g', h: 'h' })).toBe('2g05');
  expect(clockText(timeLeft(new Date(now + 3725e3).toISOString(), now))).toBe('1h02');
  expect(clockText(timeLeft(new Date(now + 189e3).toISOString(), now))).toBe('03:09');
  expect(clockText(null)).toBe('--:--');
  expect(clockText({ ended: true })).toBe('--:--');
});

test('only running auctions are shown, and the clock follows the one ending first', () => {
  const now = Date.UTC(2026, 0, 1);
  const at = (s) => new Date(now + s * 1000).toISOString();
  const items = [
    { id: 1, is_auction: true, status: 'active', auction_end: at(600) },
    { id: 2, is_auction: true, status: 'active', auction_end: at(-5) }, // expired, not yet swept by the API
    { id: 3, is_auction: true, status: 'sold', auction_end: at(60) },
    { id: 4, is_auction: false, status: 'active' },
    { id: 5, is_auction: true, status: 'active', auction_end: at(120) },
  ];
  expect(runningAuctions(items, now).map((i) => i.id)).toEqual([1, 5]);
  expect(nextEndingAuction(items, now).id).toBe(5);
  expect(nextEndingAuction([], now)).toBeNull();
  expect(runningAuctions(null, now)).toEqual([]);
});
