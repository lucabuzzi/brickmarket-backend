// Input rules for listings: what a seller may send to create (draft or publish) and edit a listing, and how
// legacy/UI values are turned into what the listings table accepts. Pure: no DB, no HTTP.
const Joi = require('joi');
const {
  CARD_LANGUAGES, GRADING_COMPANIES, CARD_RARITY_MAX, CARD_GRADE_MAX, CARD_SET_ID_PATTERN, CARD_NUMBER_MAX,
} = require('../../services/cardDetails');

/** Valori ammessi da src/db/schema.sql → listings.type CHECK */
const LISTING_TYPES_DB = ['used', 'sealed', 'moc', 'auction'];
/** Alias legacy ancora accettato in input, normalizzato prima dell'INSERT */
const LISTING_TYPE_LEGACY_ALIASES = ['fixed'];
/** Valori ammessi per la categoria di prodotto e, se product_type='tcg', per il gioco specifico */
const PRODUCT_TYPES = ['lego', 'funko', 'tcg'];
/** How the seller wants the photos framed in cards and in the gallery */
const IMAGE_ORIENTATIONS = ['portrait', 'landscape'];
/** Trading-card details (language, rarity, grading); stored only for product_type='tcg', see services/cardDetails.js */
const CARD_DETAIL_FIELDS = {
  cardLanguage: Joi.string().valid(...CARD_LANGUAGES).allow('', null),
  cardRarity: Joi.string().max(CARD_RARITY_MAX).allow('', null),
  cardGradingCompany: Joi.string().valid(...GRADING_COMPANIES).allow('', null),
  cardGrade: Joi.string().max(CARD_GRADE_MAX).allow('', null),
  cardSetId: Joi.string().pattern(CARD_SET_ID_PATTERN).allow('', null),
  cardNumber: Joi.string().max(CARD_NUMBER_MAX).allow('', null),
  cardExternalId: Joi.string().pattern(CARD_SET_ID_PATTERN).allow('', null),
};
const TCG_GAMES = ['pokemon', 'magic', 'lorcana', 'yugioh', 'onepiece', 'dragonball'];
/** Card-grade condition codes used only when product_type='tcg' */
const TCG_CONDITION_GRADES = ['near_mint', 'slightly_played', 'moderately_played', 'heavy_played', 'poor_damaged'];
/** Every condition value accepted from the client — must stay a subset of the listings.condition CHECK constraint */
const CONDITION_VALUES = ['complete', 'good', 'fair', 'parts', 'new', 'used', ...TCG_CONDITION_GRADES];

const AUCTION_START_REQUIRED = 'Per le aste è obbligatorio specificare la base d\'asta (auctionStart > 0)';
const AUCTION_END_REQUIRED = 'Per le aste è obbligatoria la data di scadenza (auctionEnd)';
const AUCTION_END_IN_PAST = 'La data di fine asta deve essere nel futuro';

/** Cards are portrait by default, everything else landscape (the seller can override it) */
function defaultImageOrientation(productType) {
  return productType === 'tcg' ? 'portrait' : 'landscape';
}

/** Normalizza campi numerici inviati come stringhe vuote da multipart/form-data */
function normalizeListingBody(body) {
  const b = { ...body };
  ['price', 'year', 'pieces', 'shippingCost', 'auctionStart', 'auctionReserve'].forEach((k) => {
    if (b[k] === '' || b[k] === undefined) delete b[k];
  });
  if (b.type === '' || b.type === undefined) delete b.type;
  return b;
}

/** Converte valori legacy nel tipo salvabile secondo schema.sql */
function coerceListingTypeForDb(type) {
  if (type == null) return 'used';
  const t = String(type).trim().toLowerCase();
  if (t === 'fixed') return 'used';
  return t;
}

