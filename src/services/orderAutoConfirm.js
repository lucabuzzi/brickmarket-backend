/**
 * Auto-conferma la consegna quando il compratore non lo fa entro
 * orders.confirm_deadline (5 giorni dalla creazione dell'ordine — vedi
 * paymentsRepository.insertOrder). Stesso effetto della conferma manuale: stato
 * completed, sales_count del venditore, grant crediti pending (vedi
 * paymentsRepository.confirmOrderDelivery, condiviso da entrambe le strade).
 *
 * Chiamato all'avvio del server (recupera eventuali conferme saltate a server spento)
 * e poi da un cron orario — vedi server.js.
 */
const paymentsRepository = require('../repositories/paymentsRepository');

async function processAutoConfirmations() {
  const dueOrderIds = await paymentsRepository.findOrdersPastConfirmDeadline();
  let confirmed = 0;

  for (const orderId of dueOrderIds) {
    try {
      const order = await paymentsRepository.autoConfirmOrderDelivery(orderId);
      if (order) confirmed++;
    } catch (err) {
      console.error(`[AutoConfirm] Failed to auto-confirm order ${orderId}:`, err.message);
    }
  }

  return { confirmed, total: dueOrderIds.length };
}

module.exports = { processAutoConfirmations };
