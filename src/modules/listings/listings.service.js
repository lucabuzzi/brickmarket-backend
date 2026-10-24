// Listings use cases: create (draft or publish), the public reads (feed, archive, search, detail), the seller's
// own list, edit and soft delete. Rules live here; SQL lives in listings.repository.js; HTTP in the controller.
// Every refusal is an HttpError carrying the exact status and message the client sees.
const HttpError = require('../../http/HttpError');
const repo = require('./listings.repository');
const { withSeller } = require('./listings.mapper');
const {
  LISTING_TYPES_DB, CARD_SET_ID_PATTERN,
  defaultImageOrientation, normalizeListingBody, coerceListingTypeForDb, coerceConditionForDb, auctionTermsError,
  validateDraftListing, validatePublishListing, validateListingPatch,
} = require('./listings.validators');
const { checkCardDetails, cardDetailsForDb } = require('../../services/cardDetails');
const { uploadOrSaveProcessedImage } = require('../../services/image');
const { calculateShippingRates } = require('../../services/shipping');
const { applyDimensionDefaults, packageSizeFromWeight } = require('../../services/productDimensions');
const { expireEndedAuctions } = require('../../services/auctionExpiry');
const featured = require('../../services/featured');
const { notifyListingChanged } = require('../../integrations/indexnow');

/** Sellers ship from Italy (users has no seller-country column), and buyers without an address count as Italian. */
const DEFAULT_COUNTRY = 'it';

