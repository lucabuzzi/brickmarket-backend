// Admin listing moderation and "in evidenza" management.
// Hiding ("oscura") takes a listing off the public site without deleting it; admin removal is a soft delete
// (status 'removed') that never touches sold listings (financial record). Both need a reason, stored on the
// listing and sent to the seller. `broadcast` (optional) announces each change on the Live Hub.
const HttpError = require('../../../http/HttpError');
const repo = require('./listings.repository');
const featured = require('../../../services/featured');
const featuredPricing = require('../../../services/featuredPricing');

/** `limit` default 50, max 200; `offset` default 0. */
function moderationList(q) {
  const limit = Math.min(parseInt(q.limit, 10) || 50, 200);
  const offset = parseInt(q.offset, 10) || 0;
  return repo.findForModeration({ search: q.search, featured: q.featured, status: q.status, type: q.type }, limit, offset);
}

const reasonOf = (body) => (body?.reason || '').trim();

/** The seller hears about it in-app; a failed notification is logged and doesn't undo the moderation. */
function notifySeller(listing, listingId, messageKey, reason, logLabel) {
  return repo.notifySeller(listing.seller_id, messageKey, listingId, reason)
    .catch((err) => console.error(logLabel, err.message));
}

async function hide(listingId, body, adminId, broadcast) {
  const reason = reasonOf(body);
  if (!reason) throw new HttpError(400, 'Specifica un motivo per oscurare l\'annuncio.');
  const listing = await repo.hide(listingId, reason, adminId);
  if (!listing) throw new HttpError(404, 'Annuncio non trovato o non oscurabile nel suo stato attuale.');
  await notifySeller(listing, listingId, 'notifications.listingHidden', reason, 'Listing hidden notification error:');
  if (broadcast) broadcast({ type: 'LISTING_HIDDEN', listingId });
  return { success: true, listing };
}

async function unhide(listingId) {
  const listing = await repo.unhide(listingId);
  if (!listing) throw new HttpError(404, 'Annuncio non trovato o non oscurato.');
  return { success: true, listing };
}

async function remove(listingId, body, adminId, broadcast) {
  const reason = reasonOf(body);
  if (!reason) throw new HttpError(400, 'Specifica un motivo per cancellare l\'annuncio.');
  const listing = await repo.removeByAdmin(listingId, reason, adminId);
  if (!listing) throw new HttpError(404, 'Annuncio non trovato o non cancellabile (es. già venduto).');
  await notifySeller(listing, listingId, 'notifications.listingRemovedByAdmin', reason, 'Listing removed notification error:');
  if (broadcast) broadcast({ type: 'LISTING_REMOVED', listingId });
  return { success: true, listing };
}

/** General-purpose undo: back to active from expired, removed or hidden. */
async function restore(listingId) {
  const listing = await repo.restore(listingId);
  if (!listing) throw new HttpError(404, 'Annuncio non trovato.');
  return { success: true, listing };
}

/**
 * Free, admin-sourced "in evidenza":
 *   { unfeature: true } clears it; { pin: true } features with no expiry; { days: 1..365 } features for N days
 *   (stacking on any current window). The admin grant is recorded like a purchase, best effort.
 */
async function setFeatured(listingId, { days, pin, unfeature } = {}, adminId, broadcast) {
  if (!(await repo.exists(listingId))) throw new HttpError(404, 'Annuncio non trovato.');

  let listing;
  if (unfeature) {
    listing = await featured.unfeature(listingId);
  } else {
    let n = null;
    if (!pin) {
      n = parseInt(days, 10);
      if (!Number.isInteger(n) || n <= 0 || n > 365) throw new HttpError(400, 'days deve essere un intero fra 1 e 365');
    }
    listing = await featured.applyFeature(listingId, { days: n, source: 'admin' });
    await featured.recordPurchase({
      listingId, userId: adminId, tariff: 'admin', days: pin ? 0 : n, method: 'admin',
    }).catch(() => {});
  }

  if (broadcast) broadcast({ type: 'LISTING_FEATURED', listingId });
  return { success: true, listing };
}

/** Euro prices of the paid promotions (card only); a tariff missing from the DB comes back isDefault:true. */
async function tariffs() {
  return { tariffs: await featured.getTariffs() };
}

/** Changes the price of an existing tariff (7/14/30 days; the durations are fixed). */
async function setTariffPrice(id, rawPriceCents, adminId) {
  const priceCents = Number(rawPriceCents);
  if (!featuredPricing.isKnownTariff(id)) throw new HttpError(404, 'Tariffa sconosciuta.');
  if (!featuredPricing.validatePriceCents(priceCents)) {
    throw new HttpError(400,
      `Prezzo non valido: deve essere un importo fra ${featuredPricing.MIN_PRICE_CENTS / 100} € e ${featuredPricing.MAX_PRICE_CENTS / 100} €.`);
  }
  await featured.setTariffPrice(id, priceCents, adminId);
  return { success: true, id, priceCents };
}

module.exports = { moderationList, hide, unhide, remove, restore, setFeatured, tariffs, setTariffPrice };
