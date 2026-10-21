// CardBrix commission (src/utils/fees.js, mirrored for display by client/src/lib/fees.js):
// paid by the buyer only, on top of the item price; the seller receives the full price.
const server = require('../src/utils/fees');
const client = require('../client/src/lib/fees');

const PRICES = [0.08, 0.5, 1, 3, 9.99, 12.5, 45.5, 99.99, 133, 1234.56];

test('the seller pays nothing: payout is the full item price', () => {
  for (const p of PRICES) {
    const { sellerFee, sellerPayout } = server.computeFees(p);
    expect(sellerFee).toBe(0);
    expect(sellerPayout).toBe(p);
  }
});

test('the buyer pays 5% on top of the item price, rounded to the cent', () => {
  expect(server.BUYER_FEE_RATE).toBe(0.05);
  expect(server.computeFees(10).platformFee).toBe(0.5);
  expect(server.computeFees(12.5).platformFee).toBe(0.63);
  expect(server.computeFees(0.08).platformFee).toBe(0); // 0.004 rounds to 0
  expect(server.buyerPrice(10)).toBe(10.5);
  expect(server.buyerPrice('3')).toBe(3.15);
});

test('client display mirror never drifts from what the server charges', () => {
  expect(client.BUYER_FEE_RATE).toBe(server.BUYER_FEE_RATE);
  expect(client.BUYER_FEE_PERCENT).toBe('5%');
  for (const p of PRICES) {
    const { platformFee } = server.computeFees(p);
    expect(client.buyerFeeFor(p)).toBe(platformFee);
    expect(client.buyerFeeFor(String(p))).toBe(platformFee);
    // what the listing shows === what checkout charges for the item (shipping aside)
    expect(client.buyerPriceFor(p)).toBe(Math.round((p + platformFee) * 100) / 100);
    expect(client.buyerPriceFor(p)).toBe(server.buyerPrice(p));
  }
});

test('missing prices stay missing instead of becoming 0', () => {
  expect(client.buyerPriceFor(null)).toBeNull();
  expect(client.buyerPriceFor(undefined)).toBeNull();
  expect(client.buyerPriceFor('abc')).toBeNull();
  expect(client.buyerFeeFor(null)).toBe(0);
  expect(server.buyerPrice(null)).toBeNull();
  expect(server.buyerPrice('')).toBeNull();
});

test('public pages: fixed price with commission, auctions unchanged', () => {
  expect(server.shownListingPrice({ type: 'used', price: '10' })).toBe(10.5);
  expect(server.shownListingPrice({ type: 'auction', price: '10', current_bid: '30', auction_start: '5' })).toBe('30');
  expect(server.shownListingPrice({ type: 'auction', price: '10', current_bid: null, auction_start: '5' })).toBe('5');
});
