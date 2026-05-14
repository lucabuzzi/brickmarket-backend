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
      `SELECT o.*, l.title AS listing_title, l.images AS listing_images, f.id AS feedback_id
       FROM orders o
       LEFT JOIN listings l ON l.id = o.listing_id
       LEFT JOIN feedbacks f ON f.order_id = o.id
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

router.post('/:id/feedback', auth, async (req, res) => {
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Il rating deve essere tra 1 e 5' });
  }

  try {
    const orderRes = await query(`SELECT buyer_id, seller_id FROM orders WHERE id = $1`, [req.params.id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Ordine non trovato' });
    const order = orderRes.rows[0];

    if (order.buyer_id !== req.user.userId) {
      return res.status(403).json({ error: "Solo l'acquirente puo lasciare feedback" });
    }

    await query(
      `INSERT INTO feedbacks (order_id, buyer_id, seller_id, rating, comment) VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, req.user.userId, order.seller_id, rating, comment || null]
    );

    await query(
      `UPDATE users
       SET rating_average = (SELECT AVG(rating) FROM feedbacks WHERE seller_id = $1),
           rating_count = (SELECT COUNT(*) FROM feedbacks WHERE seller_id = $1)
       WHERE id = $1`,
      [order.seller_id]
    );

    res.json({ success: true });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Feedback gia lasciato per questo ordine' });
    console.error('feedback error:', err);
    res.status(500).json({ error: 'Errore salvataggio feedback' });
  }
});

module.exports = router;
