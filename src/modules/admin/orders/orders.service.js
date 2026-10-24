// Admin order operations: delivery auto-confirmation, disputes, seller payouts, sales archive.
// Buyers pay the platform via Stripe (no Stripe Connect); CardBrix then pays sellers off-Stripe (bank
// transfer, PayPal...) and records it here. Dispute refunds in euro also happen off-platform.
const HttpError = require('../../../http/HttpError');
const repo = require('./orders.repository');
const orderDisputeService = require('../../../services/orderDisputeService');
const { processAutoConfirmations } = require('../../../services/orderAutoConfirm');

const PAYOUT_STATUSES = ['pending', 'paid', 'archived'];

/** Runs the (normally hourly) auto-confirmation of orders past confirm_deadline now. */
function autoConfirmNow() {
  return processAutoConfirmations();
}

async function disputedOrders() {
  return { orders: await orderDisputeService.listDisputedOrders() };
}

/** 'reject' closes the dispute (order back to completed); 'refund' accepts it (credit bonus clawback). */
async function resolveDispute(orderId, outcome) {
  if (outcome !== 'reject' && outcome !== 'refund') {
    throw new HttpError(400, "outcome deve essere 'reject' o 'refund'.");
  }
  const result = await orderDisputeService.resolveDispute(orderId, outcome);
  if (!result) throw new HttpError(404, 'Ordine non trovato o stato non valido per questa risoluzione.');
  return { success: true, ...result };
}

/** Payouts by status (pending by default; anything unknown counts as pending). */
async function payouts(status) {
  const rows = await repo.findPayouts(PAYOUT_STATUSES.includes(status) ? status : 'pending');
  return {
    payouts: rows.map((r) => ({
      orderId: r.id,
      itemPrice: parseFloat(r.item_price),
      shippingCost: parseFloat(r.shipping_cost),
      sellerPayout: parseFloat(r.seller_payout),
      orderStatus: r.order_status,
      payoutStatus: r.payout_status,
      payoutPaidAt: r.payout_paid_at,
      payoutNotes: r.payout_notes,
      createdAt: r.created_at,
      listingTitle: r.listing_title,
      setNumber: r.set_number,
      sellerId: r.seller_id,
      sellerUsername: r.seller_username,
      buyerUsername: r.buyer_username,
    })),
  };
}

const done = { success: true };

async function markPayoutPaid(orderId, notes) {
  if (!(await repo.markPayoutPaid(orderId, notes || null))) {
    throw new HttpError(404, 'Ordine non trovato o payout già registrato.');
  }
  return done;
}

/** Reverts a payout marked paid by mistake. */
async function unmarkPayout(orderId) {
  if (!(await repo.unmarkPayout(orderId))) throw new HttpError(404, 'Ordine non trovato o non è in stato "pagato".');
  return done;
}

/** Moves a paid, reconciled payout out of the active list. */
async function archivePayout(orderId) {
  if (!(await repo.archivePayout(orderId))) throw new HttpError(404, 'Ordine non trovato o non è ancora stato pagato.');
  return done;
}

function salesArchive() {
  return repo.findSalesArchive();
}

module.exports = {
  autoConfirmNow, disputedOrders, resolveDispute, payouts, markPayoutPaid, unmarkPayout, archivePayout, salesArchive,
};
