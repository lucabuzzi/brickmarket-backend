const { query, getClient } = require('../db');
const identitySignalRepository = require('./identitySignalRepository');
const creditBonusGrantRepository = require('./creditBonusGrantRepository');

function findActiveListingById(id) {
  return query(`SELECT l.* FROM listings l WHERE l.id=$1 AND l.status='active'`, [id])
    .then((r) => r.rows[0] || null);
}

function findActiveListingsByIds(ids) {
  return query(
    `SELECT l.*, u.username AS seller_username
       FROM listings l
       JOIN users u ON u.id = l.seller_id
      WHERE l.id = ANY($1) AND l.status = 'active'`,
    [ids]
  ).then((r) => r.rows);
}

async function insertOrder({
  buyerId, sellerId, listingId, itemPrice, shippingCost, platformFee, sellerFee,
  totalBuyer, sellerPayout, stripePaymentIntentId, selectedCarrier = null,
  shippingAddress = null, shipmentId = null,
}) {
  const result = await query(`
    INSERT INTO orders
      (buyer_id, seller_id, listing_id,
       item_price, shipping_cost, platform_fee, seller_fee,
       total_buyer, seller_payout,
       status, stripe_payment_intent_id, payment_gateway,
       selected_carrier, shipping_address, shipment_id, confirm_deadline)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
            'pending_payment',$10,'stripe',
            $11, $12, $13, NOW() + INTERVAL '5 days')
    RETURNING id
  `, [
    buyerId, sellerId, listingId,
    itemPrice, shippingCost, platformFee, sellerFee,
    totalBuyer, sellerPayout,
    stripePaymentIntentId, selectedCarrier,
    shippingAddress ? JSON.stringify(shippingAddress) : null,
    shipmentId,
  ]);
  return result.rows[0].id;
}

// Nucleo condiviso da conferma manuale (il compratore clicca "conferma ricezione") e
// auto-conferma (src/services/orderAutoConfirm.js, cron su confirm_deadline scaduto):
// stessa transazione, stesso effetto (stato completed, sales_count, grant crediti).
// FOR UPDATE blocca la riga per la durata della transazione, così le due strade non
// possono mai processare lo stesso ordine in parallelo.
async function confirmOrderDelivery(whereClause, params) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `SELECT * FROM orders WHERE ${whereClause} FOR UPDATE`,
      params
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

    await createCreditBonusGrantsForOrder(client, order);

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function completeDeliveryConfirmation(orderId, buyerId) {
  return confirmOrderDelivery(`id=$1 AND buyer_id=$2 AND status='shipped'`, [orderId, buyerId]);
}

// Ordini spediti il cui termine per la conferma manuale (confirm_deadline, impostato
// alla creazione dell'ordine — vedi insertOrder) è scaduto senza che il compratore
// abbia confermato. Sola lettura: la vera transizione atomica avviene in
// autoConfirmOrderDelivery, che ri-verifica le stesse condizioni riga per riga.
function findOrdersPastConfirmDeadline() {
  return query(
    `SELECT id FROM orders WHERE status='shipped' AND confirm_deadline <= NOW()`
  ).then((r) => r.rows.map((row) => row.id));
}

function autoConfirmOrderDelivery(orderId) {
  return confirmOrderDelivery(`id=$1 AND status='shipped' AND confirm_deadline <= NOW()`, [orderId]);
}

