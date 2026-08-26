const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { adminAuth } = require('../middleware/auth');

/**
 * Badges whose manual grant/revoke also has to flip a legacy `users` boolean column, since
 * dozens of existing read paths (listings, profile, ListingCard, ...) still read is_pro/
 * is_verified directly rather than joining user_badges. Any future badge NOT in this map just
 * lives in user_badges with no column to keep in sync — that's the extensibility win.
 */
const LEGACY_COLUMN_SYNC = {
  pro: 'is_pro',
  verified: 'is_verified',
};

function computeLegendary(user) {
  const ratingAvg = parseFloat(user?.rating_avg || 0);
  const salesCount = parseInt(user?.sales_count || 0, 10);
  return ratingAvg >= 4.8 && salesCount >= 10;
}

/**
 * GET /api/admin/badges
 * Full badge catalog (manual + automatic), for populating the admin assignment UI.
 */
router.get('/badges', adminAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM badges ORDER BY sort_order ASC, label ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('ADMIN BADGES CATALOG ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero del catalogo badge.' });
  }
});

/**
 * GET /api/admin/users/:id/badges
 * Manually-assigned badges (with who/when/note) plus the live status of automatic badges
 * (currently just "legendary") so admins can see the full picture in one place.
 */
router.get('/users/:id/badges', adminAuth, async (req, res) => {
  try {
    const userRes = await query('SELECT id, rating_avg, sales_count FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Utente non trovato.' });

    const manualRes = await query(
      `SELECT ub.badge_key, ub.awarded_at, ub.note, b.label, b.color, b.description,
              a.username AS awarded_by_username
       FROM user_badges ub
       JOIN badges b ON b.key = ub.badge_key
       LEFT JOIN users a ON a.id = ub.awarded_by
       WHERE ub.user_id = $1
       ORDER BY ub.awarded_at DESC`,
      [req.params.id]
    );

    res.json({
      manual: manualRes.rows,
      automatic: [
        {
          key: 'legendary',
          label: 'Legendary',
          color: '#10b981',
          active: computeLegendary(userRes.rows[0]),
        },
      ],
    });
  } catch (err) {
    console.error('ADMIN USER BADGES ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero dei badge utente.' });
  }
});

/**
 * POST /api/admin/users/:id/badges
 * Body: { badgeKey, note? }
 * Assigns (or re-assigns, refreshing the note/timestamp) a manual badge to a user.
 */
router.post('/users/:id/badges', adminAuth, async (req, res) => {
  const { badgeKey, note } = req.body || {};
  if (!badgeKey) return res.status(400).json({ error: 'badgeKey obbligatorio.' });

  try {
    const badgeRes = await query('SELECT * FROM badges WHERE key = $1', [badgeKey]);
    if (badgeRes.rows.length === 0) return res.status(404).json({ error: 'Badge non trovato.' });
    if (!badgeRes.rows[0].is_manual) {
      return res.status(400).json({ error: 'Questo badge è automatico e non può essere assegnato manualmente.' });
    }

    const userRes = await query('SELECT id, username FROM users WHERE id = $1', [req.params.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Utente non trovato.' });

    await query(
      `INSERT INTO user_badges (user_id, badge_key, awarded_by, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, badge_key)
       DO UPDATE SET awarded_by = EXCLUDED.awarded_by, awarded_at = NOW(), note = EXCLUDED.note`,
      [req.params.id, badgeKey, req.user.userId, note || null]
    );

    const legacyColumn = LEGACY_COLUMN_SYNC[badgeKey];
    if (legacyColumn) {
      await query(`UPDATE users SET ${legacyColumn} = true, updated_at = NOW() WHERE id = $1`, [req.params.id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('ADMIN BADGE ASSIGN ERROR:', err.message);
    res.status(500).json({ error: 'Errore nell\'assegnazione del badge.' });
  }
});

/**
 * DELETE /api/admin/users/:id/badges/:badgeKey
 * Revokes a manually-assigned badge.
 */
router.delete('/users/:id/badges/:badgeKey', adminAuth, async (req, res) => {
  const { badgeKey } = req.params;
  try {
    const result = await query(
      'DELETE FROM user_badges WHERE user_id = $1 AND badge_key = $2 RETURNING id',
      [req.params.id, badgeKey]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'L\'utente non ha questo badge.' });
    }

    const legacyColumn = LEGACY_COLUMN_SYNC[badgeKey];
    if (legacyColumn) {
      await query(`UPDATE users SET ${legacyColumn} = false, updated_at = NOW() WHERE id = $1`, [req.params.id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('ADMIN BADGE REVOKE ERROR:', err.message);
    res.status(500).json({ error: 'Errore nella revoca del badge.' });
  }
});

module.exports = router;