/** Maps UI condition values to what the DB CHECK constraint actually allows */
function coerceConditionForDb(condition) {
  if (!condition) return 'used';
  const c = String(condition).trim().toLowerCase();
  // DB allows: 'new', 'used', 'New', 'Used', 'Like New', 'damaged'
  if (c === 'new')       return 'new';
  if (c === 'sealed')    return 'new';
  if (c === 'used')      return 'used';
  if (c === 'complete')  return 'used';   // "complete" used set
  if (c === 'good')      return 'used';
  if (c === 'fair')      return 'used';
  if (c === 'parts')     return 'used';   // spare parts listing
  if (c === 'like new')  return 'Like New';
  if (c === 'damaged')   return 'damaged';
  if (TCG_CONDITION_GRADES.includes(c)) return c; // card grades stored verbatim
  return 'used'; // safe fallback
}

/**
 * An auction that is (or is about to become) live needs a positive starting bid and a future end date.
 * @returns {string|null} the first problem, as shown to the seller
 */
function auctionTermsError(auctionStart, auctionEnd) {
  if (auctionStart == null || auctionStart <= 0) return AUCTION_START_REQUIRED;
  if (auctionEnd == null) return AUCTION_END_REQUIRED;
  if (new Date(auctionEnd) <= new Date()) return AUCTION_END_IN_PAST;
  return null;
}

const draftSchema = Joi.object({
  title: Joi.string().trim().min(1).max(300).required(),
  description: Joi.string().max(10000).allow('', null),
  setNumber: Joi.string().max(20).allow('', null),
  theme: Joi.string().max(100).allow('', null),
  year: Joi.number().integer().min(1900).max(2100).allow(null),
  pieces: Joi.number().integer().min(1).allow(null),
  type: Joi.string()
    .valid(...LISTING_TYPES_DB.filter((x) => x !== 'auction'), ...LISTING_TYPE_LEGACY_ALIASES)
    .default('used'),
  condition: Joi.string().valid(...CONDITION_VALUES).allow(null),
  boxCondition: Joi.string().max(100).allow('', null),
  instructions: Joi.string().max(100).allow('', null),
  proNotes: Joi.string().max(2000).allow('', null),
  isComplete: Joi.boolean().default(false),
  price: Joi.number().positive().allow(null),
  shippingCost: Joi.number().min(0).default(0),
  shippingMethod: Joi.string().max(50).allow('', null),
  shippingOptions: Joi.string().allow('', null),
  // Real weight/dimensions, physical items only (see productDimensions.js).
  // Optional even for lego/funko — omitted values get a per-category
  // default applied server-side rather than being required here.
  weightKg: Joi.number().positive().allow(null),
  lengthCm: Joi.number().positive().allow(null),
  widthCm: Joi.number().positive().allow(null),
  heightCm: Joi.number().positive().allow(null),
  category: Joi.string().valid('sets', 'mocs', 'minifigures').default('sets'),
  productType: Joi.string().valid(...PRODUCT_TYPES).default('lego'),
  game: Joi.string().valid(...TCG_GAMES).when('productType', { is: 'tcg', then: Joi.required(), otherwise: Joi.optional().allow('', null) }),
  imageOrientation: Joi.string().valid(...IMAGE_ORIENTATIONS),
  ...CARD_DETAIL_FIELDS,
  status: Joi.string().valid('draft').required(),
});

const publishSchema = Joi.object({
  title: Joi.string().trim().min(5).max(300).required(),
  description: Joi.string().max(10000).allow('', null),
  setNumber: Joi.string().max(20).allow('', null),
  theme: Joi.string().max(100).allow('', null),
  year: Joi.number().integer().min(1900).max(2100).allow(null),
  pieces: Joi.number().integer().min(1).allow(null),
  type: Joi.string().valid(...LISTING_TYPES_DB, ...LISTING_TYPE_LEGACY_ALIASES).required(),
  condition: Joi.string().valid(...CONDITION_VALUES).required(),
  boxCondition: Joi.string().max(100).allow('', null),
  instructions: Joi.string().max(100).allow('', null),
  proNotes: Joi.string().max(2000).allow('', null),
  isComplete: Joi.boolean().default(false),
  // price is optional for auctions; required for all other types
  price: Joi.number().positive().allow(null),
  auctionStart: Joi.number().positive().allow(null),
  auctionEnd: Joi.date().iso().allow(null),
  auctionReserve: Joi.number().min(0).allow(null),
  shippingCost: Joi.number().min(0).default(0),
  shippingMethod: Joi.string().max(50).allow('', null),
  shippingOptions: Joi.string().allow('', null),
  weightKg: Joi.number().positive().allow(null),
  lengthCm: Joi.number().positive().allow(null),
  widthCm: Joi.number().positive().allow(null),
  heightCm: Joi.number().positive().allow(null),
  category: Joi.string().valid('sets', 'mocs', 'minifigures').required(),
  productType: Joi.string().valid(...PRODUCT_TYPES).default('lego'),
  game: Joi.string().valid(...TCG_GAMES).when('productType', { is: 'tcg', then: Joi.required(), otherwise: Joi.optional().allow('', null) }),
  imageOrientation: Joi.string().valid(...IMAGE_ORIENTATIONS),
  ...CARD_DETAIL_FIELDS,
  status: Joi.string().valid('active').required(),
});

