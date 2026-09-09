const { query, getClient } = require('../db');

function findActiveListingById(id) {
  return query(`SELECT l.* FROM listings l WHERE l.id=$1 AND l.status='active'`, [id])
    .then((r) => r.rows[0] || null);
}

function findActiveListingsByIds(ids) {
  return query(`SELECT l.* FROM listings l WHERE l.id = ANY($1) AND l.status = 'active'`, [ids])
    .then((r) => r.rows);
}

async function insertOrder({
  buyerId, sellerId, listingId, itemPrice, shippingCost, platformFee, sellerFee,
  totalBuyer, sellerPayout, stripePaymentIntentId, selectedCarrier = null,
}) {
  const result = await query(`
    INSERT INTO orders
      (buyer_id, seller_id, listing_id,
       item_price, shipping_cost, platform_fee, seller_fee,
       total_buyer, seller_payout,
       status, stripe_payment_intent_id, payment_gateway,
       selected_carrier, confirm_deadline)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
            'pending_payment',$10,'stripe',
            $11, NOW() + INTERVAL '5 days')
    RETURNING id
  `, [
    buyerId, sellerId, listingId,
    itemPrice, shippingCost, platformFee, sellerFee,
    totalBuyer, sellerPayout,
    stripePaymentIntentId, selectedCarrier,
  ]);
  return result.rows[0].id;
}

async function completeDeliveryConfirmation(orderId, buyerId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `SELECT * FROM orders WHERE id=$1 AND buyer_id=$2 AND status='shipped'`,
      [orderId, buyerId]
    );
    const order = orderRes.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      "UPDATE orders SET status='completed', confirmed_at=NOW() WHERE id=$1",
      [order.id]
    );
    await client.query(
      'UPDATE users SET sales_count=sales_count+1 WHERE id=$1',
      [order.seller_id]
    );

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function markOrdersPaymentReceivedByIntent(paymentIntentId) {
  await query(
    "UPDATE orders SET status='payment_received' WHERE stripe_payment_intent_id=$1",
    [paymentIntentId]
  );
  const result = await query(
    `SELECT * FROM orders WHERE stripe_payment_intent_id=$1`,
    [paymentIntentId]
  );
  return result.rows;
}

function markListingSold(listingId) {
  return query(
    "UPDATE listings SET status='sold', updated_at=NOW() WHERE id=$1",
    [listingId]
  );
}

function markOrdersCancelledByIntent(paymentIntentId) {
  return query(
    "UPDATE orders SET status='cancelled' WHERE stripe_payment_intent_id=$1",
    [paymentIntentId]
  );
}

function updateOrderPaypalCapture({ paypalOrderId, captureId, listingId, buyerId }) {
  return query(
    "UPDATE orders SET status='payment_received', paypal_order_id=$1, paypal_capture_id=$2 WHERE listing_id=$3 AND buyer_id=$4",
    [paypalOrderId, captureId, listingId, buyerId]
  );
}

module.exports = {
  findActiveListingById,
  findActiveListingsByIds,
  insertOrder,
  completeDeliveryConfirmation,
  markOrdersPaymentReceivedByIntent,
  markListingSold,
  markOrdersCancelledByIntent,
  updateOrderPaypalCapture,
};
