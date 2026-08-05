const express = require('express');
const db = require('./db');
const { authenticateToken } = require('./auth');

const router = express.Router();

// GET WALLET BALANCE
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT balance_credits FROM public.user_wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
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

// GET TRANSACTION HISTORY (Immutable ledger log)
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

// BUY STORE PRODUCT DIRECTLY
router.post('/buy-product', authenticateToken, async (req, res) => {
  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({ error: 'Product ID is required for purchase' });
  }

  try {
    // 1. Fetch product
    const productResult = await db.query(
      'SELECT * FROM public.products WHERE id = $1',
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];
    const price = parseFloat(product.market_value);

    if (product.stock <= 0) {
      return res.status(400).json({ error: 'Product is out of stock' });
    }

    // 2. Fetch wallet (atomic check using transaction or logic)
    const walletResult = await db.query(
      'SELECT balance_credits FROM public.user_wallets WHERE user_id = $1',
      [req.user.id]
    );

    if (walletResult.rows.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletResult.rows[0];
    const balance = parseFloat(wallet.balance_credits);

    // Check overall funds
    if (balance < price) {
      return res.status(400).json({
        error: 'Insufficient funds.',
        requiredCredits: price,
        availableCredits: balance
      });
    }

    // 3. Process Ledger Transaction
    if (db.isMock) {
      // In mock DB, run the simulated updates directly
      await db.query(
        'UPDATE public.user_wallets SET balance_credits = balance_credits - $1 WHERE user_id = $2',
        [price, req.user.id]
      );
    } else {
      // Direct SQL transaction block for PostgreSQL
      await db.query('BEGIN');

      // Select for update lock
      await db.query(
        'SELECT balance_credits FROM public.user_wallets WHERE user_id = $1 FOR UPDATE',
        [req.user.id]
      );

      await db.query(
        'UPDATE public.user_wallets SET balance_credits = balance_credits - $1 WHERE user_id = $2',
        [price, req.user.id]
      );

      await db.query('COMMIT');
    }

    // 4. Log transaction in immutable log
    await db.query(
      'INSERT INTO public.credit_transactions (user_id, amount, type, reference_id) VALUES ($1, $2, $3, $4)',
      [req.user.id, -price, 'shop_purchase', productId]
    );

    // 5. Decrement stock
    await db.query(
      'UPDATE public.products SET stock = stock - 1 WHERE id = $1',
      [productId]
    );

    return res.json({
      success: true,
      message: `Purchase successful! Used ${price.toFixed(2)} credits.`,
      productTitle: product.title,
      price,
      newBalances: {
        balanceCredits: balance - price
      }
    });
  } catch (error) {
    if (!db.isMock) {
      await db.query('ROLLBACK');
    }
    console.error('Product purchase transaction error:', error);
    return res.status(500).json({ error: 'Purchase transaction failed: ' + error.message });
  }
});

module.exports = router;