const patchSchema = Joi.object({
  title: Joi.string().min(5).max(300),
  description: Joi.string().max(10000).allow('', null),
  setNumber: Joi.string().max(20).allow('', null),
  theme: Joi.string().max(100).allow('', null),
  year: Joi.number().integer().min(1900).max(2100).allow(null),
  pieces: Joi.number().integer().min(1).allow(null),
  condition: Joi.string().valid(...CONDITION_VALUES).allow(null),
  boxCondition: Joi.string().max(100).allow('', null),
  instructions: Joi.string().max(100).allow('', null),
  proNotes: Joi.string().max(2000).allow('', null),
  isComplete: Joi.boolean().allow(null),
  price: Joi.number().positive().allow(null),
  shippingCost: Joi.number().min(0),
  shippingMethod: Joi.string().max(50).allow('', null),
  shippingOptions: Joi.string().allow('', null),
  weightKg: Joi.number().positive().allow(null),
  lengthCm: Joi.number().positive().allow(null),
  widthCm: Joi.number().positive().allow(null),
  heightCm: Joi.number().positive().allow(null),
  category: Joi.string().valid('sets', 'mocs', 'minifigures'),
  productType: Joi.string().valid(...PRODUCT_TYPES),
  game: Joi.string().valid(...TCG_GAMES).allow('', null),
  imageOrientation: Joi.string().valid(...IMAGE_ORIENTATIONS),
  ...CARD_DETAIL_FIELDS,
  status: Joi.string().valid('draft', 'active', 'removed'),
  // Only ever applied while the listing is still a draft (see listings.service.js updateListing): once an
  // auction has been published its terms are locked, so a currently-active auction's type/bid/end
  // date are silently ignored even if present in the body.
  type: Joi.string().valid(...LISTING_TYPES_DB, ...LISTING_TYPE_LEGACY_ALIASES),
  auctionStart: Joi.number().positive().allow(null),
  auctionEnd: Joi.date().iso().allow(null),
});

/** @returns {{ error: string|null, value: object|null }} */
function validateDraftListing(body) {
  const { error, value } = draftSchema.validate(body, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) return { error: error.details[0].message, value: null };
  return { error: null, value };
}

/** @returns {{ error: string|null, value: object|null }} */
function validatePublishListing(body) {
  const { error, value } = publishSchema.validate(body, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) return { error: error.details[0].message, value: null };

  if (value.type === 'auction') {
    // Auctions require auctionStart and auctionEnd instead of price
    const auctionError = auctionTermsError(value.auctionStart, value.auctionEnd);
    if (auctionError) return { error: auctionError, value: null };
  } else if (value.price == null || value.price <= 0) {
    // Non-auction listings require a price
    return { error: 'Il prezzo è obbligatorio per gli annunci a prezzo fisso', value: null };
  }

  return { error: null, value };
}

/** @returns {{ error: string|null, value: object }} */
function validateListingPatch(body) {
  const { error, value } = patchSchema.validate(body, { stripUnknown: true });
  return { error: error ? error.details[0].message : null, value };
}

module.exports = {
  LISTING_TYPES_DB,
  CARD_SET_ID_PATTERN,
  defaultImageOrientation,
  normalizeListingBody,
  coerceListingTypeForDb,
  coerceConditionForDb,
  auctionTermsError,
  validateDraftListing,
  validatePublishListing,
  validateListingPatch,
};
