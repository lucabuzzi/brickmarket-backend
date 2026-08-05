
const express = require('express');
const Stripe = require('stripe');
const db = require('../db/clutchvault-db');
const mainDb = require('../db');
const { authenticateToken } = require('./contest');

const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT balance_credits FROM public.user_wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // Lazy wallet creation for main app users
      try {
        await db.query(
          'INSERT INTO public.user_wallets (user_id, balance_credits) VALUES ($1, 100.00)',
          [req.user.id]
        );
        return res.json({ balanceCredits: 100.00 });
      } catch (err) {}
      return res.status(404).json({ error: 'Wallet not found for user' });
    }

    const { balance_credits } = result.rows[0];
    return res.json({
      balanceCredits: parseFloat(balance_credits)
    });
  } catch (error) {
    console.error('Fetch wallet balance error:', error);
    return res.status(500).json({ error: 'Database error fetching wallet balance' });
  }
});

router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, amount, type, reference_id, created_at FROM public.credit_transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    const transactions = result.rows.map(tx => ({
      id: tx.id,
      amount: parseFloat(tx.amount),
      type: tx.type,
      referenceId: tx.reference_id,
      createdAt: tx.created_at
    }));

    return res.json({ transactions });
  } catch (error) {
    console.error('Fetch transaction history error:', error);
    return res.status(500).json({ error: 'Database error fetching transactions' });
  }
});

// Real card payment (Stripe PaymentIntent) for topping up the wallet.
// Credits are granted by the /api/webhooks/stripe handler on payment_intent.succeeded,
// not here — this only starts the payment.
router.post('/create-topup-intent', authenticateToken, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Pagamenti non configurati sul server' });
  }

  const amountEuros = parseFloat(req.body.amountEuros);
  if (!Number.isFinite(amountEuros) || amountEuros < 1) {
    return res.status(400).json({ error: 'Importo non valido (minimo 1€)' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountEuros * 100),
      currency: 'eur',
      payment_method_types: ['card'],
      metadata: { userId: req.user.id, type: 'wallet_topup' },
    });

    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Create topup intent error:', error);
    return res.status(500).json({ error: 'Impossibile avviare il pagamento' });
  }
});

// Called by the client right after stripe.confirmCardPayment() resolves, so credits
// land without waiting on webhook delivery (which needs the Stripe CLI forwarding to
// localhost in dev). Verifies the PaymentIntent against Stripe directly rather than
// trusting the client's word for it, and is a no-op if the webhook already credited it.
router.post('/confirm-topup', authenticateToken, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Pagamenti non configurati sul server' });
  }

  const { paymentIntentId } = req.body;
  if (!paymentIntentId) {
    return res.status(400).json({ error: 'paymentIntentId richiesto' });
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Pagamento non completato' });
    }
    if (intent.metadata?.userId !== req.user.id) {
      return res.status(403).json({ error: 'Pagamento non associato a questo utente' });
    }

    const existing = await db.query(
      "SELECT id FROM public.credit_transactions WHERE reference_id = $1 AND type = 'deposit'",
      [paymentIntentId]
    );

    if (existing.rows.length === 0) {
      const creditsToDeposit = intent.amount / 100;
      await db.query(
        'UPDATE public.user_wallets SET balance_credits = balance_credits + $1, updated_at = now() WHERE user_id = $2',
        [creditsToDeposit, req.user.id]
      );
      await db.query(
        'INSERT INTO public.credit_transactions (user_id, amount, type, reference_id) VALUES ($1, $2, $3, $4)',
        [req.user.id, creditsToDeposit, 'deposit', paymentIntentId]
      );
    }

    const balanceRes = await db.query(
      'SELECT balance_credits FROM public.user_wallets WHERE user_id = $1',
      [req.user.id]
    );

    return res.json({
      success: true,
      balanceCredits: parseFloat(balanceRes.rows[0]?.balance_credits || 0),
    });
  } catch (error) {
    console.error('Confirm topup error:', error);
    return res.status(500).json({ error: 'Errore nella conferma del pagamento' });
  }
});

