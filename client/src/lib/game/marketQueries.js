// "CardBrix the game": how the merchants and the auction board ask the REAL marketplace for what to show, and
// how a listing is summarised in the side panel. Only existing public endpoints are used (GET /api/listings);
// nothing here invents data: a field the API does not return is reported as missing, never filled in.
// Pure, unit-tested in tests/game-market-queries.test.js.

export const PRODUCT_TYPES = ['lego', 'tcg', 'funko'];
export const CARD_GAMES = ['pokemon', 'magic', 'yugioh', 'onepiece', 'lorcana', 'dragonball'];
export const PANEL_LIMIT = 12;

/** Keeps only the query keys/values a merchant may ask for (the config could otherwise reach any filter). */
export function cleanQuery(query = {}) {
  const out = {};
  if (PRODUCT_TYPES.includes(query.product_type)) out.product_type = query.product_type;
  if (out.product_type === 'tcg' && CARD_GAMES.includes(query.game)) out.game = query.game;
  return out;
}

/** GET /api/listings URL of the active fixed-price listings a merchant shows (newest first). */
export function listingsUrl(query, limit = PANEL_LIMIT) {
  const q = cleanQuery(query);
  const params = new URLSearchParams({ status: 'active', is_auction: 'false', ...q, limit: String(limit) });
  return `/api/listings?${params}`;
}

/** GET /api/listings URL of the active auctions, the ones ending first on top. */
export function auctionsUrl(limit = PANEL_LIMIT) {
  return `/api/listings?${new URLSearchParams({ status: 'active', is_auction: 'true', sort: 'auction', limit: String(limit) })}`;
}

/** The page of the site that lists the same things (the "see everything" link under a merchant's goods). */
export function siteCategoryPath(query) {
  const q = cleanQuery(query);
  if (q.product_type === 'lego') return '/annunci/lego';
  if (q.product_type === 'funko') return '/annunci/funko';
  if (q.product_type === 'tcg') return q.game ? `/annunci/carte-collezionabili/${q.game}` : '/annunci/carte-collezionabili';
  return '/annunci';
}

/** Locale key of the title of a goods list (game.panel.goods.<type>[_<game>]). */
export function goodsTitleKey(query) {
  const q = cleanQuery(query);
  if (!q.product_type) return 'game.panel.goods.all';
  return `game.panel.goods.${q.product_type}${q.game ? `_${q.game}` : ''}`;
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

export function isAuction(item) {
  return Boolean(item && (item.is_auction || item.type === 'auction'));
}

/**
 * The price to show and what it is: { amount, kind } with kind 'price' (fixed price), 'bid' (current highest
 * bid) or 'start' (auction without bids: starting price). amount null = the API gave none.
 */
export function displayPrice(item) {
  if (!isAuction(item)) return { amount: num(item && item.price), kind: 'price' };
  const bid = num(item.current_bid);
  if (bid !== null) return { amount: bid, kind: 'bid' };
  return { amount: num(item.starting_price) ?? num(item.price), kind: 'start' };
}

/** Number of bids, or null when the API did not say. */
export function bidCount(item) {
  const n = num(item && item.bids_count);
  return n === null ? null : Math.max(0, Math.round(n));
}

export function sellerName(item) {
  return (item && ((item.seller && item.seller.username) || item.seller_username)) || null;
}

export function isOwn(item, username) {
  return Boolean(username) && sellerName(item) === username;
}

/** Time left before `endIso`: null when unknown, { ended: true } when over, else { d, h, m, s, total }. */
export function timeLeft(endIso, now = Date.now()) {
  if (!endIso) return null;
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(end)) return null;
  const ms = end - now;
  if (ms <= 0) return { ended: true, total: 0 };
  const total = Math.floor(ms / 1000);
  return { ended: false, total, d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

/** Compact "2g 05h" / "1h 04m" / "03m 09s" label of a timeLeft() result ('' when unknown or over). */
export function formatTimeLeft(left, units = { d: 'g', h: 'h', m: 'm', s: 's' }) {
  if (!left || left.ended) return '';
  const p = (v) => String(v).padStart(2, '0');
  if (left.d > 0) return `${left.d}${units.d} ${p(left.h)}${units.h}`;
  if (left.h > 0) return `${left.h}${units.h} ${p(left.m)}${units.m}`;
  return `${p(left.m)}${units.m} ${p(left.s)}${units.s}`;
}

/** Only the auctions still running: an expired one can still come back from the API until the next expiry pass. */
export function runningAuctions(items, now = Date.now()) {
  return (Array.isArray(items) ? items : []).filter((it) => {
    if (!isAuction(it) || (it.status && it.status !== 'active')) return false;
    const left = timeLeft(it.auction_end, now);
    return !left || !left.ended;
  });
}

/** The soonest-ending running auction (for the clock over the auction house), or null. */
export function nextEndingAuction(items, now = Date.now()) {
  let best = null;
  for (const it of runningAuctions(items, now)) {
    const end = new Date(it.auction_end).getTime();
    if (Number.isFinite(end) && (!best || end < new Date(best.auction_end).getTime())) best = it;
  }
  return best;
}

/**
 * The 5-character clock over the auction house: "MM:SS" under an hour, "4h59" under a day, "2d05" beyond (the day
 * letter is localised), "--:--" when no auction is running or its end is unknown. Never a made-up time.
 */
export function clockText(left, units = { d: 'd', h: 'h' }) {
  if (!left || left.ended) return '--:--';
  const p = (v) => String(v).padStart(2, '0');
  if (left.d > 0) return `${Math.min(left.d, 99)}${units.d}${p(left.h)}`;
  if (left.h > 0) return `${left.h}${units.h}${p(left.m)}`;
  return `${p(left.m)}:${p(left.s)}`;
}
