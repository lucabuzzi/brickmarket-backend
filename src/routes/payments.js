const express = require('express');
const authMiddleware = require('../middleware/auth');
const paymentsController = require('../controllers/paymentsController');

const router = express.Router();

// ─── STRIPE ──────────────────────────────────────────────────────────────────

router.post('/stripe/onboard-seller', authMiddleware, paymentsController.onboardSellerHandler);
router.post('/stripe/create-payment-intent', authMiddleware, paymentsController.createPaymentIntentHandler);
router.post('/stripe/create-cart-payment-intent', authMiddleware, paymentsController.createCartPaymentIntentHandler);
router.post('/confirm-delivery/:orderId', authMiddleware, paymentsController.confirmDeliveryHandler);

// ─── PAYPAL ──────────────────────────────────────────────────────────────────

router.post('/paypal/create-order', authMiddleware, paymentsController.paypalCreateOrderHandler);
router.post('/paypal/capture/:paypalOrderId', authMiddleware, paymentsController.paypalCaptureHandler);

module.exports = { router, webhook: paymentsController.webhookHandler };
