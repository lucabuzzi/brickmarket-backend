const { query } = require('../db');

async function create({
  sellerId, buyerId, macroCategory, stripePaymentIntentId,
  shippingMethod, shippingCost, rateSource, totalWeightKg,
  shipFromAddress, shipToAddress, sendcloudShippingOptionCode = null,
}) {
  const result = await query(
    `INSERT INTO shipments
       (seller_id, buyer_id, macro_category, stripe_payment_intent_id,
        status, shipping_method, shipping_cost, rate_source, total_weight_kg,
        ship_from_address, ship_to_address, sendcloud_shipping_option_code)
     VALUES ($1,$2,$3,$4,'pending_payment',$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      sellerId, buyerId, macroCategory, stripePaymentIntentId,
      shippingMethod || null, shippingCost, rateSource || 'static', totalWeightKg ?? null,
      shipFromAddress ? JSON.stringify(shipFromAddress) : null,
      shipToAddress ? JSON.stringify(shipToAddress) : null,
      sendcloudShippingOptionCode,
    ]
  );
  return result.rows[0].id;
}

// Payment succeeded: every shipment tied to this checkout moves from
// "waiting on payment" to "waiting on the seller" (see orders' matching
// payment_received transition in paymentsRepository.markOrdersPaymentReceivedByIntent).
function markAwaitingPreparationByIntent(paymentIntentId) {
  return query(
    "UPDATE shipments SET status='awaiting_preparation', updated_at=NOW() WHERE stripe_payment_intent_id=$1 AND status='pending_payment'",
    [paymentIntentId]
  );
}

// Payment failed: no label was ever possible, so there's nothing to reverse
// beyond marking the shipment dead — matches
// paymentsRepository.markOrdersCancelledByIntent.
function markCancelledByIntent(paymentIntentId) {
  return query(
    "UPDATE shipments SET status='cancelled', updated_at=NOW() WHERE stripe_payment_intent_id=$1 AND status='pending_payment'",
    [paymentIntentId]
  );
}

function findById(id) {
  return query('SELECT * FROM shipments WHERE id=$1', [id]).then((r) => r.rows[0] || null);
}

function findBySendcloudParcelId(parcelId) {
  return query('SELECT * FROM shipments WHERE sendcloud_parcel_id=$1', [parcelId]).then((r) => r.rows[0] || null);
}

function listBySeller(sellerId) {
  return query(
    'SELECT * FROM shipments WHERE seller_id=$1 ORDER BY created_at DESC',
    [sellerId]
  ).then((r) => r.rows);
}

// Same as listBySeller but with each shipment's order rows (and the listing/
// buyer info the seller UI needs to show what's actually in the parcel)
// nested as `orders`. One query via json_agg rather than N+1.
function listBySellerWithOrders(sellerId) {
  return query(
    `SELECT s.*,
       COALESCE(json_agg(json_build_object(
         'id', o.id,
         'itemPrice', o.item_price,
         'listingId', l.id,
         'listingTitle', l.title,
         'listingImage', l.images[1],
         'buyerUsername', u.username
       ) ORDER BY o.created_at) FILTER (WHERE o.id IS NOT NULL), '[]') AS orders
     FROM shipments s
     LEFT JOIN orders o ON o.shipment_id = s.id
     LEFT JOIN listings l ON l.id = o.listing_id
     LEFT JOIN users u ON u.id = s.buyer_id
     WHERE s.seller_id = $1
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
    [sellerId]
  ).then((r) => r.rows);
}

function markLabelPending(id) {
  return query("UPDATE shipments SET status='label_pending', updated_at=NOW() WHERE id=$1", [id]);
}

function markLabelFailed(id) {
  return query("UPDATE shipments SET status='label_failed', updated_at=NOW() WHERE id=$1", [id]);
}

// A label was generated and booked — functionally "shipped" for the buyer
// (a tracking number now exists), so orders.status is moved the same way
// the pre-existing manual /ship endpoint does, just automatically.
function markLabelCreated(id, { sendcloudParcelId, trackingNumber, trackingUrl, labelUrl, carrier }) {
  return query(
    `UPDATE shipments SET
       status='shipped', sendcloud_parcel_id=$1, tracking_number=$2, tracking_url=$3,
       label_url=$4, carrier=$5, shipped_at=NOW(), updated_at=NOW()
     WHERE id=$6`,
    [sendcloudParcelId, trackingNumber, trackingUrl, labelUrl, carrier, id]
  );
}

// The seller entered tracking info by hand — the same outcome as a
// successful automatic label, minus the aggregator fields, for shipments
// that never get an automatic label (TCG / static-fallback quotes — see
// isLabelEligible in src/routes/shipments.js).
function markManualShipped(id, { trackingNumber, carrier }) {
  return query(
    `UPDATE shipments SET status='shipped', tracking_number=$1, carrier=$2, shipped_at=NOW(), updated_at=NOW()
     WHERE id=$3`,
    [trackingNumber, carrier, id]
  );
}

// Sendcloud's parcel_status_changed webhook -> our shipment status. Only a
// subset of their status codes are mapped to something meaningful here;
// anything else is logged by the caller and left alone rather than guessed
// at (see src/routes/webhooksSendcloud.js).
const CARRIER_STATUS_MAP = {
  DELIVERED: 'delivered',
  EN_ROUTE_TO_SORTING_CENTER: 'in_transit',
  SORTED: 'in_transit',
  EN_ROUTE: 'in_transit',
  OUT_FOR_DELIVERY: 'in_transit',
  DELIVERY_ATTEMPT_FAILED: 'exception',
  RETURNED_TO_SENDER: 'exception',
  CANCELLED: 'exception',
};

async function applyCarrierStatus(parcelId, carrierStatusCode) {
  const mapped = CARRIER_STATUS_MAP[carrierStatusCode];
  if (!mapped) return null;
  const result = await query(
    `UPDATE shipments SET status=$1, updated_at=NOW()${mapped === 'delivered' ? ', delivered_at=NOW()' : ''}
     WHERE sendcloud_parcel_id=$2 RETURNING id`,
    [mapped, parcelId]
  );
  return result.rows[0]?.id || null;
}

module.exports = {
  create,
  markAwaitingPreparationByIntent,
  markCancelledByIntent,
  findById,
  findBySendcloudParcelId,
  listBySeller,
  listBySellerWithOrders,
  markLabelPending,
  markLabelFailed,
  markLabelCreated,
  markManualShipped,
  applyCarrierStatus,
};