router.post('/buy-product', authenticateToken, async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required for purchase' });
  }

  try {
    // Single atomic call: public.buy_product() row-locks the wallet and the
    // product before validating and writing, so two near-simultaneous requests
    // (double-click, retry, two tabs) can never both succeed off the same
    // starting balance/stock — the second one re-checks against the first's
    // already-committed result instead of racing it.
    const result = await db.query(
      'SELECT public.buy_product($1, $2) AS result',
      [req.user.id, productId]
    );

    const callResult = result.rows[0].result;

    if (!callResult.success) {
      if (callResult.message === 'Product not found.') {
        return res.status(404).json({ error: 'Product not found' });
      }
      if (callResult.message === 'Wallet not found for user.') {
        return res.status(404).json({ error: 'Wallet not found' });
      }
      if (callResult.message === 'Insufficient funds.') {
        return res.status(400).json({
          error: 'Insufficient funds.',
          requiredCredits: parseFloat(callResult.requiredCredits),
          availableCredits: parseFloat(callResult.availableCredits)
        });
      }
      return res.status(400).json({ error: callResult.message });
    }

    return res.json({
      success: true,
      message: `Purchase successful! Used ${parseFloat(callResult.price).toFixed(2)} credits.`,
      productTitle: callResult.productTitle,
      price: parseFloat(callResult.price),
      newBalances: {
        balanceCredits: parseFloat(callResult.newBalance)
      }
    });
  } catch (error) {
    console.error('Product purchase transaction error:', error);
    return res.status(500).json({ error: 'Purchase transaction failed: ' + error.message });
  }
});

// Whether this user can cash out credits to their bank account right now, and
// whether they need to (re)complete Stripe Connect onboarding first. Reuses the
// same Connect account marketplace sellers use (src/routes/payments.js onboard-seller) —
// converting credits is just another payout onto that same account.
router.get('/payout-status', authenticateToken, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Pagamenti non configurati sul server' });
  }

  try {
    const userRes = await mainDb.query('SELECT stripe_account_id FROM users WHERE id = $1', [req.user.id]);
    const stripeAccountId = userRes.rows[0]?.stripe_account_id;

    if (!stripeAccountId) {
      return res.json({ payoutsEnabled: false, onboardingStarted: false });
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);
    return res.json({ payoutsEnabled: !!account.payouts_enabled, onboardingStarted: true });
  } catch (error) {
    console.error('Payout status check error:', error);
    return res.status(500).json({ error: 'Errore nel controllo dello stato pagamenti' });
  }
});

// Converts credits to a real transfer onto the user's connected Stripe account
// (1 CR = 1€, matching the wallet's exchange rate). Debit-then-transfer, with a
// refund back to the wallet if the Stripe transfer itself fails, so credits are
// never lost to a failed payout.
router.post('/convert', authenticateToken, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Pagamenti non configurati sul server' });
  }

  const credits = parseFloat(req.body.credits);
  if (!Number.isFinite(credits) || credits <= 0) {
    return res.status(400).json({ error: 'Importo crediti non valido' });
  }

  try {
    const userRes = await mainDb.query('SELECT stripe_account_id FROM users WHERE id = $1', [req.user.id]);
    const stripeAccountId = userRes.rows[0]?.stripe_account_id;
    if (!stripeAccountId) {
      return res.status(400).json({ error: 'stripe_onboarding_required' });
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);
    if (!account.payouts_enabled) {
      return res.status(400).json({ error: 'stripe_onboarding_incomplete' });
    }

    let debitRes;
    try {
      debitRes = await db.query(
        `UPDATE public.user_wallets
         SET balance_credits = balance_credits - $1, updated_at = now()
         WHERE user_id = $2 AND balance_credits >= $1
         RETURNING balance_credits`,
        [credits, req.user.id]
      );
    } catch (debitErr) {
      console.error('Convert debit error:', debitErr);
      return res.status(400).json({ error: 'Credito insufficiente' });
    }

    if (debitRes.rows.length === 0) {
      return res.status(400).json({ error: 'Credito insufficiente' });
    }

    let transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: Math.round(credits * 100),
        currency: 'eur',
        destination: stripeAccountId,
        metadata: { userId: req.user.id, type: 'wallet_conversion' },
      });
    } catch (stripeErr) {
      // Refund the credits since the payout itself never happened
      await db.query(
        'UPDATE public.user_wallets SET balance_credits = balance_credits + $1 WHERE user_id = $2',
        [credits, req.user.id]
      );
      console.error('Stripe transfer failed during conversion:', stripeErr);
      return res.status(502).json({ error: 'Trasferimento Stripe fallito, credito ripristinato' });
    }

    await db.query(
      'INSERT INTO public.credit_transactions (user_id, amount, type, reference_id) VALUES ($1, $2, $3, $4)',
      [req.user.id, -credits, 'payout', transfer.id]
    );

    return res.json({
      success: true,
      convertedCredits: credits,
      newBalanceCredits: parseFloat(debitRes.rows[0].balance_credits),
      transferId: transfer.id,
    });
  } catch (error) {
    console.error('Convert credits error:', error);
    return res.status(500).json({ error: 'Errore durante la conversione' });
  }
});

module.exports = router;
