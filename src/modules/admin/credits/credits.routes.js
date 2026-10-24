// Admin credit system: ledger, configurable values, bonus grants under review.
const express = require('express');
const { adminAuth } = require('../../../middleware/auth');
const c = require('./credits.controller');

const router = express.Router();

router.get('/wallet/transactions', adminAuth, c.ledger);
router.get('/credit-config', adminAuth, c.config);
router.put('/credit-config/:key', adminAuth, c.setConfig);
router.post('/credit-bonus-grants/mature-now', adminAuth, c.matureNow);
router.get('/credit-bonus-grants/flagged', adminAuth, c.flaggedGrants);
router.post('/credit-bonus-grants/:id/review', adminAuth, c.reviewGrant);

module.exports = router;
