
const express = require('express');
const Stripe = require('stripe');
const db = require('../db/clutchvault-db');

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
    const userId = paymentIntent.metadata?.userId || paymentIntent.metadata?.user_id;

    if (!userId) {
      console.error('❌ PaymentIntent missing userId in metadata.');
      return res.status(400).json({ error: 'Missing userId in metadata' });
    }

    const creditsToDeposit = amountInCents / 100;
    console.log(`💳 Stripe payment: €${(amountInCents/100).toFixed(2)} converted to ${creditsToDeposit} credits.`);

    try {
      // The client also confirms top-ups directly via POST /api/wallet/confirm-topup
      // (so credit lands immediately without depending on webhook delivery in local
      // dev). Whichever of the two runs first wins; skip here if already credited.
      const existing = await db.query(
        "SELECT id FROM public.credit_transactions WHERE reference_id = $1 AND type = 'deposit'",
        [paymentIntentId]
      );
      if (existing.rows.length > 0) {
        return res.status(200).json({ received: true, alreadyCredited: true });
      }

      await db.query(
        'UPDATE public.user_wallets SET balance_credits = balance_credits + $1 WHERE user_id = $2',
        [creditsToDeposit, userId]
      );

      await db.query(
        'INSERT INTO public.credit_transactions (user_id, amount, type, reference_id) VALUES ($1, $2, $3, $4)',
        [userId, creditsToDeposit, 'deposit', paymentIntentId]
      );

      console.log(`✅ Wallet credited with ${creditsToDeposit} credits.`);
      return res.status(200).json({ received: true, credited: creditsToDeposit });
    } catch (err) {
      console.error('❌ Stripe Webhook credit failed:', err.message);
      return res.status(500).json({ error: 'Database update failed' });
    }
  }

  return res.status(200).json({ received: true });
});

router.post('/simulate-checkout', express.json(), async (req, res) => {
  const { userId, amountEuros } = req.body;
  if (!userId || !amountEuros || amountEuros <= 0) {
    return res.status(400).json({ error: 'userId and valid amountEuros are required.' });
  }

  const cents = Math.round(amountEuros * 100);
  const mockPaymentIntentId = 'pi_' + Math.random().toString(36).substring(2, 15);
  const creditsToDeposit = cents / 100;

  try {
    // Check wallet exists
    const balanceRes = await db.query(
      'SELECT user_id FROM public.user_wallets WHERE user_id = $1',
      [userId]
    );
    if (balanceRes.rows.length === 0) {
      // Lazy create
      await db.query(
        'INSERT INTO public.user_wallets (user_id, balance_credits) VALUES ($1, 0.00)',
        [userId]
      );
    }

    await db.query(
      'UPDATE public.user_wallets SET balance_credits = balance_credits + $1 WHERE user_id = $2',
      [creditsToDeposit, userId]
    );

    await db.query(
      'INSERT INTO public.credit_transactions (user_id, amount, type, reference_id) VALUES ($1, $2, $3, $4)',
      [userId, creditsToDeposit, 'deposit', mockPaymentIntentId]
    );

    return res.json({
      success: true,
      message: `Simulated Stripe Purchase: €${amountEuros.toFixed(2)} converted to ${creditsToDeposit} credits.`,
      creditedCredits: creditsToDeposit,
      paymentIntentId: mockPaymentIntentId
    });
  } catch (err) {
    console.error('Checkout simulation error:', err);
    return res.status(500).json({ error: 'Checkout simulation failed: ' + err.message });
  }
});

module.exports = router;
