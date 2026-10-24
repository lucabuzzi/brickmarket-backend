// "CardBrix the game": selling from the player's own shop in the middle of the market. The player picks what they
// sell, photographs it, the photo is recognised (POST /api/cards/recognize: a card's real prints, or the LEGO set of a
// box), they pick the exact print and decide the price; everything else is filled from the catalog, and the listing
// is published through the same API and the same fields as the sell page (lib/sell/payload.js).
// Pure, unit-tested in tests/game-sell-flow.test.js; the panel view is game/panel/SellView.jsx.
import { INITIAL_FORM, TCG_CONDITIONS, LEGO_CONDITIONS, changeProductType, selectGame, parseDecimal } from '../sell/form.js';
import { recognizedPatch, RECOGNIZE_GAMES } from '../sell/recognize.js';
import { buildListingFields } from '../sell/payload.js';
import { buyerPriceFor } from '../fees.js';

/** What can be sold from the shop, in the order of the picker: the card games the recognition reads, then LEGO. */
export const SELL_KINDS = [...RECOGNIZE_GAMES.filter((g) => ['pokemon', 'magic', 'yugioh', 'onepiece', 'lorcana'].includes(g)), 'lego'];

/** Carriers a listing published from the game offers (the cheapest of the rate table); changed on the site. */
export const DEFAULT_CARRIERS = ['POSTE', 'BRT'];

/** LEGO conditions offered in the game: the sell page's, a sealed box being "new". */
export const conditionsFor = (kind) => (kind === 'lego' ? LEGO_CONDITIONS : TCG_CONDITIONS);

/** The kinds the shop offers right now: those the server says are switched on (GET /api/cards/recognize/status). */
export function availableKinds(status) {
  if (!status?.enabled) return [];
  const on = new Set(status.games || []);
  return SELL_KINDS.filter((k) => on.has(k));
}

// Brand names of the kinds, as the site writes them (config/catalogGames.js; not imported: Jest only compiles lib/).
const KIND_NAMES = {
  pokemon: 'Pokémon', magic: 'Magic: The Gathering', yugioh: 'Yu-Gi-Oh!', onepiece: 'One Piece Card Game', lorcana: 'Disney Lorcana', lego: 'LEGO',
};

/** Brand name of a kind, e.g. "Magic: The Gathering". */
export const kindName = (kind) => KIND_NAMES[kind] || kind;

const withCarriers = (form) => ({
  ...form,
  shippingOptions: Object.fromEntries(DEFAULT_CARRIERS.map((id) => [id, { selected: true }])),
});

/**
 * The sell form for a recognised card: the catalog print chosen by the player (title, set, number, rarity), the
 * language printed on the card, and the condition the reader suggested (only if it is a real grade).
 */
export function cardForm(game, print, reading) {
  let form = changeProductType({ ...INITIAL_FORM, shippingOptions: {} }, 'tcg');
  form = selectGame(form, game, kindName(game));
  form = { ...form, ...recognizedPatch(print, reading, form, game) };
  const suggested = TCG_CONDITIONS.includes(reading?.condition) ? reading.condition : '';
  return withCarriers({ ...form, condition: suggested });
}

/** The sell form for a recognised LEGO set (catalog name, number and year; "new" if the box looked sealed). */
export function legoForm(set, reading) {
  const form = { ...INITIAL_FORM, shippingOptions: {}, productType: 'lego', mainCategory: 'sets' };
  const suggested = LEGO_CONDITIONS.includes(reading?.condition) ? reading.condition : '';
  return withCarriers({
    ...form,
    title: set.name || '',
    setNumber: set.set_num || '',
    year: set.year ? String(set.year) : '',
    condition: suggested,
  });
}

/** The price the player typed, as a number > 0 with at most 2 decimals, or null. */
export function priceOf(text) {
  const n = parseDecimal(text);
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return Math.round(n * 100) / 100;
}

/** What the buyer will pay for `price` (the buyer's fee is on top: the seller gets the price they set). */
export const buyerPays = (price) => (price ? buyerPriceFor(price) : null);

/** Why the listing cannot be published yet: 'condition' | 'price' | 'title' | 'photo' | null. */
export function publishBlocker(form, price, photo) {
  if (!photo) return 'photo';
  if (!form || String(form.title || '').trim().length < 5) return 'title';
  if (!conditionsFor(form.productType === 'lego' ? 'lego' : 'tcg').includes(form.condition)) return 'condition';
  if (!price) return 'price';
  return null;
}

/** The multipart fields of POST /api/listings (the photo is appended by the caller), exactly as the sell page sends them. */
export function listingFields(form, price) {
  return buildListingFields({ ...form, price: String(price) }, 'publish');
}

/**
 * The step a recognition answer leads to:
 *   { step: 'pick', prints }        a card with several real prints: the player picks theirs
 *   { step: 'summary', form }       one print, or a LEGO set: straight to the price
 *   { step: 'retry', reason }       'not_found' | 'unreadable': another photo (or the sell page)
 */
export function afterRecognition(kind, answer) {
  if (!answer || answer.status !== 'matched') return { step: 'retry', reason: answer?.status === 'not_found' ? 'not_found' : 'unreadable' };
  if (kind === 'lego') return answer.set ? { step: 'summary', form: legoForm(answer.set, answer.reading) } : { step: 'retry', reason: 'not_found' };
  const prints = Array.isArray(answer.prints) ? answer.prints : [];
  if (!prints.length) return { step: 'retry', reason: 'not_found' };
  if (prints.length === 1) return { step: 'summary', form: cardForm(kind, prints[0], answer.reading) };
  return { step: 'pick', prints };
}

/** The message key (game.sell.error.*) of a failed recognition or publication. */
export function errorKey(err) {
  const code = err?.data?.code;
  if (err?.status === 401 || err?.status === 403) return 'login';
  if (['user_hourly_limit', 'user_daily_limit', 'site_daily_limit'].includes(code)) return 'limit';
  if (code === 'too_large') return 'too_large';
  if (code === 'bad_image' || code === 'no_image') return 'bad_image';
  if (code === 'not_configured' || err?.status === 503) return 'unavailable';
  return 'generic';
}

/** The player's own listings worth showing in the shop: active first, then the rest (drafts, sold...). */
export function ownListings(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const rank = (s) => (s === 'active' ? 0 : s === 'draft' ? 1 : 2);
  return [...list].sort((a, b) => rank(a.status) - rank(b.status));
}
