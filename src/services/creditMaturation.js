/**
 * Matura (o annulla, o rimanda) i bonus vendita/acquisto in attesa (CLAUDE.md —
 * maturazione 15gg dalla consegna confermata, "solo se non ci sono contestazioni/
 * resi/rimborsi aperti"). Se un ordine viene rimborsato DOPO che il suo grant ha già
 * maturato (credito già nel wallet), il clawback è gestito a parte da
 * src/services/orderDisputeService.js — qui si tratta solo lo stato "prima della
 * maturazione".
 *
 * Chiamato all'avvio del server (per recuperare eventuali maturazioni saltate mentre il
 * server era giù) e poi da un cron giornaliero — vedi server.js.
 *
 * I grant bloccati da un tetto anti-abuso (flagged_for_review, vedi
 * src/repositories/paymentsRepository.js#createCreditBonusGrantsForOrder) non passano
 * mai da qui: restano fermi finché un admin non li approva o respinge, con
 * reviewFlaggedGrant sotto.
 */
const creditBonusGrantRepository = require('../repositories/creditBonusGrantRepository');
const walletRepository = require('../repositories/walletRepository');

// 'disputed' non è definitivo: la contestazione è ancora sotto revisione (vedi
// src/services/orderDisputeService.js), quindi il grant resta pending e si riprova al
// prossimo giro — potrebbe essere respinta e il bonus maturare normalmente più tardi.
const DEFERRING_ORDER_STATUSES = new Set(['disputed']);
// Questi invece sono definitivi: il grant non maturerà mai, va annullato.
const TERMINAL_BLOCKING_ORDER_STATUSES = new Set(['refunded', 'cancelled']);

// Precondizione: il grant è già stato marcato 'matured' (atomicamente) da chi
// chiama — qui si fa solo il credito wallet, con un controllo difensivo in più
// oltre all'atomicità della UPDATE, per restare al sicuro anche da un retry manuale
// dopo un crash a metà strada.
async function creditMaturedGrant(grant) {
  const already = await walletRepository.findTransactionByTypeAndReference(grant.user_id, grant.type, grant.order_id);
  if (!already) {
    await walletRepository.creditWallet(grant.user_id, parseFloat(grant.amount), {
      referenceId: grant.order_id,
      type: grant.type,
    });
  }
}

async function processMaturedGrants() {
  const dueGrants = await creditBonusGrantRepository.findDueGrants();
  let matured = 0;
  let cancelled = 0;
  let deferred = 0;

  for (const grant of dueGrants) {
    if (DEFERRING_ORDER_STATUSES.has(grant.order_status)) {
      deferred++; // non tocca il grant: resta pending finché la contestazione non si risolve
      continue;
    }
    if (TERMINAL_BLOCKING_ORDER_STATUSES.has(grant.order_status)) {
      const result = await creditBonusGrantRepository.markCancelled(grant.id, `order_status:${grant.order_status}`);
      if (result) cancelled++;
      continue;
    }

    const result = await creditBonusGrantRepository.markMatured(grant.id);
    if (!result) continue; // già gestito da un'altra esecuzione (concorrente o precedente)

    try {
      await creditMaturedGrant(grant);
      matured++;
    } catch (err) {
      console.error(`[CreditMaturation] Failed to credit grant ${grant.id} (user ${grant.user_id}, ${grant.type}):`, err.message);
    }
  }

  return { matured, cancelled, deferred, total: dueGrants.length };
}

// Revisione admin di un grant bloccato da un tetto anti-abuso (flagged_for_review) —
// vedi /admin/credit-bonus-grants/flagged. 'approve' lo toglie dal blocco e lo matura
// subito (non aspetta il prossimo giro di cron); 'reject' lo annulla senza mai
// accreditare nulla.
async function reviewFlaggedGrant(grantId, decision) {
  if (decision === 'reject') {
    const result = await creditBonusGrantRepository.rejectFlaggedGrant(grantId, 'admin_rejected_review');
    return result ? { grantId, decision: 'reject' } : null;
  }

  if (decision === 'approve') {
    const grant = await creditBonusGrantRepository.clearReviewFlag(grantId);
    if (!grant) return null;

    const matured = await creditBonusGrantRepository.markMatured(grantId);
    if (matured) {
      await creditMaturedGrant(grant);
    }
    return { grantId, decision: 'approve' };
  }

  throw new Error(`Unknown review decision: ${decision}`);
}

module.exports = { processMaturedGrants, reviewFlaggedGrant };
