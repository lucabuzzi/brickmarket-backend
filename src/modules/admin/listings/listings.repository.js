// SQL behind admin listing moderation: the management table, hide/unhide, admin removal, restore.
const { query } = require('../../../db');

/**
 * The management table, featured-and-current first, then newest.
 * @param {object} f  search (title or seller), featured ('true'/'false'), status (any but 'all'), type ('auction'/'fixed')
 */
async function findForModeration(f, limit, offset) {
  const parts = [];
  const params = [];
  if (f.search) {
    params.push(`%${f.search}%`);
    parts.push(`(l.title ILIKE $${params.length} OR u.username ILIKE $${params.length})`);
  }
  if (f.featured === 'true') {
    parts.push(`l.is_featured = true AND (l.featured_until IS NULL OR l.featured_until > NOW())`);
  } else if (f.featured === 'false') {
    parts.push(`(l.is_featured = false OR l.is_featured IS NULL)`);
  }
  if (f.status && f.status !== 'all') {
    params.push(f.status);
    parts.push(`l.status = $${params.length}`);
  }
  if (f.type === 'auction') {
    parts.push(`(l.type = 'auction' OR l.is_auction = true)`);
  } else if (f.type === 'fixed') {
    parts.push(`(l.type <> 'auction' AND (l.is_auction IS NULL OR l.is_auction = false))`);
  }
  const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';

  params.push(limit, offset);
  const result = await query(
    `SELECT l.id, l.title, l.status, l.price, l.type, l.is_auction,
            l.auction_end, l.current_bid, l.bids_count,
            l.is_featured, l.featured_until, l.featured_source, l.created_at,
            l.hidden_reason, l.hidden_at, hb.username AS hidden_by_username,
            u.username AS seller_username, u.id AS seller_id
     FROM listings l
     JOIN users u ON u.id = l.seller_id
     LEFT JOIN users hb ON hb.id = l.hidden_by
     ${where}
     ORDER BY (l.is_featured = true AND (l.featured_until IS NULL OR l.featured_until > NOW())) DESC,
              l.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
}

/** Hides a listing (not sold or removed), recording why and by whom. @returns the row, or null */
async function hide(id, reason, adminId) {
  const result = await query(
    `UPDATE listings
     SET status = 'hidden', hidden_reason = $1, hidden_by = $2, hidden_at = NOW(), updated_at = NOW()
     WHERE id = $3 AND status NOT IN ('sold', 'removed')
     RETURNING *`,
    [reason, adminId, id]
  );
  return result.rows[0] || null;
}

/** hidden -> active, clearing the moderation fields. @returns the row, or null */
async function unhide(id) {
  const result = await query(
    `UPDATE listings
     SET status = 'active', hidden_reason = NULL, hidden_by = NULL, hidden_at = NULL, updated_at = NOW()
     WHERE id = $1 AND status = 'hidden'
     RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

/** Admin soft delete of anything not sold; the moderation fields double as its audit trail. @returns the row, or null */
async function removeByAdmin(id, reason, adminId) {
  const result = await query(
    `UPDATE listings
     SET status = 'removed', hidden_reason = $1, hidden_by = $2, hidden_at = NOW(), updated_at = NOW()
     WHERE id = $3 AND status <> 'sold'
     RETURNING *`,
    [reason, adminId, id]
  );
  return result.rows[0] || null;
}

/** Any status -> active, clearing the moderation fields. @returns the row, or null */
async function restore(id) {
  const result = await query(
    `UPDATE listings
     SET status = 'active', hidden_reason = NULL, hidden_by = NULL, hidden_at = NULL, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

async function exists(id) {
  const result = await query('SELECT id FROM listings WHERE id = $1', [id]);
  return result.rows.length > 0;
}

/** In-app notification to the seller about a moderation action, with its reason. */
function notifySeller(sellerId, messageKey, listingId, reason) {
  return query(
    `INSERT INTO notifications (user_id, message_key, listing_id, reason) VALUES ($1, $2, $3, $4)`,
    [sellerId, messageKey, listingId, reason]
  );
}

module.exports = { findForModeration, hide, unhide, removeByAdmin, restore, exists, notifySeller };
