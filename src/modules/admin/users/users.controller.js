// HTTP adapter for the admin user pages.
const handle = require('../../../http/handle');
const privateDocuments = require('../../../services/privateDocuments');
const users = require('./users.service');

module.exports = {
  crmList: handle(async (req, res) => {
    res.json(await users.crmList(req.query));
  }, { log: 'ADMIN USERS DETAILED ERROR:', error: 'Errore nel recupero dei dati CRM utenti.' }),

  history: handle(async (req, res) => {
    res.json(await users.history(req.params.id));
  }, { log: 'ADMIN USER HISTORY ERROR:', error: 'Errore nel recupero della history utente.' }),

  list: handle(async (req, res) => {
    res.json(await users.listWithWallet(req.query));
  }, { log: 'ADMIN USERS LIST ERROR:', error: 'Errore nel recupero dell\'elenco utenti.' }),

  profile: handle(async (req, res) => {
    res.json(await users.profile(req.params.id));
  }, { log: 'ADMIN USER DETAIL ERROR:', error: 'Errore nel recupero del profilo utente.' }),

  documents: handle(async (req, res) => {
    const links = await users.documentLinks(req.params.id);
    res.set('Cache-Control', 'no-store');
    res.json(links);
  }, { log: 'ADMIN USER DOCUMENTS ERROR:', error: 'Errore nel recupero dei documenti.' }),

  /**
   * Serves a document from the local-disk fallback. No bearer token here (it's opened as a plain link): the
   * short-lived HMAC signature produced by GET /users/:id/documents is what authorizes it.
   */
  signedDocument(req, res) {
    const filePath = privateDocuments.resolveSignedLocalDocument(req.params.filename, req.query.exp, req.query.sig);
    if (!filePath) return res.status(403).json({ error: 'Link non valido o scaduto.' });
    res.set('Cache-Control', 'no-store');
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'Documento non trovato.' });
    });
  },

  activity: handle(async (req, res) => {
    res.json(await users.activity(req.params.id));
  }, { log: 'ADMIN USER ACTIVITY ERROR:', error: 'Errore nel recupero dell\'attività utente.' }),

  update: handle(async (req, res) => {
    res.json(await users.updateUser(req.params.id, req.user.userId, req.body));
  }, { log: 'ADMIN USER UPDATE ERROR:', error: 'Errore nell\'aggiornamento dell\'utente.' }),
};
