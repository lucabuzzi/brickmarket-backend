
const express = require('express');
const Stripe = require('stripe');

const router = express.Router();
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  if (stripe && stripeWebhookSecret) {
    const sig = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err) {
      console.error('⚠️ Stripe Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    console.log('⚠️ Stripe credentials missing. DEV Webhook mode...');
    try {
      const payloadString = req.body.toString('utf8');
      event = JSON.parse(payloadString);
    } catch (err) {
      console.error('Failed to parse dev webhook body:', err.message);
      return res.status(400).send(`Webhook Parse Error: ${err.message}`);
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const amountInCents = paymentIntent.amount;
    const paymentIntentId = paymentIntent.id;
    const meta = paymentIntent.metadata || {};
    const userId = meta.userId || meta.user_id;

    // Featured-listing promotion paid by card: apply the feature window, never
    // touch the wallet. Idempotent via featured_purchases.payment_ref, so it's
    // safe whether this or POST /:id/confirm-feature runs first.
    if (meta.type === 'featured_listing') {
      try {
        const featured = require('../services/featured');
        const tariff = await featured.getTariff(meta.tariff);
        if (tariff && meta.listingId && !(await featured.purchaseExists(paymentIntentId))) {
          await featured.applyFeature(meta.listingId, { days: tariff.days, source: 'paid' });
          await featured.recordPurchase({
            listingId: meta.listingId, userId, tariff: String(meta.tariff), days: tariff.days,
            method: 'card', amountCents: amountInCents, paymentRef: paymentIntentId,
          });
        }
        return res.status(200).json({ received: true, featured: true });
      } catch (err) {
        console.error('❌ Featured-listing webhook failed:', err.message);
        return res.status(500).json({ error: 'Featured update failed' });
      }
    }

    if (!userId) {
      console.error('❌ PaymentIntent missing userId in metadata.');
      return res.status(400).json({ error: 'Missing userId in metadata' });
    }

    // I crediti CardBrix non hanno valore monetario (CLAUDE.md, "REGOLE DI PRODOTTO
    // DEFINITIVE SUI CREDITI"): non esiste più un modo per accreditare il wallet da un
    // pagamento con carta. Risponde comunque 200 a Stripe per evitare retry infiniti
    // sull'evento, ma non tocca il wallet.
    console.warn(`⚠️ payment_intent.succeeded (${paymentIntentId}) for userId ${userId}: no wallet crediting path exists, ignoring.`);
    return res.status(200).json({ received: true, walletTopupDisabled: true });
  }

  return res.status(200).json({ received: true });
});

module.exports = router;
