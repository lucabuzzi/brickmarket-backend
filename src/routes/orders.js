const express = require('express');
const router = express.Router();
const { query } = require('../db');
const auth = require('../middleware/auth');
const Joi = require('joi');

const shipSchema = Joi.object({
  trackingNumber: Joi.string().min(3).max(100).required(),
  carrier: Joi.string().min(2).max(50).required(),
});

// Lista ordini per utente corrente (?role=buyer | seller, default buyer)
router.get('/me', auth, async (req, res) => {
  const asSeller = req.query.role === 'seller';
  const col = asSeller ? 'seller_id' : 'buyer_id';
  try {
    const result = await query(
      `SELECT o.*, l.title AS listing_title, l.images AS listing_images
       FROM orders o
       LEFT JOIN listings l ON l.id = o.listing_id
       WHERE o.${col} = $1
       ORDER BY o.created_at DESC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('orders/me:', err.message);
    res.status(500).json({ error: 'Errore nel recupero ordini' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const result = await query(
      `SELECT o.*, l.title AS listing_title, l.images AS listing_images
       FROM orders o
       LEFT JOIN listings l ON l.id = o.listing_id
       WHERE o.id = $1 AND (o.buyer_id = $2 OR o.seller_id = $2)`,
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ordine non trovato' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('orders/:id:', err.message);
    res.status(500).json({ error: 'Errore nel recupero ordine' });
  }
});

// Venditore: segna spedito (dopo pagamento ricevuto)
router.patch('/:id/ship', auth, async (req, res) => {
  const { error, value } = shipSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const result = await query(
      `UPDATE orders SET
        status = 'shipped',
        tracking_number = $1,
        carrier = $2,
        shipped_at = NOW(),
        updated_at = NOW()
       WHERE id = $3 AND seller_id = $4
         AND status IN ('payment_received', 'preparing')
       RETURNING *`,
      [value.trackingNumber, value.carrier, req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Ordine non trovato, non sei il venditore, o stato non valido per la spedizione',
      });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('ship:', err.message);
    res.status(500).json({ error: 'Errore aggiornamento spedizione' });
  }
});

module.exports = router;
