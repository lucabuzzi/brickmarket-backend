const walletRepository = require('../repositories/walletRepository');
const { buyProductSchema, validate } = require('../validators/walletValidators');

async function getBalanceHandler(req, res) {
  try {
    const wallet = await walletRepository.getBalance(req.user.id);

    if (!wallet) {
      // Lazy wallet creation for main app users. Starts at 0: crediti si guadagnano solo
      // tramite gli eventi definiti (registrazione, referral, vendita, acquisto — vedi
      // CLAUDE.md, "REGOLE DI PRODOTTO DEFINITIVE SUI CREDITI"), mai da un saldo di partenza.
      try {
        await walletRepository.createWallet(req.user.id, 0.00);
        return res.json({ balanceCredits: 0.00 });
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

module.exports = {
  getBalanceHandler,
  getTransactionsHandler,
  buyProductHandler,
};
