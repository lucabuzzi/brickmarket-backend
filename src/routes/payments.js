const express = require('express');
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { query, getClient } = require('../db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// ─── STRIPE ──────────────────────────────────────────────────────────────────

// 1. Onboarding venditore: crea un account Stripe Connect
router.post('/stripe/onboard-seller', authMiddleware, async (req, res) => {
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'IT',
      email: req.body.email,
      capabilities: { transfers: { requested: true } },
      business_type: 'individual',
    });

    // Salva l'account ID sul nostro DB
    await query(
      'UPDATE users SET stripe_account_id=$1 WHERE id=$2',
      [account.id, req.user.userId]
    );

    // Genera il link di onboarding (il venditore completa i dati su Stripe)
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL}/seller/onboarding-retry`,
      return_url:  `${process.env.FRONTEND_URL}/seller/onboarding-complete`,
      type: 'account_onboarding',
    });

    res.json({ onboardingUrl: accountLink.url });
  } catch (err) {
    console.error('Stripe onboard error:', err);
    res.status(500).json({ error: 'Errore durante la configurazione pagamenti' });
  }
});

// 2. Crea un PaymentIntent (acquirente avvia il pagamento)
router.post('/stripe/create-payment-intent', authMiddleware, async (req, res) => {
  const { listingId, shippingAddressId, shippingMethod } = req.body;

  try {
    // Recupera annuncio e venditore
    const listingRes = await query(
      `SELECT l.*, u.stripe_account_id, u.stripe_account_status
       FROM listings l JOIN users u ON l.seller_id = u.id
       WHERE l.id=$1 AND l.status='active'`,
      [listingId]
    );
    const listing = listingRes.rows[0];
    if (!listing) return res.status(404).json({ error: 'Annuncio non trovato' });
    if (!listing.stripe_account_id) {
      return res.status(400).json({ error: 'Il venditore non ha configurato i pagamenti' });
    }
    if (listing.type === 'auction') {
      return res.status(400).json({ error: 'Acquisto diretto non disponibile per le aste' });
    }

    const itemPrice     = parseFloat(listing.price);
    if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
      return res.status(400).json({ error: 'Prezzo non valido per questo annuncio' });
    }
    const shippingCost  = parseFloat(listing.shipping_cost) || 0;
    // Il 5% è a CARICO dell'acquirente (aggiunto al prezzo)
    const platformFee   = Math.round(itemPrice * 0.05 * 100) / 100;
    const totalBuyer    = Math.round((itemPrice + shippingCost + platformFee) * 100);

    // Crea il PaymentIntent con destination charge:
    // i fondi vanno al platform (noi), poi trasferiamo al venditore dopo conferma
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   totalBuyer,  // in centesimi
      currency: 'eur',
      // La spedizione viene trasferita subito, il resto va in escrow
      // (gestito via webhook)
      metadata: {
        listingId,
        buyerId:       req.user.userId,
        sellerId:      listing.seller_id,
        itemPrice:     itemPrice.toString(),
        shippingCost:  shippingCost.toString(),
        platformFee:   platformFee.toString(),
        shippingMethod: shippingMethod || 'express',
      },
      automatic_payment_methods: { enabled: true },
    });

    // Crea ordine in stato 'pending_payment'
    const sellerFee   = Math.round(itemPrice * 0.05 * 100) / 100;
    const sellerPayout = itemPrice - sellerFee;

    const orderRes = await query(`
      INSERT INTO orders
        (buyer_id, seller_id, listing_id,
         item_price, shipping_cost, platform_fee, seller_fee,
         total_buyer, seller_payout,
         status, stripe_payment_intent_id, payment_gateway,
         confirm_deadline)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
              'pending_payment',$10,'stripe',
              NOW() + INTERVAL '5 days')
      RETURNING id
    `, [
      req.user.userId, listing.seller_id, listingId,
      itemPrice, shippingCost, platformFee, sellerFee,
      itemPrice + shippingCost + platformFee,
      sellerPayout,
      paymentIntent.id
    ]);

    res.json({
      clientSecret: paymentIntent.client_secret,
      orderId:      orderRes.rows[0].id,
      breakdown: {
        itemPrice, shippingCost, platformFee,
        totalBuyer: (itemPrice + shippingCost + platformFee).toFixed(2),
        sellerReceives: sellerPayout.toFixed(2),
      }
    });

  } catch (err) {
    console.error('PaymentIntent error:', err);
    res.status(500).json({ error: 'Errore creazione pagamento' });
  }
});

// 3. Acquirente conferma la ricezione → libera i fondi al venditore
router.post('/confirm-delivery/:orderId', authMiddleware, async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `SELECT o.*, u.stripe_account_id
       FROM orders o JOIN users u ON o.seller_id = u.id
       WHERE o.id=$1 AND o.buyer_id=$2 AND o.status='shipped'`,
      [req.params.orderId, req.user.userId]
    );
    const order = orderRes.rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ordine non trovato o già confermato' });
    }

    // Trasferisci i fondi al venditore (solo l'importo netto, senza la spedizione già accreditata)
    const transferAmount = Math.round(order.seller_payout * 100); // in centesimi
    const transfer = await stripe.transfers.create({
      amount:      transferAmount,
      currency:    'eur',
      destination: order.stripe_account_id,
      metadata:    { orderId: order.id },
    });

    // Aggiorna l'ordine
    await client.query(`
      UPDATE orders SET
        status='completed',
        stripe_transfer_id=$1,
        confirmed_at=NOW()
      WHERE id=$2
    `, [transfer.id, order.id]);

    // Aggiorna statistiche venditore
    await client.query(
      'UPDATE users SET sales_count=sales_count+1 WHERE id=$1',
      [order.seller_id]
    );

    // Segna l'annuncio come venduto
    await client.query(
      "UPDATE listings SET status='sold' WHERE id=$1",
      [order.listing_id]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Consegna confermata. Venditore pagato.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Confirm delivery error:', err);
    res.status(500).json({ error: 'Errore conferma consegna' });
  } finally {
    client.release();
  }
});

// 4. WEBHOOK Stripe (ascolta gli eventi: pagamento ricevuto, fallito, ecc.)
const webhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      const { listingId, shippingCost } = pi.metadata;

      // Aggiorna ordine a 'payment_received'
      await query(
        "UPDATE orders SET status='payment_received' WHERE stripe_payment_intent_id=$1",
        [pi.id]
      );

      // Trasferisci subito il costo spedizione al venditore
      if (parseFloat(shippingCost) > 0) {
        const orderRes = await query(
          `SELECT o.*, u.stripe_account_id FROM orders o
           JOIN users u ON o.seller_id=u.id
           WHERE o.stripe_payment_intent_id=$1`,
          [pi.id]
        );
        const order = orderRes.rows[0];
        if (order?.stripe_account_id) {
          await stripe.transfers.create({
            amount:      Math.round(parseFloat(shippingCost) * 100),
            currency:    'eur',
            destination: order.stripe_account_id,
            metadata:    { type: 'shipping', orderId: order.id },
          });
        }
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      await query(
        "UPDATE orders SET status='cancelled' WHERE stripe_payment_intent_id=$1",
        [pi.id]
      );
      break;
    }
  }

  res.json({ received: true });
};

// ─── PAYPAL ──────────────────────────────────────────────────────────────────

router.post('/paypal/create-order', authMiddleware, async (req, res) => {
  const { listingId } = req.body;
  try {
    const listingRes = await query(
      'SELECT * FROM listings WHERE id=$1 AND status=\'active\'',
      [listingId]
    );
    const listing = listingRes.rows[0];
    if (!listing) return res.status(404).json({ error: 'Annuncio non trovato' });
    if (listing.type === 'auction') {
      return res.status(400).json({ error: 'Acquisto diretto non disponibile per le aste' });
    }

    const itemPrice   = parseFloat(listing.price);
    if (!Number.isFinite(itemPrice) || itemPrice <= 0) {
      return res.status(400).json({ error: 'Prezzo non valido per questo annuncio' });
    }
    const shipping    = parseFloat(listing.shipping_cost) || 0;
    const fee         = Math.round(itemPrice * 0.05 * 100) / 100;
    const total       = (itemPrice + shipping + fee).toFixed(2);

    // Usa l'API REST di PayPal direttamente (più semplice dell'SDK)
    const accessToken = await getPayPalAccessToken();
    const response = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'EUR', value: total },
          description: `BrickMarket: ${listing.title}`,
          custom_id: `${listingId}|${req.user.userId}`,
        }]
      })
    });
    const order = await response.json();
    res.json({ paypalOrderId: order.id });
  } catch (err) {
    res.status(500).json({ error: 'Errore PayPal' });
  }
});

router.post('/paypal/capture/:paypalOrderId', authMiddleware, async (req, res) => {
  try {
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${req.params.paypalOrderId}/capture`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
      }
    );
    const capture = await response.json();
    // Aggiorna ordine nel DB con paypal_order_id e paypal_capture_id
    const [listingId, buyerId] = capture.purchase_units[0].custom_id.split('|');
    await query(
      "UPDATE orders SET status='payment_received', paypal_order_id=$1, paypal_capture_id=$2 WHERE listing_id=$3 AND buyer_id=$4",
      [req.params.paypalOrderId, capture.id, listingId, buyerId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Errore cattura PayPal' });
  }
});

async function getPayPalAccessToken() {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');
  const r = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const data = await r.json();
  return data.access_token;
}

module.exports = { router, webhook };   