// Crea i due grant "pending" (venditore/acquirente) da maturare tra
// credit_config.maturation_days (CLAUDE.md, "REGOLE DI PRODOTTO DEFINITIVE SUI
// CREDITI"), solo se l'ordine supera l'importo minimo configurato. Nessun credito
// tocca il wallet qui: lo fa solo il cron di maturazione (src/services/creditMaturation.js),
// e solo se a quella data l'ordine non risulta disputed/refunded/cancelled.
// Stessa transazione di completeDeliveryConfirmation: se una qualunque delle
// istruzioni sopra fallisce, anche i grant vengono annullati col ROLLBACK.
//
// Anti-abuso (CLAUDE.md): se venditore e compratore condividono un segnale di
// identità (IP, dispositivo, indirizzo di spedizione, impronta di pagamento — vedi
// identitySignalRepository), NESSUN bonus viene creato per questo ordine, punto.
// Se invece accreditare un bonus supererebbe uno dei tetti configurati (giornaliero/
// mensile per utente, mensile per la coppia), il grant si crea comunque ma resta
// flagged_for_review: il cron di maturazione lo salta, solo un admin può sbloccarlo
// (vedi /admin/credit-bonus-grants/flagged).
async function createCreditBonusGrantsForOrder(client, order) {
  const configRes = await client.query(
    `SELECT key, value FROM public.credit_config
     WHERE key IN ('min_order_amount', 'maturation_days', 'sale_bonus', 'purchase_bonus',
                    'daily_bonus_cap_per_user', 'monthly_bonus_cap_per_user', 'monthly_bonus_cap_per_pair')`
  );
  const config = Object.fromEntries(configRes.rows.map((r) => [r.key, parseFloat(r.value)]));

  const minOrderAmount = config.min_order_amount ?? 5;
  if (parseFloat(order.total_buyer) < minOrderAmount) return;

  const sharedIdentity = await identitySignalRepository.hasSharedSignal(order.buyer_id, order.seller_id, client);
  if (sharedIdentity) {
    console.warn(`[AntiAbuse] Order ${order.id}: buyer and seller share an identity signal — no bonus granted.`);
    return;
  }

  const maturationDays = config.maturation_days ?? 15;
  const saleBonus = config.sale_bonus ?? 0;
  const purchaseBonus = config.purchase_bonus ?? 0;
  const dailyCap = config.daily_bonus_cap_per_user ?? Infinity;
  const monthlyCap = config.monthly_bonus_cap_per_user ?? Infinity;
  const pairCap = config.monthly_bonus_cap_per_pair ?? Infinity;

  const since24h = new Date(Date.now() - 24 * 3600000);
  const since30d = new Date(Date.now() - 30 * 24 * 3600000);

  async function insertGrant(userId, type, amount) {
    if (!(amount > 0)) return;

    const [dailySoFar, monthlySoFar, pairSoFar] = await Promise.all([
      creditBonusGrantRepository.sumGrantedAmountSince(userId, since24h, client),
      creditBonusGrantRepository.sumGrantedAmountSince(userId, since30d, client),
      creditBonusGrantRepository.sumGrantedAmountForPairSince(order.buyer_id, order.seller_id, since30d, client),
    ]);

    let flagReason = null;
    if (dailySoFar + amount > dailyCap) flagReason = 'daily_cap_exceeded';
    else if (monthlySoFar + amount > monthlyCap) flagReason = 'monthly_cap_exceeded';
    else if (pairSoFar + amount > pairCap) flagReason = 'pair_cap_exceeded';

    await client.query(
      `INSERT INTO public.credit_bonus_grants (user_id, type, amount, order_id, matures_at, flagged_for_review, flag_reason)
       VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::interval, $6, $7)
       ON CONFLICT (order_id, type) DO NOTHING`,
      [userId, type, amount, order.id, maturationDays, !!flagReason, flagReason]
    );
  }

  await insertGrant(order.seller_id, 'sale_bonus', saleBonus);
  await insertGrant(order.buyer_id, 'purchase_bonus', purchaseBonus);
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

// Seller marks a shipment "ready" — every order row in that shipment moves
// together. Reuses the 'preparing' value already in orders_status_check
// (previously unused) rather than introducing a new one.
function markOrdersPreparingByShipment(shipmentId, sellerId) {
  return query(
    "UPDATE orders SET status='preparing', updated_at=NOW() WHERE shipment_id=$1 AND seller_id=$2 AND status='payment_received' RETURNING id",
    [shipmentId, sellerId]
  );
}

// A label was booked (or, for shipments that don't get an automatic label —
// TCG / static-fallback — the seller used the existing manual /ship-style
// flow) — mirrors what the legacy PATCH /api/orders/:id/ship endpoint does,
// applied to every row of the shipment at once.
function markOrdersShippedByShipment(shipmentId, { trackingNumber, carrier }) {
  return query(
    `UPDATE orders SET status='shipped', tracking_number=$2, carrier=$3, shipped_at=NOW(), updated_at=NOW()
     WHERE shipment_id=$1`,
    [shipmentId, trackingNumber || null, carrier || null]
  );
}

module.exports = {
  findActiveListingById,
  findActiveListingsByIds,
  insertOrder,
  completeDeliveryConfirmation,
  findOrdersPastConfirmDeadline,
  autoConfirmOrderDelivery,
  markOrdersPaymentReceivedByIntent,
  markListingSold,
  markOrdersCancelledByIntent,
  markOrdersPreparingByShipment,
  markOrdersShippedByShipment,
  updateOrderPaypalCapture,
};
