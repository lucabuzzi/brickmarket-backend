// CardBrix commission. Charged to the BUYER only, on top of the item price;
// the seller receives the full item price. client/src/lib/fees.js mirrors
// this for display (listing cards/detail/cart) — keep the two in sync
// (tests/fees.test.js fails if they drift).
const BUYER_FEE_RATE = 0.05;

function computeFees(itemPrice) {
  const platformFee = Math.round(itemPrice * BUYER_FEE_RATE * 100) / 100;
  const sellerFee = 0;
  const sellerPayout = itemPrice;
  return { platformFee, sellerFee, sellerPayout };
}

/** Fixed price as the buyer pays it, commission included (shipping excluded). null/'' stays null. */
function buyerPrice(price) {
  if (price == null || price === '') return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  return Math.round((n + computeFees(n).platformFee) * 100) / 100;
}

/**
 * The price public pages show for a listing: an auction's current bid / starting price as is
 * (auctions have no checkout yet), a fixed price with the buyer commission included.
 */
function shownListingPrice(listing) {
  if (listing.type === 'auction') return listing.current_bid ?? listing.auction_start;
  return buyerPrice(listing.price);
}

module.exports = { BUYER_FEE_RATE, computeFees, buyerPrice, shownListingPrice };
