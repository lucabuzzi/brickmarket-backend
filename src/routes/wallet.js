const express = require('express');
const { authenticateToken } = require('./contest');
const walletController = require('../controllers/walletController');

const router = express.Router();

router.get('/balance', authenticateToken, walletController.getBalanceHandler);
router.get('/transactions', authenticateToken, walletController.getTransactionsHandler);
router.post('/create-topup-intent', authenticateToken, walletController.createTopupIntentHandler);
router.post('/confirm-topup', authenticateToken, walletController.confirmTopupHandler);
router.post('/buy-product', authenticateToken, walletController.buyProductHandler);
router.get('/payout-status', authenticateToken, walletController.getPayoutStatusHandler);
router.post('/convert', authenticateToken, walletController.convertHandler);

module.exports = router;
