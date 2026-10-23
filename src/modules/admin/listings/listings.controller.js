// HTTP adapter for admin listing moderation and the "in evidenza" tariffs.
const handle = require('../../../http/handle');
const moderation = require('./listings.service');

const broadcastOf = (req) => req.app.get('broadcast');

module.exports = {
  tariffs: handle(async (req, res) => {
    res.json(await moderation.tariffs());
  }, { log: 'ADMIN FEATURED TARIFFS LIST ERROR:', error: 'Errore nel recupero delle tariffe in evidenza.' }),

  setTariffPrice: handle(async (req, res) => {
    res.json(await moderation.setTariffPrice(req.params.id, req.body?.priceCents, req.user.userId));
  }, { log: 'ADMIN FEATURED TARIFF UPDATE ERROR:', error: 'Errore nell\'aggiornamento della tariffa.' }),

  list: handle(async (req, res) => {
    res.json(await moderation.moderationList(req.query));
  }, { log: 'ADMIN LISTINGS ERROR:', error: 'Errore nel recupero degli annunci.' }),

  hide: handle(async (req, res) => {
    res.json(await moderation.hide(req.params.id, req.body, req.user.userId, broadcastOf(req)));
  }, { log: 'ADMIN HIDE LISTING ERROR:', error: 'Errore nell\'oscuramento dell\'annuncio.' }),

  unhide: handle(async (req, res) => {
    res.json(await moderation.unhide(req.params.id));
  }, { log: 'ADMIN UNHIDE LISTING ERROR:', error: 'Errore nel ripristino dall\'oscuramento.' }),

  remove: handle(async (req, res) => {
    res.json(await moderation.remove(req.params.id, req.body, req.user.userId, broadcastOf(req)));
  }, { log: 'ADMIN DELETE LISTING ERROR:', error: 'Errore nella cancellazione dell\'annuncio.' }),

  setFeatured: handle(async (req, res) => {
    res.json(await moderation.setFeatured(req.params.id, req.body || {}, req.user.userId, broadcastOf(req)));
  }, { log: 'ADMIN FEATURE ERROR:', error: 'Errore nella gestione evidenza.' }),

  restore: handle(async (req, res) => {
    res.json(await moderation.restore(req.params.id));
  }, { log: 'ADMIN RESTORE ERROR:', error: 'Errore nel ripristino dell\'annuncio.' }),
};
