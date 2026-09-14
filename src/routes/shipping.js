const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const { tcgTiersPublic } = require('../services/shipping');
const shippingQuote = require('../services/shippingQuote');
const paymentsRepository = require('../repositories/paymentsRepository');
const userRepository = require('../repositories/userRepository');
const addressRepository = require('../repositories/addressRepository');
const { checkoutAddressSchema } = require('../validators/addressValidators');

router.get('/', (req, res) => {
  res.json({
    message: 'Per contrassegnare un ordine come spedito usa PATCH /api/orders/:orderId/ship (Bearer token venditore).',
  });
});

// Trading-card shipping tiers, for the cart's per-seller shipping selector.
// Eligibility (by card count + group value) is applied client-side for display
// and re-checked server-side at checkout.
router.get('/tcg-tiers', (req, res) => {
  res.json({ tiers: tcgTiersPublic() });
});

const quoteRequestSchema = Joi.object({
  itemIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  shippingAddress: checkoutAddressSchema.required(),
}).unknown(false);

// Live shipping-rate quote for ONE physical (non-TCG) shipping group — one
// call per seller × macro-category group the cart already computed
// client-side. Each returned option is persisted with its own short-lived
// token (see services/shippingQuote.js); the buyer picks one, and only that
// exact token/price is honored at checkout (create-cart-payment-intent).
router.post('/quote', auth, async (req, res) => {
  const { error, value } = quoteRequestSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const listings = await paymentsRepository.findActiveListingsByIds(value.itemIds);
    if (listings.length !== value.itemIds.length) {
      return res.status(400).json({ error: 'Uno o più articoli non sono più disponibili' });
    }
    const sellerIds = new Set(listings.map((l) => l.seller_id));
    if (sellerIds.size > 1) {
      return res.status(400).json({ error: 'Gli articoli di una quotazione devono appartenere allo stesso venditore' });
    }
    if (listings.some((l) => l.product_type === 'tcg')) {
      return res.status(400).json({ error: 'Le carte usano il sistema a scaglioni, non la quotazione dinamica' });
    }

    let buyerAddress;
    if (value.shippingAddress.addressId) {
      const saved = await addressRepository.findById(req.user.userId, value.shippingAddress.addressId);
      if (!saved) return res.status(400).json({ error: 'Indirizzo di spedizione non trovato' });
      buyerAddress = {
        fullName: saved.full_name, addressStreet: saved.address_street || saved.address,
        addressHouseNumber: saved.address_house_number, city: saved.city, zip: saved.zip,
        province: saved.province, country: saved.country, phone: saved.phone,
      };
    } else {
      const { addressId, ...fields } = value.shippingAddress;
      buyerAddress = fields;
    }

    const sellerId = [...sellerIds][0];
    const seller = await userRepository.findById(sellerId);

    const { options, expiresAt } = await shippingQuote.requestQuote({
      buyerId: req.user.userId,
      sellerId,
      items: listings,
      sellerAddress: shippingQuote.sellerAddressSnapshot(seller),
      buyerAddress,
    });

    res.json({ options, expiresAt });
  } catch (err) {
    console.error('shipping quote error:', err.message);
    res.status(500).json({ error: 'Errore nel calcolo della tariffa di spedizione' });
  }
});

module.exports = router;
