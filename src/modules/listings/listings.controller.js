// HTTP adapter for /api/listings: reads the request, calls one use case, writes the answer.
// Each handler's `handle()` fallback is the log label and 500 message its route always had.
const handle = require('../../http/handle');
const { upload } = require('../../services/cloudinary');
const { optionalUserId } = require('../../utils/authToken');
const listings = require('./listings.service');
const bids = require('./bids.service');
const featuring = require('./featuring.service');

/** Runs the multer upload inside the handler, so an upload error gets its own answer instead of Express's. */
function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.array('images', 10)(req, res, (err) => (err ? reject(err) : resolve()));
  });
}

// POST / — multipart: fields + images[]
async function create(req, res) {
  try {
    await runUpload(req, res);
  } catch (uploadErr) {
    console.error('\n=== UPLOAD MIDDLEWARE CRASH ===', uploadErr.message);
    return res.status(500).json({ error: 'Errore caricamento immagini: ' + uploadErr.message });
  }
  res.status(201).json(await listings.createListing(req.user.userId, req.body, req.files));
}

async function listOwn(req, res) {
  res.json(await listings.listOwn(req.user.userId));
}

// Public feed (default: active only; ?status=all for every public status, never drafts)
async function listPublic(req, res) {
  res.json(await listings.listPublic(req.query));
}

async function listArchive(req, res) {
  res.json(await listings.listArchive());
}

async function search(req, res) {
  res.json(await listings.search(req.query.q));
}

async function getDetail(req, res) {
  const buyerId = optionalUserId(req, { bearerOnly: true });
  res.json(await listings.getDetail(req.params.id, buyerId));
}

async function update(req, res) {
  res.json(await listings.updateListing(req.params.id, req.user.userId, req.body, req.files));
}

async function remove(req, res) {
  await listings.removeListing(req.params.id, req.user.userId);
  res.json({ message: 'Annuncio rimosso' });
}

async function placeBid(req, res) {
  res.json(await bids.placeBid(req.params.id, req.user.userId, req.body.amount));
}

async function listFeaturedTariffs(req, res) {
  res.json({ tariffs: await featuring.listTariffs() });
}

async function startFeature(req, res) {
  res.json(await featuring.startFeaturePayment(req.user.userId, req.params.id, req.body || {}));
}

async function confirmFeature(req, res) {
  const broadcast = req.app.get('broadcast');
  res.json(await featuring.confirmFeature(req.user.userId, req.params.id, req.body || {}, broadcast));
}

module.exports = {
  // Errors are all answered inside the use case (HttpError); nothing else could reach a catch-all before.
  create: handle(create, null),
  listOwn: handle(listOwn, { error: 'Errore nel recupero dei tuoi annunci' }),
  listPublic: handle(listPublic, { log: 'LISTINGS ERROR:', error: 'Errore nel recupero degli annunci' }),
  listArchive: handle(listArchive, { log: 'ARCHIVE ERROR:', error: "Errore nel recupero dell'archivio" }),
  search: handle(search, { log: 'SEARCH ERROR:', error: 'Errore durante la ricerca' }),
  getDetail: handle(getDetail, { log: 'GET single listing:', error: 'Errore nel recupero dell\'annuncio' }),
  // The UPDATE's own failure is answered inside the use case; this catches the pre-edit lookup.
  update: handle(update, { log: 'PATCH listing:', error: 'Errore aggiornamento' }),
  remove: handle(remove, { error: 'Errore cancellazione' }),
  // Only a pool failure before the transaction (or a failed ROLLBACK) can escape placeBid.
  placeBid: handle(placeBid, { log: 'BID ERROR:', error: "Errore durante l'offerta" }),
  // featured.getTariffs never throws (it falls back to the in-code defaults).
  listFeaturedTariffs: handle(listFeaturedTariffs, null),
  startFeature: handle(startFeature, { log: 'FEATURE ERROR:', error: 'Errore nella messa in evidenza' }),
  confirmFeature: handle(confirmFeature, { log: 'CONFIRM FEATURE ERROR:', error: 'Errore nella conferma della messa in evidenza' }),
};
