const express = require('express');
const Stripe = require('stripe');
const db = require('./db');

const router = express.Router();
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeKey ? new Stripe(stripeKey) : null;

// Secure Stripe Webhook handler
// Converts Euros to credits (€10.00 = 100 credits) and executes the ledger transaction.
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;

  // 1. Signature Verification
  if (stripe && stripeWebhookSecret) {
    const sig = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err) {
      console.error('⚠️ Stripe Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    // FALLBACK / DEV MODE: Parse body directly if Stripe keys are missing for easy local testing
    console.log('⚠️ Stripe credentials missing or incomplete. Processing webhook in DEV MODE...');
    try {
      // In Express, if express.raw() is used, req.body is a Buffer. We parse it to JSON.
      const payloadString = req.body.toString('utf8');
      event = JSON.parse(payloadString);
    } catch (err) {
      console.error('Failed to parse dev webhook body:', err.message);
      return res.status(400).send(`Webhook Parse Error: ${err.message}`);
    }
  }

  // 2. Handle Event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const amountInCents = paymentIntent.amount; // e.g. 1000 cents = €10.00
    const paymentIntentId = paymentIntent.id;
    const userId = paymentIntent.metadata?.userId || paymentIntent.metadata?.user_id;

    if (!userId) {
      console.error('❌ PaymentIntent did not contain userId in metadata.');
      return res.status(400).json({ error: 'Missing userId in metadata' });
    }

    // €10.00 = 100 credits => 10 credits per 1 Euro (100 cents) => credits = cents / 10
    const creditsToDeposit = amountInCents / 10;

    console.log(`💳 Stripe payment succeeded: ${amountInCents} cents (€${(amountInCents/100).toFixed(2)}) for user ${userId}. Converting to ${creditsToDeposit} credits.`);

    try {
      // Execute the ledger update
      if (db.isMock) {
        await db.query(
          'UPDATE public.user_wallets SET balance_credits = balance_credits + $1 WHERE user_id = $2',
          [creditsToDeposit, userId]
        );
      } else {
        await db.query('BEGIN');
        
        // Lock user wallet row
        await db.query(
          'SELECT balance_credits FROM public.user_wallets WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        await db.query(
          'UPDATE public.user_wallets SET balance_credits = balance_credits + $1 WHERE user_id = $2',
          [creditsToDeposit, userId]
        );
        
        await db.query('COMMIT');
      }

      // Log transaction in credit_transactions
      await db.query(
        'INSERT INTO public.credit_transactions (user_id, amount, type, reference_id) VALUES ($1, $2, $3, $4)',
        [userId, creditsToDeposit, 'deposit', paymentIntentId]
      );

      console.log(`✅ Wallet successfully credited with ${creditsToDeposit} credits.`);
      return res.status(200).json({ received: true, credited: creditsToDeposit });
    } catch (err) {
      if (!db.isMock) {
        await db.query('ROLLBACK');
      }
      console.error('❌ Error updating wallet in Stripe Webhook:', err.message);
      return res.status(500).json({ error: 'Database update failed: ' + err.message });
    }
  }

  // Acknowledge receipt of other events
  return res.status(200).json({ received: true });
});

// DEV HELPER ENDPOINT: Direct simulation of Stripe checkout for easy manual testing in the frontend
// Allows simulating credit purchases without Stripe CLI or webhook proxies
router.post('/simulate-checkout', express.json(), async (req, res) => {
  const { userId, amountEuros } = req.body;

  if (!userId || !amountEuros || amountEuros <= 0) {
    return res.status(400).json({ error: 'userId and valid amountEuros are required.' });
  }

  const cents = Math.round(amountEuros * 100);
  const mockPaymentIntentId = 'pi_' + Math.random().toString(36).substring(2, 15);

  const mockPayload = {
    id: 'evt_' + Math.random().toString(36).substring(2, 15),
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: mockPaymentIntentId,
        amount: cents,
        metadata: {
          userId
        }
      }
    }
  };

  // Convert payload to buffer for webhook compatibility
  const payloadBuffer = Buffer.from(JSON.stringify(mockPayload));

  // Trigger our own webhook handler in dev mode!
  try {
    const fetch = require('node-fetch'); // wait, we can just call it locally or trigger the database code directly
    // Let's directly credit the wallet to be fast and simple:
    const creditsToDeposit = cents / 10;
    
    // Ledger updates
    if (db.isMock) {
      await db.query(
        'UPDATE public.user_wallets SET balance_credits = balance_credits + $1 WHERE user_id = $2',
        [creditsToDeposit, userId]
      );
    } else {
      await db.query('BEGIN');
      await db.query(
        'UPDATE public.user_wallets SET balance_credits = balance_credits + $1 WHERE user_id = $2',
        [creditsToDeposit, userId]
      );
      await db.query('COMMIT');
    }

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
