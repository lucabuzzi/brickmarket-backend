const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const cartController = require('../controllers/cartController');

router.get('/', auth, cartController.getCartHandler);
router.post('/', auth, cartController.addItemHandler);
router.delete('/:listingId', auth, cartController.removeItemHandler);
router.delete('/', auth, cartController.clearCartHandler);

module.exports = router;
