const express = require('express');
const router = express.Router();
const { query } = require('../db');
const auth = require('../middleware/auth');

// GET /api/notifications/unread
router.get('/unread', auth, async (req, res) => {
  try {
    const result = await query(
      `SELECT n.*, l.title as listing_title
       FROM notifications n
       JOIN listings l ON n.listing_id = l.id
       WHERE n.user_id = $1 AND n.is_read = FALSE
       ORDER BY n.created_at DESC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('NOTIFICATIONS UNREAD ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero delle notifiche' });
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', auth, async (req, res) => {
  try {
    if (req.params.id === 'all') {
      await query(
        `UPDATE notifications SET is_read = TRUE WHERE user_id = $1`,
        [req.user.userId]
      );
    } else {
      await query(
        `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.user.userId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('NOTIFICATIONS READ ERROR:', err.message);
    res.status(500).json({ error: 'Errore marcatura notifica' });
  }
});

module.exports = router;
