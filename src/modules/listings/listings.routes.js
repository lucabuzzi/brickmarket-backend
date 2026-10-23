// /api/listings — paths and guards only. Order matters: the literal paths (/user/me, /archive, /search,
// /featured/tariffs) must stay above /:id.
const express = require('express');
const auth = require('../../middleware/auth');
const { upload } = require('../../services/cloudinary');
const c = require('./listings.controller');

const router = express.Router();

router.post('/', auth, c.create);
router.get('/user/me', auth, c.listOwn);
router.get('/', c.listPublic);
router.get('/archive', c.listArchive);
router.get('/search', c.search);

// "In evidenza": public tariff table, card payment, confirmation (the Stripe webhook can confirm too).
router.get('/featured/tariffs', c.listFeaturedTariffs);
router.post('/:id/feature', auth, c.startFeature);
router.post('/:id/confirm-feature', auth, c.confirmFeature);

// NOTE: cart checkout goes through a real Stripe PaymentIntent — see
// POST /api/payments/stripe/create-cart-payment-intent. A route here used to mark orders 'completed' and
// listings 'sold' with no payment at all; removed rather than left as a free-checkout backdoor.

router.get('/:id', c.getDetail);
router.patch('/:id', auth, upload.array('images', 10), c.update);
router.delete('/:id', auth, c.remove);
router.post('/:id/bid', auth, c.placeBid);

module.exports = router;
