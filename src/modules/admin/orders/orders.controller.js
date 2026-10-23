// HTTP adapter for the admin order pages.
const handle = require('../../../http/handle');
const orders = require('./orders.service');

module.exports = {
  autoConfirmNow: handle(async (req, res) => {
    res.json(await orders.autoConfirmNow());
  }, { log: 'ADMIN AUTO-CONFIRM ERROR:', error: "Errore durante l'auto-conferma degli ordini." }),

  disputed: handle(async (req, res) => {
    res.json(await orders.disputedOrders());
  }, { log: 'ADMIN DISPUTED ORDERS ERROR:', error: 'Errore nel recupero delle contestazioni.' }),

  resolveDispute: handle(async (req, res) => {
    res.json(await orders.resolveDispute(req.params.id, req.body.outcome));
  }, { log: 'ADMIN DISPUTE RESOLUTION ERROR:', error: 'Errore nella risoluzione della contestazione.' }),

  payouts: handle(async (req, res) => {
    res.json(await orders.payouts(req.query.status));
  }, { log: 'ADMIN PAYOUTS LIST ERROR:', error: 'Errore nel recupero dei payout venditori.' }),

  markPaid: handle(async (req, res) => {
    res.json(await orders.markPayoutPaid(req.params.orderId, req.body.notes));
  }, { log: 'ADMIN PAYOUT MARK-PAID ERROR:', error: 'Errore nella registrazione del payout.' }),

  unmark: handle(async (req, res) => {
    res.json(await orders.unmarkPayout(req.params.orderId));
  }, { log: 'ADMIN PAYOUT UNMARK ERROR:', error: 'Errore nell\'annullamento del payout.' }),

  archive: handle(async (req, res) => {
    res.json(await orders.archivePayout(req.params.orderId));
  }, { log: 'ADMIN PAYOUT ARCHIVE ERROR:', error: 'Errore nell\'archiviazione del payout.' }),

  salesArchive: handle(async (req, res) => {
    res.json(await orders.salesArchive());
  }, { log: 'ADMIN ARCHIVE ERROR:', error: 'Errore nel recupero dell\'archivio admin.' }),
};
