const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paymentsRepository = require('../repositories/paymentsRepository');
const userRepository = require('../repositories/userRepository');
const addressRepository = require('../repositories/addressRepository');
const shipmentRepository = require('../repositories/shipmentRepository');
const { recomputeUserRole } = require('../services/userRoleAuto');
const { resolveTcgShipping } = require('../services/shipping');
const { checkoutAddressSchema, validate: validateAddress } = require('../validators/addressValidators');
const shippingQuote = require('../services/shippingQuote');
const { sellerAddressSnapshot } = shippingQuote;
const identitySignalRepository = require('../repositories/identitySignalRepository');

/** Cart shipping groups: one shipment per (seller × macro-category). Trading
 *  cards ship apart from LEGO/Funko even for the same seller. */
function macroCategory(listing) {
  return listing.product_type === 'tcg' ? 'tcg' : 'physical';
}
function shippingGroupKey(listing) {
  return `${listing.seller_id}::${macroCategory(listing)}`;
}

const PLATFORM_FEE_RATE = 0.05;

function computeFees(itemPrice) {
  const platformFee = Math.round(itemPrice * PLATFORM_FEE_RATE * 100) / 100;
  const sellerFee = platformFee;
  const sellerPayout = itemPrice - sellerFee;
  return { platformFee, sellerFee, sellerPayout };
}

