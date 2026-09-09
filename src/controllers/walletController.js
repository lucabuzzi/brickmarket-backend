const Stripe = require('stripe');
const walletRepository = require('../repositories/walletRepository');
const {
  createTopupIntentSchema, confirmTopupSchema, buyProductSchema, convertSchema, validate,
} = require('../validators/walletValidators');

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

async function getBalanceHandler(req, res) {
  try {
    const wallet = await walletRepository.getBalance(req.user.id);

    if (!wallet) {
      // Lazy wallet creation for main app users
      try {
        await walletRepository.createWallet(req.user.id, 100.00);
        return res.json({ balanceCredits: 100.00 });
      } catch (err) {}
      return res.status(404).json({ error: 'Wallet not found for user' });
    }

    return res.json({ balanceCredits: parseFloat(wallet.balance_credits) });
  } catch (error) {
    console.error('Fetch wallet balance error:', error);
    return res.status(500).json({ error: 'Database error fetching wallet balance' });
  }
}

async function getTransactionsHandler(req, res) {
  try {
    const rows = await walletRepository.listTransactions(req.user.id);
    const transactions = rows.map((tx) => ({
      id: tx.id,
      amount: parseFloat(tx.amount),
      type: tx.type,
      referenceId: tx.reference_id,
      createdAt: tx.created_at,
    }));
    return res.json({ transactions });
  } catch (error) {
    console.error('Fetch transaction history error:', error);
    return res.status(500).json({ error: 'Database error fetching transactions' });
  }
}

// Real card payment (Stripe PaymentIntent) for topping up the wallet.
// Credits are granted by the /api/webhooks/stripe handler on payment_intent.succeeded,
// not here — this only starts the payment.
async function createTopupIntentHandler(req, res) {
  if (!stripe) {
    return res.status(503).json({ error: 'Pagamenti non configurati sul server' });
  }

  const { error, value } = validate(createTopupIntentSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(value.amountEuros * 100),
      currency: 'eur',
      payment_method_types: ['card'],
      metadata: { userId: req.user.id, type: 'wallet_topup' },
    });

    return res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Create topup intent error:', error);
    return res.status(500).json({ error: 'Impossibile avviare il pagamento' });
  }
}

// Called by the client right after stripe.confirmCardPayment() resolves, so credits
// land without waiting on webhook delivery (which needs the Stripe CLI forwarding to
// localhost in dev). Verifies the PaymentIntent against Stripe directly rather than
// trusting the client's word for it, and is a no-op if the webhook already credited it.
async function confirmTopupHandler(req, res) {
  if (!stripe) {
    return res.status(503).json({ error: 'Pagamenti non configurati sul server' });
  }

  const { error, value } = validate(confirmTopupSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(value.paymentIntentId);
    if (intent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Pagamento non completato' });
    }
    if (intent.metadata?.userId !== req.user.id) {
      return res.status(403).json({ error: 'Pagamento non associato a questo utente' });
    }

    const existing = await walletRepository.findDepositByReference(value.paymentIntentId);
    if (!existing) {
      const creditsToDeposit = intent.amount / 100;
      await walletRepository.creditWallet(req.user.id, creditsToDeposit, {
        referenceId: value.paymentIntentId,
        type: 'deposit',
      });
    }

    const wallet = await walletRepository.getBalance(req.user.id);
    return res.json({
      success: true,
      balanceCredits: parseFloat(wallet?.balance_credits || 0),
    });
  } catch (error) {
    console.error('Confirm topup error:', error);
    return res.status(500).json({ error: 'Errore nella conferma del pagamento' });
  }
}

async function buyProductHandler(req, res) {
  const { error, value } = validate(buyProductSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    // Single atomic call: public.buy_product() row-locks the wallet and the
    // product before validating and writing, so two near-simultaneous requests
    // (double-click, retry, two tabs) can never both succeed off the same
    // starting balance/stock — the second one re-checks against the first's
    // already-committed result instead of racing it.
    const callResult = await walletRepository.buyProduct(req.user.id, value.productId);

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
          availableCredits: parseFloat(callResult.availableCredits),
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
        balanceCredits: parseFloat(callResult.newBalance),
      },
    });
  } catch (error) {
    console.error('Product purchase transaction error:', error);
    return res.status(500).json({ error: 'Purchase transaction failed: ' + error.message });
  }
}

// Whether this user can cash out credits to their bank account right now, and
// whether they need to (re)complete Stripe Connect onboarding first. Reuses the
// same Connect account marketplace sellers use (src/routes/payments.js onboard-seller) —
// converting credits is just another payout onto that same account.
async function getPayoutStatusHandler(req, res) {
  if (!stripe) {
    return res.status(503).json({ error: 'Pagamenti non configurati sul server' });
  }

  try {
    const stripeAccountId = await walletRepository.getStripeAccountId(req.user.id);
    if (!stripeAccountId) {
      return res.json({ payoutsEnabled: false, onboardingStarted: false });
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);
    return res.json({ payoutsEnabled: !!account.payouts_enabled, onboardingStarted: true });
  } catch (error) {
    console.error('Payout status check error:', error);
    return res.status(500).json({ error: 'Errore nel controllo dello stato pagamenti' });
  }
}

// Converts credits to a real transfer onto the user's connected Stripe account
// (1 CR = 1€, matching the wallet's exchange rate). Debit-then-transfer, with a
// refund back to the wallet if the Stripe transfer itself fails, so credits are
// never lost to a failed payout.
async function convertHandler(req, res) {
  if (!stripe) {
    return res.status(503).json({ error: 'Pagamenti non configurati sul server' });
  }

  const { error, value } = validate(convertSchema, req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const credits = value.credits;

  try {
    const stripeAccountId = await walletRepository.getStripeAccountId(req.user.id);
    if (!stripeAccountId) {
      return res.status(400).json({ error: 'stripe_onboarding_required' });
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);
    if (!account.payouts_enabled) {
      return res.status(400).json({ error: 'stripe_onboarding_incomplete' });
    }

    let debited;
    try {
      debited = await walletRepository.debitWalletIfSufficient(req.user.id, credits);
    } catch (debitErr) {
      console.error('Convert debit error:', debitErr);
      return res.status(400).json({ error: 'Credito insufficiente' });
    }

    if (!debited) {
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
      await walletRepository.creditWallet(req.user.id, credits);
      console.error('Stripe transfer failed during conversion:', stripeErr);
      return res.status(502).json({ error: 'Trasferimento Stripe fallito, credito ripristinato' });
    }

    await walletRepository.recordTransaction(req.user.id, -credits, 'payout', transfer.id);

    return res.json({
      success: true,
      convertedCredits: credits,
      newBalanceCredits: parseFloat(debited.balance_credits),
      transferId: transfer.id,
    });
  } catch (error) {
    console.error('Convert credits error:', error);
    return res.status(500).json({ error: 'Errore durante la conversione' });
  }
}

module.exports = {
  getBalanceHandler,
  getTransactionsHandler,
  createTopupIntentHandler,
  confirmTopupHandler,
  buyProductHandler,
  getPayoutStatusHandler,
  convertHandler,
};
