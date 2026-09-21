/**
 * Contestazioni/resi/rimborsi minimali (CLAUDE.md — clawback dei bonus crediti quando
 * un ordine viene rimborsato). NON gestisce il rimborso reale in euro: quello, come i
 * payout ai venditori (vedi /admin/payouts), resta un'operazione che CardBrix esegue
 * fuori piattaforma (Stripe dashboard) — qui si registra solo l'esito per tenere in
 * sincro lo stato dell'ordine e i crediti.
 *
 * Stati coinvolti (orders.status, già ammessi dal CHECK originale, prima mai scritti
 * da nessuna route): 'disputed' (contestazione aperta dal compratore, in revisione) ->
 * 'completed' (contestazione respinta, si torna come prima) oppure 'refunded'
 * (accolta: l'ordine non matura più nulla, i bonus già maturati vengono claw-backed).
 */
const { query } = require('../db');
const creditBonusGrantRepository = require('../repositories/creditBonusGrantRepository');
const walletRepository = require('../repositories/walletRepository');

// Il compratore può contestare un ordine spedito o già concluso (la maturazione dei
// bonus dura 15 giorni dopo il completamento, la contestazione deve poter arrivare
// anche in quella finestra). Non da stati precedenti (niente da consegnare ancora).
async function openDispute(orderId, buyerId, reason) {
  const result = await query(
    `UPDATE orders SET status='disputed', dispute_reason=$1, disputed_at=NOW()
     WHERE id=$2 AND buyer_id=$3 AND status IN ('shipped', 'completed')
     RETURNING id`,
    [reason, orderId, buyerId]
  );
  return result.rows[0] || null;
}

async function resolveDispute(orderId, outcome) {
  if (outcome === 'reject') {
    const result = await query(
      `UPDATE orders SET status='completed' WHERE id=$1 AND status='disputed' RETURNING id`,
      [orderId]
    );
    return result.rows[0] ? { orderId, outcome: 'reject' } : null;
  }

  if (outcome === 'refund') {
    // Anche da 'shipped'/'completed' senza una contestazione formale: un rimborso
    // può partire anche da una decisione admin diretta (supporto fuori piattaforma).
    const result = await query(
      `UPDATE orders SET status='refunded', refunded_at=NOW()
       WHERE id=$1 AND status IN ('disputed', 'completed', 'shipped')
       RETURNING id`,
      [orderId]
    );
    if (!result.rows[0]) return null;

    await clawbackOrderGrants(orderId);
    return { orderId, outcome: 'refund' };
  }

  throw new Error(`Unknown dispute outcome: ${outcome}`);
}

// Annulla i grant ancora pending (niente da maturare più), e toglie dal wallet quelli
// già maturati (fino a quanto ne resta — vedi walletRepository.clawback).
async function clawbackOrderGrants(orderId) {
  const grants = await creditBonusGrantRepository.findGrantsByOrderId(orderId);

  for (const grant of grants) {
    if (grant.status === 'pending') {
      await creditBonusGrantRepository.markCancelled(grant.id, 'order_refunded');
    } else if (grant.status === 'matured') {
      const clawedBack = await creditBonusGrantRepository.markClawedBack(grant.id);
      if (clawedBack) {
        await walletRepository.clawback(grant.user_id, parseFloat(grant.amount), { referenceId: grant.order_id });
      }
    }
  }
}

function listDisputedOrders() {
  return query(
    `SELECT o.id, o.status, o.total_buyer, o.dispute_reason, o.disputed_at, o.created_at,
            l.title AS listing_title,
            bu.username AS buyer_username, bu.email AS buyer_email,
            su.username AS seller_username, su.email AS seller_email
     FROM orders o
     JOIN listings l ON l.id = o.listing_id
     JOIN users bu ON bu.id = o.buyer_id
     JOIN users su ON su.id = o.seller_id
     WHERE o.status = 'disputed'
     ORDER BY o.disputed_at DESC`
  ).then((r) => r.rows);
}

module.exports = { openDispute, resolveDispute, clawbackOrderGrants, listDisputedOrders };
