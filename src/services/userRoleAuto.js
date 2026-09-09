const { query } = require('../db');

// Roles the auto-promotion logic is allowed to touch. 'admin' and 'shop' are
// deliberate admin-only designations and are never overwritten by activity.
const AUTO_MANAGED_ROLES = ['buyer', 'seller', 'both'];

/**
 * Recomputes a user's role from their actual marketplace activity:
 *   - bought (a completed/paid direct-purchase order, OR the highest bid on
 *     an auction listing that has since ended) -> 'buyer'
 *   - sold (created at least one listing, any status) -> 'seller'
 *   - both -> 'both' (shown to admins as "Trader" — see AdminUserDetail.jsx)
 * No-ops for admin/shop accounts, and for a user whose computed role hasn't
 * changed. Safe to call repeatedly — it's a pure recomputation, not an
 * increment.
 */
async function recomputeUserRole(userId) {
  try {
    const currentRes = await query('SELECT role FROM users WHERE id = $1', [userId]);
    const currentRole = currentRes.rows[0]?.role;
    if (!currentRole || !AUTO_MANAGED_ROLES.includes(currentRole)) return;

    const activityRes = await query(`
      SELECT
        EXISTS(
          SELECT 1 FROM orders WHERE buyer_id = $1 AND status IN ('payment_received', 'completed')
        ) AS has_bought_direct,
        EXISTS(
          SELECT 1 FROM bids b
          JOIN listings l ON l.id = b.listing_id
          WHERE b.bidder_id = $1 AND l.type = 'auction' AND l.status IN ('expired', 'sold')
            AND b.amount = (SELECT MAX(b2.amount) FROM bids b2 WHERE b2.listing_id = l.id)
        ) AS has_bought_auction,
        EXISTS(SELECT 1 FROM listings WHERE seller_id = $1) AS has_sold
    `, [userId]);

    const { has_bought_direct, has_bought_auction, has_sold } = activityRes.rows[0];
    const hasBought = has_bought_direct || has_bought_auction;

    let targetRole;
    if (hasBought && has_sold) targetRole = 'both';
    else if (has_sold) targetRole = 'seller';
    else if (hasBought) targetRole = 'buyer';
    else targetRole = 'buyer'; // no activity yet — stays at the default

    if (targetRole !== currentRole) {
      await query('UPDATE users SET role = $1 WHERE id = $2', [targetRole, userId]);
    }
  } catch (err) {
    // Never let role auto-promotion break the action that triggered it
    // (creating a listing, processing a payment webhook, ...).
    console.error('ROLE AUTO-PROMOTION ERROR:', err.message);
  }
}

/**
 * Marks ended auctions as expired (the same lazy housekeeping query the
 * listings routes already ran inline) and, for each one that just expired,
 * recomputes the highest bidder's role — this is the "won an auction" half
 * of the buyer trigger, since auction wins aren't tracked as a discrete
 * settlement event anywhere else in the codebase.
 */
async function expireEndedAuctionsAndPromoteWinners() {
  try {
    const expiredRes = await query(
      `UPDATE listings SET status = 'expired' WHERE status = 'active' AND type = 'auction' AND auction_end < NOW() RETURNING id`
    );
    for (const row of expiredRes.rows) {
      const winnerRes = await query(
        `SELECT bidder_id FROM bids WHERE listing_id = $1 ORDER BY amount DESC, created_at ASC LIMIT 1`,
        [row.id]
      );
      const winnerId = winnerRes.rows[0]?.bidder_id;
      if (winnerId) await recomputeUserRole(winnerId);
    }
  } catch (err) {
    console.error('AUCTION EXPIRE / ROLE PROMOTION ERROR:', err.message);
  }
}

module.exports = { recomputeUserRole, expireEndedAuctionsAndPromoteWinners, AUTO_MANAGED_ROLES };
