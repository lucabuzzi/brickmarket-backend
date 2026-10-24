// Admin orders: auto-confirmation, disputes, seller payouts, sales archive.
const express = require('express');
const { adminAuth } = require('../../../middleware/auth');
const c = require('./orders.controller');

const router = express.Router();

router.post('/orders/auto-confirm-now', adminAuth, c.autoConfirmNow);
router.get('/orders/disputed', adminAuth, c.disputed);
router.post('/orders/:id/dispute-resolution', adminAuth, c.resolveDispute);
router.get('/payouts', adminAuth, c.payouts);
router.post('/payouts/:orderId/mark-paid', adminAuth, c.markPaid);
router.post('/payouts/:orderId/unmark', adminAuth, c.unmark);
router.post('/payouts/:orderId/archive', adminAuth, c.archive);
router.get('/archive', adminAuth, c.salesArchive);

module.exports = router;
