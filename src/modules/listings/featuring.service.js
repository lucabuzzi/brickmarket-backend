// "In evidenza": a seller pays by card to promote their own active listing for one tariff (7/14/30 days).
// Card only — credits can't be spent on promotions (CLAUDE.md: credits are only for Skill Zone puzzles).
// The feature itself is applied by confirmFeature (client, right after the card payment) or by the Stripe
// webhook, whichever comes first; featured_purchases.payment_ref makes it apply once.
const Stripe = require('stripe');
const featured = require('../../services/featured');
const HttpError = require('../../http/HttpError');
const repo = require('./listings.repository');

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const CARD_NOT_CONFIGURED = 'Pagamenti con carta non configurati';

/** The public tariff table (euro cents, admin-configurable), sorted by days. */
async function listTariffs() {
  const tariffs = await featured.getTariffs();
  return tariffs.map(({ id, days, priceCents }) => ({ id, days, priceCents }));
}

/** -> { clientSecret, amountCents } for the card payment of `tariffId` on the seller's own active listing. */
async function startFeaturePayment(userId, listingId, { tariff: tariffId, method } = {}) {
  // Explicit rather than defaulting: a stale client still sending 'wallet' must
  // get an error, not a card charge it didn't ask for.
  if (method !== 'card') throw new HttpError(400, 'Metodo di pagamento non valido');

  const tariff = await featured.getTariff(tariffId);
  if (!tariff) throw new HttpError(400, 'Tariffa non valida');

  const listing = await repo.findOwnership(listingId);
  if (!listing) throw new HttpError(404, 'Annuncio non trovato');
  if (listing.seller_id !== userId) throw new HttpError(403, 'Non sei il proprietario di questo annuncio');
  if (listing.status !== 'active') {
    throw new HttpError(400, 'Solo gli annunci attivi possono essere messi in evidenza');
  }

  if (!stripe) throw new HttpError(503, CARD_NOT_CONFIGURED);
  const intent = await stripe.paymentIntents.create({
    amount: tariff.priceCents,
    currency: 'eur',
    payment_method_types: ['card'],
    metadata: { type: 'featured_listing', listingId, userId, tariff: String(tariffId) },
  });
  return { clientSecret: intent.client_secret, amountCents: tariff.priceCents };
}

/**
 * Verifies the PaymentIntent against Stripe and applies the feature once (idempotent: safe if the webhook
 * beat us). `broadcast` (optional) announces a newly featured listing on the Live Hub.
 * -> { success: true, listing }
 */
async function confirmFeature(userId, listingId, { paymentIntentId } = {}, broadcast) {
  if (!stripe) throw new HttpError(503, CARD_NOT_CONFIGURED);
  if (!paymentIntentId) throw new HttpError(400, 'paymentIntentId mancante');

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== 'succeeded') throw new HttpError(400, 'Pagamento non completato');
  if (intent.metadata?.type !== 'featured_listing'
      || intent.metadata?.userId !== userId
      || intent.metadata?.listingId !== listingId) {
    throw new HttpError(403, 'Pagamento non associato a questo annuncio');
  }

  const tariffId = intent.metadata.tariff;
  const tariff = await featured.getTariff(tariffId);
  if (!tariff) throw new HttpError(400, 'Tariffa non valida');

  if (await featured.purchaseExists(paymentIntentId)) {
    return { success: true, listing: await repo.findById(listingId) };
  }

  const updated = await featured.applyFeature(listingId, { days: tariff.days, source: 'paid' });
  // intent.amount, not tariff.priceCents: an admin may have changed the price
  // between intent creation and confirmation — record what was really charged.
  await featured.recordPurchase({
    listingId, userId, tariff: String(tariffId), days: tariff.days,
    method: 'card', amountCents: intent.amount, paymentRef: paymentIntentId,
  });
  if (broadcast) broadcast({ type: 'LISTING_FEATURED', listingId });
  return { success: true, listing: updated };
}

module.exports = { listTariffs, startFeaturePayment, confirmFeature };
