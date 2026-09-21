const { query } = require('../db');

// Grant ancora pending la cui data di maturazione è passata, con lo stato attuale
// dell'ordine collegato — serve al cron di maturazione (src/services/creditMaturation.js)
// per decidere se maturare (credito wallet) o annullare (ordine disputed/refunded/cancelled).
// Esclude i grant in revisione manuale (flagged_for_review): quelli li matura o
// respinge solo un admin, mai il cron — vedi findFlaggedGrants/approveFlaggedGrant.
function findDueGrants() {
  return query(
    `SELECT g.id, g.user_id, g.type, g.amount, g.order_id, o.status AS order_status
     FROM public.credit_bonus_grants g
     JOIN orders o ON o.id = g.order_id
     WHERE g.status = 'pending' AND g.matures_at <= NOW() AND g.flagged_for_review = false`
  ).then((r) => r.rows);
}

// Atomica: solo se il grant è ancora 'pending' — così due esecuzioni concorrenti del
// cron (o un retry) non possono mai maturare/annullare la stessa riga due volte.
function markMatured(grantId) {
  return query(
    `UPDATE public.credit_bonus_grants SET status = 'matured', matured_at = now()
     WHERE id = $1 AND status = 'pending' RETURNING id`,
    [grantId]
  ).then((r) => r.rows[0] || null);
}

function markCancelled(grantId, reason) {
  return query(
    `UPDATE public.credit_bonus_grants SET status = 'cancelled', matured_at = now(), cancel_reason = $2
     WHERE id = $1 AND status = 'pending' RETURNING id`,
    [grantId, reason]
  ).then((r) => r.rows[0] || null);
}

function findGrantsByOrderId(orderId) {
  return query('SELECT * FROM public.credit_bonus_grants WHERE order_id = $1', [orderId])
    .then((r) => r.rows);
}

// Atomica come le altre transizioni di stato qui: solo se ancora 'matured' (non già
// claw-backed da un tentativo precedente), quindi il wallet non viene mai debitato
// due volte per lo stesso grant.
function markClawedBack(grantId) {
  return query(
    `UPDATE public.credit_bonus_grants SET status = 'clawed_back', clawed_back_at = now()
     WHERE id = $1 AND status = 'matured' RETURNING id`,
    [grantId]
  ).then((r) => r.rows[0] || null);
}

// Somma dei bonus vendita/acquisto già attribuiti a un utente (pending o matured —
// un grant ancora pending conta comunque come "in pipeline") da una certa data in poi.
// Usata per i tetti giornaliero/mensile per utente (CLAUDE.md, anti-abuso). Accetta un
// client di transazione opzionale, per essere chiamata da dentro
// createCreditBonusGrantsForOrder mentre il nuovo grant non è ancora committato.
function sumGrantedAmountSince(userId, since, client) {
  const db = client || { query };
  return db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM public.credit_bonus_grants
     WHERE user_id = $1 AND status IN ('pending', 'matured') AND created_at >= $2`,
    [userId, since]
  ).then((r) => parseFloat(r.rows[0].total));
}

// Stessa somma ma ristretta alla coppia specifica venditore-compratore (in entrambe
// le direzioni: bonus vendita al venditore + bonus acquisto al compratore sullo
// stesso ordine, o viceversa se in futuro comprano/vendono a parti invertite).
// Usata per il tetto mensile per coppia (CLAUDE.md, anti-abuso).
function sumGrantedAmountForPairSince(userIdA, userIdB, since, client) {
  const db = client || { query };
  return db.query(
    `SELECT COALESCE(SUM(g.amount), 0) AS total
     FROM public.credit_bonus_grants g
     JOIN orders o ON o.id = g.order_id
     WHERE g.status IN ('pending', 'matured') AND g.created_at >= $3
       AND ((o.buyer_id = $1 AND o.seller_id = $2) OR (o.buyer_id = $2 AND o.seller_id = $1))`,
    [userIdA, userIdB, since]
  ).then((r) => parseFloat(r.rows[0].total));
}

// Grant creati ma bloccati in revisione manuale (tetto superato), con i dati
// dell'ordine/utenti che servono alla UI admin per decidere.
function findFlaggedGrants() {
  return query(
    `SELECT g.id, g.user_id, g.type, g.amount, g.order_id, g.flag_reason, g.created_at,
            u.username, u.email,
            l.title AS listing_title
     FROM public.credit_bonus_grants g
     JOIN users u ON u.id = g.user_id
     JOIN orders o ON o.id = g.order_id
     JOIN listings l ON l.id = o.listing_id
     WHERE g.status = 'pending' AND g.flagged_for_review = true
     ORDER BY g.created_at DESC`
  ).then((r) => r.rows);
}

// Toglie il blocco di revisione ma lascia lo stato 'pending' invariato — usata
// dall'approvazione admin, che matura subito il grant appena il blocco è tolto
// (non aspetta il prossimo giro di cron). Ritorna la riga intera: chi la chiama ha
// già bisogno di user_id/type/amount/order_id per accreditare il wallet.
function clearReviewFlag(grantId) {
  return query(
    `UPDATE public.credit_bonus_grants SET flagged_for_review = false
     WHERE id = $1 AND status = 'pending' AND flagged_for_review = true RETURNING *`,
    [grantId]
  ).then((r) => r.rows[0] || null);
}

// Respinge un grant flaggato senza mai maturarlo (l'admin ha deciso che il tetto
// era fondato). Stesso effetto lato dati di markCancelled, ma non richiede che il
// flag sia già stato tolto.
function rejectFlaggedGrant(grantId, reason) {
  return query(
    `UPDATE public.credit_bonus_grants SET status = 'cancelled', matured_at = now(), cancel_reason = $2
     WHERE id = $1 AND status = 'pending' AND flagged_for_review = true RETURNING id`,
    [grantId, reason]
  ).then((r) => r.rows[0] || null);
}

module.exports = {
  findDueGrants,
  markMatured,
  markCancelled,
  findGrantsByOrderId,
  markClawedBack,
  sumGrantedAmountSince,
  sumGrantedAmountForPairSince,
  findFlaggedGrants,
  clearReviewFlag,
  rejectFlaggedGrant,
};