// Resolves the checkout-time shipping address into a plain snapshot object,
// whichever way the buyer supplied it (a saved address, or typed ad hoc).
// Never trusts a bare country string from the client without going through
// this — it's what src/db/schema.sql's orders.shipping_address comment
// ("snapshot indirizzo al momento ordine") already called for, just never
// implemented. Returns { error } or { snapshot }.
async function resolveCheckoutAddress(userId, input) {
  const { error, value } = validateAddress(checkoutAddressSchema, input || {});
  if (error) return { error: `Indirizzo di spedizione non valido: ${error}` };

  if (value.addressId) {
    const saved = await addressRepository.findById(userId, value.addressId);
    if (!saved) return { error: 'Indirizzo di spedizione non trovato' };
    return {
      snapshot: {
        fullName: saved.full_name,
        addressStreet: saved.address_street || saved.address,
        addressHouseNumber: saved.address_house_number || null,
        city: saved.city,
        zip: saved.zip,
        province: saved.province || null,
        country: saved.country,
        phone: saved.phone,
      },
    };
  }

  const { addressId, ...fields } = value;
  return { snapshot: fields };
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
// NB: non risulta chiamato da alcuna pagina del client oggi (il frontend
// passa sempre dal carrello, anche per un solo articolo — vedi
// createCartPaymentIntentHandler). Aggiornato per coerenza e per non
// lasciarlo con un flusso indirizzo divergente, ma senza UI dedicata.
async function createPaymentIntentHandler(req, res) {
  const { listingId, shippingMethod, shippingAddress } = req.body;

  const { error: addressError, snapshot: buyerAddress } = await resolveCheckoutAddress(req.user.userId, shippingAddress);
  if (addressError) {
    return res.status(400).json({ error: addressError });
  }

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
      shippingAddress: buyerAddress,
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
  // shippingSelections is keyed by shipping-group key ("<sellerId>::<macro>"),
  // each { method }: a carrier code for physical groups, a tier id for TCG.
  // shippingAddress is mandatory: either { addressId } (a saved address) or
  // the address fields typed ad hoc — see resolveCheckoutAddress.
  const { itemIds, shippingSelections = {}, shippingAddress } = req.body;
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({ error: 'Nessun articolo selezionato' });
  }

  const { error: addressError, snapshot: buyerAddress } = await resolveCheckoutAddress(req.user.userId, shippingAddress);
  if (addressError) {
    return res.status(400).json({ error: addressError });
  }

  // Anti-abuso (CLAUDE.md): segnali di identità raccolti al checkout, usati insieme a
  // quelli di registrazione/login per capire se un venditore e un compratore sono la
  // stessa persona quando arriva il momento di concedere i bonus vendita/acquisto.
  await identitySignalRepository.recordSignal(req.user.userId, 'ip', req.ip);
  await identitySignalRepository.recordSignal(req.user.userId, 'device', req.headers['user-agent']);
  await identitySignalRepository.recordAddressSignal(req.user.userId, {
    street: buyerAddress.addressStreet,
    houseNumber: buyerAddress.addressHouseNumber,
    zip: buyerAddress.zip,
    country: buyerAddress.country,
  });

  try {
    const listings = await paymentsRepository.findActiveListingsByIds(itemIds);
    if (listings.length !== itemIds.length) {
      return res.status(400).json({ error: 'Uno o più articoli non sono più disponibili' });
    }

    for (const listing of listings) {
      if (listing.type === 'auction') {
        return res.status(400).json({ error: `"${listing.title}" è un'asta: non è disponibile l'acquisto diretto` });
      }
      const p = parseFloat(listing.price);
      if (!Number.isFinite(p) || p <= 0) {
        return res.status(400).json({ error: `Prezzo non valido per "${listing.title}"` });
      }
    }

    // The buyer's destination for THIS checkout — the address they just
    // chose/typed, never their generic profile country (which is only a
    // locale hint and may not even match where they're having this shipped).
    const buyerCountry = buyerAddress.country;

    // Each seller's ship-FROM address used to be hardcoded to 'it' (country
    // only) here, silently wrong for any non-Italian seller. Fetched in full
    // per seller now (small carts, one lookup per distinct seller — no batch
    // query needed) — the full profile also becomes the shipment's
    // ship_from_address snapshot below, not just a country code.
    const sellerIds = [...new Set(listings.map((l) => l.seller_id))];
    const sellerById = new Map();
    await Promise.all(sellerIds.map(async (id) => {
      sellerById.set(id, await userRepository.findById(id));
    }));

    // Group items into one shipment per (seller × macro-category), then compute
    // that group's shipping ONCE — server-side, ignoring any client cost.
    const groups = new Map();
    for (const listing of listings) {
      const key = shippingGroupKey(listing);
      if (!groups.has(key)) groups.set(key, { key, macro: macroCategory(listing), items: [] });
      groups.get(key).items.push(listing);
    }

    // key -> { cost, method, shippingOptionCode, rateSource }. TCG keeps the
    // static card-count/value tier system entirely — no aggregator call.
    // Physical groups now resolve a quote token the buyer was already shown
    // (see POST /api/shipping/quote) instead of picking a static carrier
    // here: the price actually charged is whatever that quote locked in,
    // never recalculated from scratch at this point (a fresh recalculation
    // could legitimately differ from what the buyer saw and agreed to pay).
    const groupShipping = new Map();
    for (const g of groups.values()) {
      const sel = shippingSelections[g.key] || {};
      if (g.macro === 'tcg') {
        const cardCount = g.items.length;
        const value = g.items.reduce((s, it) => s + parseFloat(it.price), 0);
        const { tierId, cost } = resolveTcgShipping(sel.method, cardCount, value);
        groupShipping.set(g.key, { cost, method: tierId, shippingOptionCode: null, rateSource: 'tcg_tier' });
      } else {
        const sellerCountry = sellerById.get(g.items[0].seller_id)?.address_country || 'IT';
        const weightKg = g.items.reduce((s, it) => s + (parseFloat(it.weight_kg) || 0), 0);
        const fp = shippingQuote.fingerprint({
          listingIds: g.items.map((it) => it.id), weightKg, sellerCountry, buyerCountry,
        });
        const { error: quoteError, quote } = await shippingQuote.resolveQuote({
          token: sel.quoteToken, buyerId: req.user.userId, currentFingerprint: fp,
        });
        if (quoteError) {
          return res.status(409).json({
            error: 'La quotazione di spedizione è scaduta o non corrisponde più al carrello. Richiedine una nuova.',
            code: quoteError,
          });
        }
        groupShipping.set(g.key, {
          cost: quote.price, method: quote.carrierCode,
          shippingOptionCode: quote.shippingOptionCode, rateSource: quote.rateSource,
        });
      }
    }

    // One order row per listing, tagged with which group it belongs to so it
    // can be linked to that group's shipment once one exists (below). The
    // whole group's shipping still goes on the first row of that group (0 on
    // the rest) — that's how the Stripe charge amount is built and stays
    // unchanged — but it's no longer the only record of the group's true
    // cost: every row now also points at a shipments row (shipment_id) whose
    // shipping_cost is the correct group total regardless of row order.
    const chargedGroups = new Set();
    const orderRows = [];
    let totalCents = 0;

    for (const g of groups.values()) {
      const sorted = [...g.items].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const { cost: groupCost, method } = groupShipping.get(g.key);

      for (const listing of sorted) {
        const itemPrice = parseFloat(listing.price);
        const shippingCost = chargedGroups.has(g.key) ? 0 : groupCost;
        chargedGroups.add(g.key);

        const { platformFee, sellerFee, sellerPayout } = computeFees(itemPrice);
        const totalBuyer = itemPrice + shippingCost + platformFee;

        orderRows.push({
          listing, shippingCost, selectedCarrier: method || null, groupKey: g.key,
          itemPrice, platformFee, sellerFee, sellerPayout, totalBuyer,
        });
        totalCents += Math.round(totalBuyer * 100);
      }
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

    // One shipment per group, created now that the PaymentIntent id exists
    // (shipments key off it the same way orders do, so the webhook below can
    // move every shipment of a checkout in one UPDATE).
    const shipmentIdByGroupKey = new Map();
    for (const g of groups.values()) {
      const { cost: groupCost, method, shippingOptionCode, rateSource } = groupShipping.get(g.key);
      const seller = sellerById.get(g.items[0].seller_id);
      const totalWeightKg = g.macro === 'tcg'
        ? null
        : g.items.reduce((s, it) => s + (parseFloat(it.weight_kg) || 0), 0);

      const shipmentId = await shipmentRepository.create({
        sellerId: g.items[0].seller_id,
        buyerId: req.user.userId,
        macroCategory: g.macro,
        stripePaymentIntentId: paymentIntent.id,
        shippingMethod: method || null,
        shippingCost: groupCost,
        rateSource,
        sendcloudShippingOptionCode: shippingOptionCode || null,
        totalWeightKg,
        shipFromAddress: sellerAddressSnapshot(seller),
        shipToAddress: buyerAddress,
      });
      shipmentIdByGroupKey.set(g.key, shipmentId);
    }

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
        shippingAddress: buyerAddress,
        shipmentId: shipmentIdByGroupKey.get(o.groupKey),
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
      // Ogni shipment della stessa checkout passa da "in attesa di pagamento"
      // a "in attesa che il venditore lo prepari" — stesso evento, nessuna
      // modifica alla logica ordine/escrow esistente sopra.
      await shipmentRepository.markAwaitingPreparationByIntent(pi.id);

      // Il pagamento è confermato: gli annunci non sono più acquistabili da altri.
      // Il payout al venditore resta 'pending' finché non lo si registra da
      // /admin/payouts (CardBrix paga fuori Stripe, non un transfer automatico).
      for (const order of orders) {
        await paymentsRepository.markListingSold(order.listing_id);
        await recomputeUserRole(order.buyer_id);
      }

      // Anti-abuso (CLAUDE.md — "metodo di pagamento" condiviso tra venditore e
      // compratore): l'impronta della carta (Stripe la calcola sul PAN, la stessa
      // carta dà sempre la stessa impronta anche su PaymentMethod diversi) viene
      // registrata come segnale del compratore. Un problema qui non deve mai far
      // fallire il webhook — l'ordine è già stato processato sopra.
      if (orders.length > 0 && pi.payment_method) {
        try {
          const paymentMethod = await stripe.paymentMethods.retrieve(pi.payment_method);
          const fingerprint = paymentMethod.card?.fingerprint;
          if (fingerprint) {
            await identitySignalRepository.recordSignal(orders[0].buyer_id, 'payment_fingerprint', fingerprint);
          }
        } catch (err) {
          console.error('[AntiAbuse] Failed to record payment fingerprint:', err.message);
        }
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      await paymentsRepository.markOrdersCancelledByIntent(pi.id);
      // No label was ever possible for a failed payment — mark the linked
      // shipments dead too, so nothing shows up as "awaiting preparation"
      // for an order that never got paid.
      await shipmentRepository.markCancelledByIntent(pi.id);
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
