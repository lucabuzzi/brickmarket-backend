// Every SQL statement behind /api/listings, and nothing else: no req/res, no validation, no business rules.
// Functions that take a `client` run inside the caller's transaction (see bids.service.js).
const { query } = require('../../db');
const { CARD_DETAIL_COLUMNS } = require('../../services/cardDetails');

/** The seller's public profile, for a query with `JOIN users u ON l.seller_id = u.id` (see listings.mapper.js). */
const SELLER_COLUMNS = `u.username as seller_username,
              u.avatar_url as seller_avatar,
              u.rating_avg as seller_rating,
              u.is_verified as seller_is_verified,
              u.is_pro as seller_is_pro,
              u.seller_type as seller_seller_type,
              u.company_name as seller_company_name`;

// ─── Create ─────────────────────────────────────────────────────────────────

/** Column order of the INSERT; `insertListing` takes one value per column. */
const INSERT_COLUMNS = [
  'seller_id', 'title', 'description', 'set_number', 'theme', 'year', 'pieces',
  'type', 'condition',
  'price', 'auction_start', 'auction_end', 'auction_reserve', 'current_bid',
  'status', 'images', 'shipping_cost', 'shipping_method', 'shipping_options',
  'box_condition', 'instructions', 'pro_notes', 'is_complete',
  'category', 'package_size', 'product_type', 'game',
  'weight_kg', 'length_cm', 'width_cm', 'height_cm', 'image_orientation',
  'card_language', 'card_rarity', 'card_grading_company', 'card_grade',
  'card_set_id', 'card_number', 'card_external_id',
];
const INSERT_SQL = `INSERT INTO listings (
        ${INSERT_COLUMNS.join(', ')}
      ) VALUES (
        ${INSERT_COLUMNS.map((_, i) => `$${i + 1}`).join(',')}
      ) RETURNING *`;

/** @param {Record<string, any>} row one value for each of INSERT_COLUMNS */
async function insertListing(row) {
  const result = await query(INSERT_SQL, INSERT_COLUMNS.map((col) => row[col]));
  return result.rows[0];
}

// ─── Reads ──────────────────────────────────────────────────────────────────

async function findBySeller(sellerId) {
  const result = await query(
    "SELECT * FROM listings WHERE seller_id = $1 AND status <> 'removed' ORDER BY created_at DESC",
    [sellerId]
  );
  return result.rows;
}

/**
 * The public feed, with the seller. Every filter is optional (falsy = not applied).
 * @param {object} f
 * @param {{ eq: string } | 'public'} f.status  one status, or every public one (never drafts or hidden listings)
 * @param {boolean} [f.isAuction]   true / false / undefined (either)
 * @param {boolean} [f.isFeatured]  true / false / undefined (either)
 * @param {'auction'|'newest'} f.sort
 * @param {number} [f.limit]
 */
async function findPublic(f) {
  const params = [];
  const parts = [];

  if (f.status === 'public') {
    // Everything except drafts and listings hidden by admin moderation
    // (/admin/listings/:id/hide must not be bypassable with a query param).
    parts.push(`l.status NOT IN ('draft', 'hidden')`);
  } else {
    params.push(f.status.eq);
    parts.push(`l.status = $${params.length}`);
  }

  if (f.type) {
    params.push(f.type);
    parts.push(`l.type = $${params.length}`);
  }

  if (f.isAuction === true) {
    parts.push(`(l.type = 'auction' OR l.is_auction = true)`);
  } else if (f.isAuction === false) {
    parts.push(`(l.type <> 'auction' AND (l.is_auction = false OR l.is_auction IS NULL))`);
  }

  if (f.theme) {
    params.push(`%${f.theme}%`);
    parts.push(`l.theme ILIKE $${params.length}`);
  }

  if (f.isFeatured === true) {
    parts.push(`l.is_featured = true`);
  } else if (f.isFeatured === false) {
    parts.push(`l.is_featured = false`);
  }

  for (const [value, column] of [[f.category, 'category'], [f.productType, 'product_type'], [f.game, 'game'], [f.cardSet, 'card_set_id']]) {
    if (!value) continue;
    params.push(value);
    parts.push(`l.${column} = $${params.length}`);
  }

  const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';

  const orderBy = f.sort === 'auction'
    ? `ORDER BY CASE WHEN l.status = 'active' THEN 0 ELSE 1 END, l.auction_end ASC NULLS LAST, l.created_at DESC`
    : 'ORDER BY l.created_at DESC';

  let limitClause = '';
  if (f.limit) {
    params.push(f.limit);
    limitClause = `LIMIT $${params.length}`;
  }

  const result = await query(
    `SELECT l.*,
            ${SELLER_COLUMNS}
     FROM listings l
     JOIN users u ON l.seller_id = u.id
     ${where}
     ${orderBy}
     ${limitClause}`,
    params
  );
  return result.rows;
}