/** shippingOptions arrives as a JSON string; a blank or malformed one counts as "no options". */
function parseShippingOptions(raw) {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

/**
 * Resizes and stores the uploaded photos, in order.
 * @returns {Promise<string[]|null>} their URLs, or null when nothing was uploaded
 */
async function processImages(files) {
  if (!files || files.length === 0) return null;
  const urls = [];
  try {
    for (const file of files) urls.push(await uploadOrSaveProcessedImage(file.buffer));
  } catch (procErr) {
    console.error('Image processing failed:', procErr);
    throw new HttpError(500, 'Errore durante l\'ottimizzazione delle immagini');
  }
  return urls;
}

// ─── Create ─────────────────────────────────────────────────────────────────

/** The INSERT row for a validated listing (see repo.insertListing). */
function newListingRow(sellerId, v, imageUrls) {
  const isAuction = v.type === 'auction';
  const cardCols = cardDetailsForDb(v, v.productType);
  // weightKg/lengthCm/widthCm/heightCm are optional even for physical
  // listings — whatever's missing gets a per-category default here, so the
  // row never ends up with a physical item and no shipping dimensions.
  // package_size is derived from weight, not seller-picked (see
  // productDimensions.js) — kept in sync for the code that still reads it.
  const dims = applyDimensionDefaults({
    productType: v.productType || 'lego',
    category: v.category,
    weightKg: v.weightKg ?? null,
    lengthCm: v.lengthCm ?? null,
    widthCm: v.widthCm ?? null,
    heightCm: v.heightCm ?? null,
  });
  return {
    seller_id: sellerId,
    title: v.title,
    description: v.description || null,
    set_number: v.setNumber || null,
    theme: v.theme || null,
    year: v.year ?? null,
    pieces: v.pieces ?? null,
    type: v.type,
    condition: v.condition || null,
    price: isAuction ? null : v.price,
    auction_start: isAuction ? v.auctionStart : null,
    auction_end: isAuction ? new Date(v.auctionEnd) : null,
    auction_reserve: v.auctionReserve ?? null,
    // current_bid starts out equal to the starting bid until the first real bid
    current_bid: isAuction ? v.auctionStart : null,
    status: v.status,
    images: imageUrls.length ? imageUrls : null,
    shipping_cost: v.shippingCost,
    shipping_method: v.shippingMethod || null,
    shipping_options: JSON.stringify(parseShippingOptions(v.shippingOptions)),
    box_condition: v.boxCondition || null,
    instructions: v.instructions || null,
    pro_notes: v.proNotes || null,
    is_complete: v.isComplete ?? false,
    category: v.category,
    package_size: packageSizeFromWeight(dims.weightKg),
    product_type: v.productType || 'lego',
    game: v.productType === 'tcg' ? (v.game || null) : null,
    weight_kg: dims.weightKg,
    length_cm: dims.lengthCm,
    width_cm: dims.widthCm,
    height_cm: dims.heightCm,
    image_orientation: v.imageOrientation || defaultImageOrientation(v.productType),
    card_language: cardCols.cardLanguage,
    card_rarity: cardCols.cardRarity,
    card_grading_company: cardCols.cardGradingCompany,
    card_grade: cardCols.cardGrade,
    card_set_id: cardCols.cardSetId,
    card_number: cardCols.cardNumber,
    card_external_id: cardCols.cardExternalId,
  };
}

/**
 * Creates a listing as a draft (`status: 'draft'`, lenient) or published (`status: 'active'`, complete and
 * with at least one photo). A published listing is announced to IndexNow.
 * @returns the stored row
 */
async function createListing(sellerId, body, files) {
  const raw = normalizeListingBody(body);
  const isDraft = raw.status === 'draft';
  const { error, value } = isDraft ? validateDraftListing(raw) : validatePublishListing(raw);
  if (error) throw new HttpError(400, error);

  value.type = coerceListingTypeForDb(value.type);
  if (!LISTING_TYPES_DB.includes(value.type)) {
    throw new HttpError(400, `type non valido. Valori ammessi: ${LISTING_TYPES_DB.join(', ')}`);
  }
  if (value.condition) value.condition = coerceConditionForDb(value.condition);

  const cardError = checkCardDetails(value);
  if (cardError) throw new HttpError(400, cardError);

  if (!isDraft && (!files || files.length === 0)) {
    throw new HttpError(400, 'Almeno un\'immagine è obbligatoria per pubblicare');
  }

  const imageUrls = (await processImages(files)) || [];

  try {
    const created = await repo.insertListing(newListingRow(sellerId, value, imageUrls));
    // Public listing -> tell IndexNow (Bing & co.) right away. Fire-and-forget; no-op without INDEXNOW_KEY.
    if (created.status === 'active') notifyListingChanged(created.id);
    return created;
  } catch (err) {
    console.error('\n=== FULL DB ERROR ===');
    console.error('Message:', err.message);
    console.error('Detail:', err.detail);
    console.error('Code:', err.code);
    console.error('Stack:', err.stack);
    throw new HttpError(500, 'Errore durante la creazione: ' + err.message);
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/** The seller's own listings, except removed ones, newest first. */
function listOwn(sellerId) {
  return repo.findBySeller(sellerId);
}

/**
 * Which statuses the anonymous feed may show. No status -> active only; 'all' -> every public status;
 * any other value is accepted only if non-sensitive (active/sold/expired), else falls back to active, so a
 * query param can never expose drafts, removed or hidden listings.
 */
function publicStatusFilter(status) {
  if (status === undefined || status === '') return { eq: 'active' };
  if (status === 'all') return 'public';
  return { eq: ['active', 'sold', 'expired'].includes(status) ? status : 'active' };
}

const triState = (v) => (v === 'true' ? true : v === 'false' ? false : undefined);

/** A positive integer limit, or undefined (no limit) for anything else. */
function parseLimit(limit) {
  if (!limit) return undefined;
  const n = parseInt(limit, 10);
  return !isNaN(n) && n > 0 ? n : undefined;
}

/** The public feed for the given query-string filters, with each listing's seller. */
async function listPublic(q) {
  // Lazy housekeeping before reading: ended auctions -> expired, lapsed "in evidenza" windows -> off.
  await expireEndedAuctions();
  await featured.expireFeaturedListings();

  const rows = await repo.findPublic({
    status: publicStatusFilter(q.status),
    type: q.type,
    isAuction: triState(q.is_auction),
    theme: q.theme,
    isFeatured: triState(q.is_featured),
    category: q.category,
    productType: q.product_type,
    game: q.game,
    cardSet: q.card_set && CARD_SET_ID_PATTERN.test(String(q.card_set)) ? String(q.card_set) : undefined,
    sort: q.sort === 'auction' ? 'auction' : 'newest',
    limit: parseLimit(q.limit),
  });
  return rows.map(withSeller);
}

/** Sold and expired listings, most recently closed first. */
async function listArchive() {
  await expireEndedAuctions();
  return (await repo.findArchive()).map(withSeller);
}

async function search(text) {
  if (!text) return [];
  return (await repo.searchActive(text)).map(withSeller);
}

/**
 * One listing with its seller, its highest bidder, and shipping rates for this buyer's country
 * (`buyerId` null for an anonymous visitor). Counts a view without waiting for it.
 */
async function getDetail(id, buyerId) {
  const row = await repo.findDetail(id);
  if (!row) throw new HttpError(404, 'Non trovato');

  repo.incrementViews(id).catch(console.error);

  const listing = withSeller(row);
  listing.seller.country = DEFAULT_COUNTRY;

  let buyerCountry = DEFAULT_COUNTRY;
  if (buyerId) {
    try {
      buyerCountry = (await repo.findUserCountry(buyerId)) || DEFAULT_COUNTRY;
    } catch (e) { /* rates for the default country */ }
  }

  listing.shipping_options = calculateShippingRates(
    listing.shipping_options,
    listing.seller.country,
    buyerCountry,
    listing.package_size
  );
  return listing;
}

// ─── Update / delete ────────────────────────────────────────────────────────

/**
 * Edits the seller's own listing with the fields sent; new photos replace the old ones.
 * Auction terms (type, starting bid, end date) are only ever written while the listing is still a draft —
 * that's how a drafted auction gets its terms (the client omits them once published). An already-published
 * auction's terms are immutable: they're silently dropped rather than let a PATCH rewrite a live auction.
 * @returns the updated row
 */
async function updateListing(id, sellerId, body, files) {
  const { error, value } = validateListingPatch(body);
  if (error) throw new HttpError(400, error);
  const cardError = checkCardDetails(value);
  if (cardError) throw new HttpError(400, cardError);
  Object.assign(value, cardDetailsForDb(value, value.productType, { partial: true }));

  // A DB failure here is answered 500 by the controller's handle() fallback.
  const current = await repo.findEditableState(id, sellerId);
  if (current && current.status !== 'draft') {
    delete value.type;
    delete value.auctionStart;
    delete value.auctionEnd;
  }
  if (value.type !== undefined) value.type = coerceListingTypeForDb(value.type);
  // Mirrors create: current_bid starts out equal to the starting bid until the first real bid.
  if (value.auctionStart !== undefined) value.currentBid = value.auctionStart;

  if (current) {
    const targetStatus = value.status !== undefined ? value.status : current.status;
    const targetType = value.type !== undefined ? value.type : current.type;
    if (targetStatus === 'active' && targetType === 'auction') {
      const auctionError = auctionTermsError(
        value.auctionStart !== undefined ? value.auctionStart : current.auction_start,
        value.auctionEnd !== undefined ? value.auctionEnd : current.auction_end
      );
      if (auctionError) throw new HttpError(400, auctionError);
    }
  }

  const newImages = await processImages(files);

  const changes = repo.patchColumns(value);
  // package_size is derived from weight (see productDimensions.js), not patched directly.
  if (value.weightKg !== undefined) changes.push(['package_size', packageSizeFromWeight(value.weightKg)]);
  if (value.shippingOptions !== undefined) {
    changes.push(['shipping_options', JSON.stringify(parseShippingOptions(value.shippingOptions))]);
  }
  if (newImages) changes.push(['images', newImages]);
  if (changes.length === 0) throw new HttpError(400, 'Nessun campo da aggiornare');

  let updated;
  try {
    updated = await repo.updateOwnedListing(id, sellerId, changes);
  } catch (err) {
    console.error('PATCH listing:', err.message);
    throw new HttpError(500, 'Errore aggiornamento');
  }
  if (!updated) throw new HttpError(403, 'Non autorizzato o annuncio inesistente');
  return updated;
}

/** Soft delete (status 'removed') of the seller's own listing; sold listings can't be removed. */
async function removeListing(id, sellerId) {
  if (!(await repo.softDeleteOwned(id, sellerId))) {
    throw new HttpError(403, 'Non autorizzato o annuncio non eliminabile');
  }
}

module.exports = {
  createListing,
  listOwn,
  listPublic,
  listArchive,
  search,
  getDetail,
  updateListing,
  removeListing,
};
