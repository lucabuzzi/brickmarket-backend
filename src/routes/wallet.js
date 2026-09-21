const express = require('express');
const { authenticateToken } = require('./contest');
const walletController = require('../controllers/walletController');

const router = express.Router();

router.get('/balance', authenticateToken, walletController.getBalanceHandler);
router.get('/transactions', authenticateToken, walletController.getTransactionsHandler);
router.post('/buy-product', authenticateToken, walletController.buyProductHandler);

module.exports = router;
