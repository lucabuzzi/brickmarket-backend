// SQL behind the admin order pages: seller payouts (paid off-Stripe) and the sales archive.
const { query } = require('../../../db');

/** Paid orders whose seller payout is in `payoutStatus`, newest first. */
async function findPayouts(payoutStatus) {
  const result = await query(`
    SELECT
      o.id, o.item_price, o.shipping_cost, o.seller_payout, o.status AS order_status,
      o.payout_status, o.payout_paid_at, o.payout_notes, o.created_at,
      l.title AS listing_title, l.set_number,
      us.username AS seller_username, us.id AS seller_id,
      ub.username AS buyer_username
    FROM orders o
    JOIN listings l ON l.id = o.listing_id
    JOIN users us ON us.id = o.seller_id
    JOIN users ub ON ub.id = o.buyer_id
    WHERE o.status IN ('payment_received', 'completed')
      AND o.payout_status = $1
    ORDER BY o.created_at DESC
  `, [payoutStatus]);
  return result.rows;
}

/** pending -> paid, with notes. @returns whether the order was pending */
async function markPayoutPaid(orderId, notes) {
  const result = await query(
    `UPDATE orders SET payout_status='paid', payout_paid_at=NOW(), payout_notes=$1
     WHERE id=$2 AND payout_status='pending'
     RETURNING id`,
    [notes, orderId]
  );
  return result.rows.length > 0;
}

/** paid -> pending, clearing date and notes. @returns whether the order was paid */
async function unmarkPayout(orderId) {
  const result = await query(
    `UPDATE orders SET payout_status='pending', payout_paid_at=NULL, payout_notes=NULL
     WHERE id=$1 AND payout_status='paid'
     RETURNING id`,
    [orderId]
  );
  return result.rows.length > 0;
}

/** paid -> archived. @returns whether the order was paid */
async function archivePayout(orderId) {
  const result = await query(
    `UPDATE orders SET payout_status='archived'
     WHERE id=$1 AND payout_status='paid'
     RETURNING id`,
    [orderId]
  );
  return result.rows.length > 0;
}

/** Closed listings (sold, expired, removed) with their sale's buyer, seller and fees when there was one. */
async function findSalesArchive() {
  const result = await query(`
    SELECT
      l.id, l.title, l.status, l.price as listing_price, l.updated_at as archived_at,
      o.id as order_id, o.buyer_id, o.seller_id,
      ub.username as buyer_username, us.username as seller_username,
      o.shipping_cost, o.platform_fee, o.total_buyer, o.created_at as sale_date,
      o.selected_carrier
    FROM listings l
    LEFT JOIN orders o ON l.id = o.listing_id
    LEFT JOIN users ub ON o.buyer_id = ub.id
    LEFT JOIN users us ON l.seller_id = us.id
    WHERE l.status IN ('sold', 'expired', 'removed')
    ORDER BY l.updated_at DESC
  `);
  return result.rows;
}

module.exports = { findPayouts, markPayoutPaid, unmarkPayout, archivePayout, findSalesArchive };
