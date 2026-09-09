const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paymentsRepository = require('../repositories/paymentsRepository');
const userRepository = require('../repositories/userRepository');

const PLATFORM_FEE_RATE = 0.05;

function computeFees(itemPrice) {
  const platformFee = Math.round(itemPrice * PLATFORM_FEE_RATE * 100) / 100;
  const sellerFee = platformFee;
  const sellerPayout = itemPrice - sellerFee;
  return { platformFee, sellerFee, sellerPayout };
}

// 1. Onboarding venditore: crea un account Stripe Connect
async function onboardSellerHandler(req, res) {
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'IT',
      email: req.body.email,
      capabilities: { transfers: { requested: true } },
      business_type: 'individual',
    });

    await userRepository.updateProfile(req.user.userId, { stripe_account_id: account.id });

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL}/seller/onboarding-retry`,
      return_url: `${process.env.FRONTEND_URL}/seller/onboarding-complete`,
      type: 'account_onboarding',
    });

    res.json({ onboardingUrl: accountLink.url });
  } catch (err) {
    console.error('Stripe onboard error:', err);
    res.status(500).json({ error: 'Errore durante la configurazione pagamenti' });
  }
}

// 2. Crea un PaymentIntent (acquirente avvia il pagamento)
async function createPaymentIntentHandler(req, res) {
  const { listingId, shippingMethod } = req.body;

  try {
    const listing = await paymentsRepository.findActiveListingById(listingId);
    if (!listing) return res.status(404).json({ error: 'Annuncio non trovato' });
    if (listing.type === 'auction') {
      return res.status(400).json({ error: 'Acquisto diretto non disponibile per le aste' });
    }

    const itemPrice = parseFloat(listing.price);
    if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
      return res.status(400).json({ error: 'Prezzo non valido per questo annuncio' });
    }
    const shippingCost = parseFloat(listing.shipping_cost) || 0;
    // Il 5% è a CARICO dell'acquirente (aggiunto al prezzo)
    const { platformFee, sellerFee, sellerPayout } = computeFees(itemPrice);
    const totalBuyer = Math.round((itemPrice + shippingCost + platformFee) * 100);

    // Crea il PaymentIntent con destination charge:
    // i fondi vanno al platform (noi), poi trasferiamo al venditore dopo conferma
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalBuyer, // in centesimi
      currency: 'eur',
      // La spedizione viene trasferita subito, il resto va in escrow
      // (gestito via webhook)
      metadata: {
        listingId,
        buyerId: req.user.userId,
        sellerId: listing.seller_id,
        itemPrice: itemPrice.toString(),
        shippingCost: shippingCost.toString(),
        platformFee: platformFee.toString(),
        shippingMethod: shippingMethod || 'express',
      },
      automatic_payment_methods: { enabled: true },
    });

    const orderId = await paymentsRepository.insertOrder({
      buyerId: req.user.userId,
      sellerId: listing.seller_id,
      listingId,
      itemPrice,
      shippingCost,
      platformFee,
      sellerFee,
      totalBuyer: itemPrice + shippingCost + platformFee,
      sellerPayout,
      stripePaymentIntentId: paymentIntent.id,
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      orderId,
      breakdown: {
        itemPrice, shippingCost, platformFee,
        totalBuyer: (itemPrice + shippingCost + platformFee).toFixed(2),
        sellerReceives: sellerPayout.toFixed(2),
      },
    });
  } catch (err) {
    console.error('PaymentIntent error:', err);
    res.status(500).json({ error: 'Errore creazione pagamento' });
  }
}

// 2b. Crea un PaymentIntent per il checkout multi-articolo del carrello
// (può includere annunci di venditori diversi: l'incasso finisce sempre
// sul saldo della piattaforma — CardBrix paga poi ciascun venditore
// separatamente, fuori da Stripe; vedi payout tracking in admin.js).
async function createCartPaymentIntentHandler(req, res) {
  const { itemIds, shippingSelections = {} } = req.body;
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({ error: 'Nessun articolo selezionato' });
  }

  try {
    const listings = await paymentsRepository.findActiveListingsByIds(itemIds);
    if (listings.length !== itemIds.length) {
      return res.status(400).json({ error: 'Uno o più articoli non sono più disponibili' });
    }

    const orderRows = [];
    let totalCents = 0;

    for (const listing of listings) {
      if (listing.type === 'auction') {
        return res.status(400).json({ error: `"${listing.title}" è un'asta: non è disponibile l'acquisto diretto` });
      }
      const itemPrice = parseFloat(listing.price);
      if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
        return res.status(400).json({ error: `Prezzo non valido per "${listing.title}"` });
      }

      const shipping = shippingSelections[listing.id] || {};
      const shippingCost = Number(shipping.cost) || 0;
      const { platformFee, sellerFee, sellerPayout } = computeFees(itemPrice);
      const totalBuyer = itemPrice + shippingCost + platformFee;

      orderRows.push({
        listing, shippingCost,
        selectedCarrier: shipping.carrier || null,
        itemPrice, platformFee, sellerFee, sellerPayout, totalBuyer,
      });
      totalCents += Math.round(totalBuyer * 100);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'eur',
      metadata: {
        buyerId: req.user.userId,
        itemIds: itemIds.join(','),
      },
      automatic_payment_methods: { enabled: true },
    });

    const orderIds = [];
    for (const o of orderRows) {
      const orderId = await paymentsRepository.insertOrder({
        buyerId: req.user.userId,
        sellerId: o.listing.seller_id,
        listingId: o.listing.id,
        itemPrice: o.itemPrice,
        shippingCost: o.shippingCost,
        platformFee: o.platformFee,
        sellerFee: o.sellerFee,
        totalBuyer: o.totalBuyer,
        sellerPayout: o.sellerPayout,
        stripePaymentIntentId: paymentIntent.id,
        selectedCarrier: o.selectedCarrier,
      });
      orderIds.push(orderId);
    }

    res.json({
      clientSecret: paymentIntent.client_secret,
      orderIds,
      total: (totalCents / 100).toFixed(2),
    });
  } catch (err) {
    console.error('Cart PaymentIntent error:', err);
    res.status(500).json({ error: 'Errore creazione pagamento' });
  }
}

// 3. Acquirente conferma la ricezione → l'ordine è concluso. Il payout al
// venditore NON è più un trasferimento Stripe automatico: è un'operazione
// che CardBrix esegue fuori piattaforma e registra da /admin/payouts.
async function confirmDeliveryHandler(req, res) {
  try {
    const order = await paymentsRepository.completeDeliveryConfirmation(req.params.orderId, req.user.userId);
    if (!order) {
      return res.status(404).json({ error: 'Ordine non trovato o già confermato' });
    }
    res.json({ success: true, message: 'Consegna confermata.' });
  } catch (err) {
    console.error('Confirm delivery error:', err);
    res.status(500).json({ error: 'Errore conferma consegna' });
  }
}

// 4. WEBHOOK Stripe (ascolta gli eventi: pagamento ricevuto, fallito, ecc.)
async function webhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;

      // Aggiorna tutti gli ordini legati a questo PaymentIntent (uno per articolo:
      // un acquisto singolo ne crea uno solo, un checkout da carrello più d'uno)
      const orders = await paymentsRepository.markOrdersPaymentReceivedByIntent(pi.id);

      // Il pagamento è confermato: gli annunci non sono più acquistabili da altri.
      // Il payout al venditore resta 'pending' finché non lo si registra da
      // /admin/payouts (CardBrix paga fuori Stripe, non un transfer automatico).
      for (const order of orders) {
        await paymentsRepository.markListingSold(order.listing_id);
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      await paymentsRepository.markOrdersCancelledByIntent(pi.id);
      break;
    }
  }

  res.json({ received: true });
}

// ─── PAYPAL ──────────────────────────────────────────────────────────────────

async function getPayPalAccessToken() {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');
  const r = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await r.json();
  return data.access_token;
}

async function paypalCreateOrderHandler(req, res) {
  const { listingId } = req.body;
  try {
    const listing = await paymentsRepository.findActiveListingById(listingId);
    if (!listing) return res.status(404).json({ error: 'Annuncio non trovato' });
    if (listing.type === 'auction') {
      return res.status(400).json({ error: 'Acquisto diretto non disponibile per le aste' });
    }

    const itemPrice = parseFloat(listing.price);
    if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
      return res.status(400).json({ error: 'Prezzo non valido per questo annuncio' });
    }
    const shipping = parseFloat(listing.shipping_cost) || 0;
    const { platformFee: fee } = computeFees(itemPrice);
    const total = (itemPrice + shipping + fee).toFixed(2);

    // Usa l'API REST di PayPal direttamente (più semplice dell'SDK)
    const accessToken = await getPayPalAccessToken();
    const response = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'EUR', value: total },
          description: `BrickMarket: ${listing.title}`,
          custom_id: `${listingId}|${req.user.userId}`,
        }],
      }),
    });
    const order = await response.json();
    res.json({ paypalOrderId: order.id });
  } catch (err) {
    res.status(500).json({ error: 'Errore PayPal' });
  }
}

async function paypalCaptureHandler(req, res) {
  try {
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${req.params.paypalOrderId}/capture`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      }
    );
    const capture = await response.json();
    // Aggiorna ordine nel DB con paypal_order_id e paypal_capture_id
    const [listingId, buyerId] = capture.purchase_units[0].custom_id.split('|');
    await paymentsRepository.updateOrderPaypalCapture({
      paypalOrderId: req.params.paypalOrderId,
      captureId: capture.id,
      listingId,
      buyerId,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Errore cattura PayPal' });
  }
}

module.exports = {
  onboardSellerHandler,
  createPaymentIntentHandler,
  createCartPaymentIntentHandler,
  confirmDeliveryHandler,
  webhookHandler,
  paypalCreateOrderHandler,
  paypalCaptureHandler,
};
