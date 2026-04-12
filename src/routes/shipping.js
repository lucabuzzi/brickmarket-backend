const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Per contrassegnare un ordine come spedito usa PATCH /api/orders/:orderId/ship (Bearer token venditore).',
  });
});

module.exports = router;
