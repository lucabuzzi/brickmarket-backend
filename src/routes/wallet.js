const express = require('express');
const { authenticateToken } = require('./contest');
const walletController = require('../controllers/walletController');
const creditConfigRepository = require('../repositories/creditConfigRepository');

const router = express.Router();

// Public and read-only: the numbers the credits page shows (bonus amounts, maturation period, minimum order).
// Only this whitelist is exposed: daily/monthly caps and every other anti-abuse value stay private.
const PUBLIC_RULE_KEYS = ['signup_bonus', 'referral_bonus', 'sale_bonus', 'purchase_bonus', 'maturation_days', 'min_order_amount'];
router.get('/rules', async (req, res) => {
  try {
    const all = await creditConfigRepository.getAll();
    const rules = {};
    for (const { key, value } of all) if (PUBLIC_RULE_KEYS.includes(key)) rules[key] = value;
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ rules });
  } catch (err) {
    console.error('GET /api/wallet/rules:', err.message);
    return res.status(500).json({ error: 'Impossibile recuperare le regole dei crediti.' });
  }
});

router.get('/balance', authenticateToken, walletController.getBalanceHandler);
router.get('/transactions', authenticateToken, walletController.getTransactionsHandler);
router.post('/buy-product', authenticateToken, walletController.buyProductHandler);

module.exports = router;
module.exports.PUBLIC_RULE_KEYS = PUBLIC_RULE_KEYS;