async function findArchive() {
  const result = await query(
    `SELECT l.*,
            ${SELLER_COLUMNS}
     FROM listings l
     JOIN users u ON l.seller_id = u.id
     WHERE l.status IN ('sold', 'expired')
     ORDER BY l.updated_at DESC, l.created_at DESC`
  );
  return result.rows;
}

/** Active listings whose title, set number or theme contains `text`. */
async function searchActive(text) {
  const result = await query(
    `SELECT l.*,
            ${SELLER_COLUMNS}
     FROM listings l
     JOIN users u ON l.seller_id = u.id
     WHERE (l.title ILIKE $1 OR l.set_number ILIKE $1 OR l.theme ILIKE $1)
       AND l.status = 'active'
     ORDER BY l.created_at DESC`,
    [`%${text}%`]
  );
  return result.rows;
}

/** One listing with its seller and the username of its highest bidder (null without bids). */
async function findDetail(id) {
  const result = await query(
    `SELECT l.*,
            ${SELLER_COLUMNS},
            (SELECT u2.username FROM bids b JOIN users u2 ON b.bidder_id = u2.id WHERE b.listing_id = l.id ORDER BY b.amount DESC, b.created_at ASC LIMIT 1) as highest_bidder_username
     FROM listings l
     JOIN users u ON l.seller_id = u.id
     WHERE l.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

function incrementViews(id) {
  return query(`UPDATE listings SET views_count = views_count + 1 WHERE id = $1`, [id]);
}

/** The buyer's own country (users.address_country), null when unset or unknown. */
async function findUserCountry(userId) {
  const result = await query('SELECT address_country FROM users WHERE id = $1', [userId]);
  return result.rows.length > 0 ? result.rows[0].address_country : null;
}

async function findById(id) {
  const result = await query('SELECT * FROM listings WHERE id = $1', [id]);
  return result.rows[0];
}

/** Just enough to decide who may promote a listing. */
async function findOwnership(id) {
  const result = await query('SELECT id, seller_id, status FROM listings WHERE id = $1', [id]);
  return result.rows[0] || null;
}

// ─── Update / delete ────────────────────────────────────────────────────────

/** The seller's own listing as it is before an edit; null when it doesn't exist or isn't theirs. */
async function findEditableState(id, sellerId) {
  const result = await query(
    'SELECT status, type, auction_start, auction_end FROM listings WHERE id = $1 AND seller_id = $2',
    [id, sellerId]
  );
  return result.rows[0] || null;
}

/** Validated PATCH fields (camelCase) -> listings columns. */
const PATCH_COLUMNS = {
  title: 'title',
  description: 'description',
  setNumber: 'set_number',
  theme: 'theme',
  year: 'year',
  pieces: 'pieces',
  condition: 'condition',
  boxCondition: 'box_condition',
  instructions: 'instructions',
  proNotes: 'pro_notes',
  isComplete: 'is_complete',
  price: 'price',
  shippingCost: 'shipping_cost',
  shippingMethod: 'shipping_method',
  status: 'status',
  category: 'category',
  weightKg: 'weight_kg',
  lengthCm: 'length_cm',
  widthCm: 'width_cm',
  heightCm: 'height_cm',
  productType: 'product_type',
  game: 'game',
  imageOrientation: 'image_orientation',
  type: 'type',
  auctionStart: 'auction_start',
  auctionEnd: 'auction_end',
  currentBid: 'current_bid',
  ...CARD_DETAIL_COLUMNS,
};

/**
 * The [column, value] pairs for the fields of `fields` that map to a column, in the fields' own order.
 * Undefined values and unmapped keys are skipped.
 */
function patchColumns(fields) {
  const out = [];
  for (const [key, value] of Object.entries(fields)) {
    const column = PATCH_COLUMNS[key];
    if (column && value !== undefined) out.push([column, value]);
  }
  return out;
}

/**
 * Applies `changes` ([column, value] pairs, in order) to the seller's own listing.
 * @returns the updated row, or null when the listing doesn't exist or isn't theirs
 */
async function updateOwnedListing(id, sellerId, changes) {
  const params = changes.map(([, value]) => value);
  const sets = changes.map(([column], i) => `${column} = $${i + 1}`);
  params.push(id, sellerId);
  const result = await query(
    `UPDATE listings SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length - 1} AND seller_id = $${params.length}
     RETURNING *`,
    params
  );
  return result.rows[0] || null;
}

/** Soft delete; sold listings stay. @returns whether a row was removed */
async function softDeleteOwned(id, sellerId) {
  const result = await query(
    `UPDATE listings SET status = 'removed', updated_at = NOW()
     WHERE id = $1 AND seller_id = $2 AND status <> 'sold'
     RETURNING id`,
    [id, sellerId]
  );
  return result.rows.length > 0;
}

// ─── Bids (inside the caller's transaction) ────────────────────────────────

/** Locks the listing row until the transaction ends, so concurrent bids are serialised. */
async function lockForBid(client, id) {
  const result = await client.query(`SELECT * FROM listings WHERE id = $1 FOR UPDATE`, [id]);
  return result.rows[0] || null;
}

async function findTopBidderId(client, listingId) {
  const result = await client.query(
    `SELECT bidder_id FROM bids WHERE listing_id = $1 ORDER BY amount DESC, created_at ASC LIMIT 1`,
    [listingId]
  );
  return result.rows.length > 0 ? result.rows[0].bidder_id : null;
}

function insertBid(client, listingId, bidderId, amount) {
  return client.query(
    `INSERT INTO bids (listing_id, bidder_id, amount, created_at) VALUES ($1, $2, $3, NOW())`,
    [listingId, bidderId, amount]
  );
}

/** Records the new top bid; `newAuctionEnd` (anti-sniping) moves the end date when set. */
async function recordTopBid(client, listingId, amount, newAuctionEnd) {
  const result = newAuctionEnd
    ? await client.query(
      `UPDATE listings SET current_bid = $1, bids_count = bids_count + 1, updated_at = NOW(), auction_end = $3 WHERE id = $2 RETURNING *`,
      [amount, listingId, newAuctionEnd]
    )
    : await client.query(
      `UPDATE listings SET current_bid = $1, bids_count = bids_count + 1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [amount, listingId]
    );
  return result.rows[0];
}

function insertOutbidNotification(client, userId, listingId) {
  return client.query(
    `INSERT INTO notifications (user_id, message_key, listing_id) VALUES ($1, $2, $3)`,
    [userId, 'notifications.outbid', listingId]
  );
}

module.exports = {
  SELLER_COLUMNS,
  insertListing,
  findBySeller,
  findPublic,
  findArchive,
  searchActive,
  findDetail,
  incrementViews,
  findUserCountry,
  findById,
  findOwnership,
  findEditableState,
  patchColumns,
  updateOwnedListing,
  softDeleteOwned,
  lockForBid,
  findTopBidderId,
  insertBid,
  recordTopBid,
  insertOutbidNotification,
};
