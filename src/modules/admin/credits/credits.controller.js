// HTTP adapter for the admin credit pages.
const handle = require('../../../http/handle');
const credits = require('./credits.service');

module.exports = {
  ledger: handle(async (req, res) => {
    res.json(await credits.ledger(req.query));
  }, { log: 'ADMIN WALLET TRANSACTIONS ERROR:', error: 'Errore nel recupero dello storico transazioni wallet.' }),

  config: handle(async (req, res) => {
    res.json(await credits.config());
  }, { log: 'ADMIN CREDIT CONFIG LIST ERROR:', error: 'Errore nel recupero della configurazione crediti.' }),

  setConfig: handle(async (req, res) => {
    res.json(await credits.setConfig(req.params.key, req.body.value, req.user.userId));
  }, { log: 'ADMIN CREDIT CONFIG UPDATE ERROR:', error: 'Errore nell\'aggiornamento della configurazione crediti.' }),

  matureNow: handle(async (req, res) => {
    res.json(await credits.matureNow());
  }, { log: 'ADMIN CREDIT BONUS MATURATION ERROR:', error: 'Errore durante la maturazione dei bonus crediti.' }),

  flaggedGrants: handle(async (req, res) => {
    res.json(await credits.flaggedGrants());
  }, { log: 'ADMIN FLAGGED GRANTS ERROR:', error: 'Errore nel recupero dei bonus in revisione.' }),

  reviewGrant: handle(async (req, res) => {
    res.json(await credits.reviewGrant(req.params.id, req.body.decision));
  }, { log: 'ADMIN GRANT REVIEW ERROR:', error: 'Errore nella revisione del bonus.' }),
};
