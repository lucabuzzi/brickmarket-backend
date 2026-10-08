const express = require('express');
const router = express.Router();
const { query } = require('../db');
const auth = require('../middleware/auth');

// GET /api/notifications/unread-count
// Cheap poll target for the bell badge — just a count, not the rows.
router.get('/unread-count', auth, async (req, res) => {
  try {
    const result = await query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.userId]
    );
    res.json({ count: result.rows[0].count });
  } catch (err) {
    console.error('NOTIFICATIONS UNREAD COUNT ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel conteggio delle notifiche' });
  }
});

// GET /api/notifications?limit=&offset=
// Full history (read + unread), newest first — backs both the bell dropdown
// (small limit) and the dedicated /notifications page (paginated).
router.get('/', auth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = parseInt(req.query.offset, 10) || 0;
  try {
    const result = await query(
      `SELECT n.*, l.title as listing_title
       FROM notifications n
       LEFT JOIN listings l ON n.listing_id = l.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.userId, limit, offset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('NOTIFICATIONS LIST ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero delle notifiche' });
  }
});

// POST /api/notifications/:id/read  (id === 'all' marks every notification read)
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
