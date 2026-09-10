const express = require('express');
const router = express.Router();
const { tcgTiersPublic } = require('../services/shipping');

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

module.exports = router;
