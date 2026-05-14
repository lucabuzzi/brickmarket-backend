const express = require('express');
const router = express.Router();
const { query } = require('../db');
const auth = require('../middleware/auth');

/**
 * GET /api/users/list
 * Returns a public directory of users, grouped by country for the frontend.
 * We return a flat list and let the frontend do the clustering for maximum flexibility.
 */
router.get('/list', async (req, res) => {
  try {
    const result = await query(
      `SELECT username, avatar_url, rating_avg, rating_count, address_country as country, city, is_verified, is_pro
       FROM users
       WHERE address_country IS NOT NULL
       ORDER BY address_country ASC, rating_avg DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('USER LIST ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero della directory utenti' });
  }
});

/**
 * GET /api/users/profile/:username
 * Returns full public profile data for a specific user.
 */
router.get('/profile/:username', async (req, res) => {
  const { username } = req.params;
  try {
    // 1. Fetch user data (expose id so frontend can call /api/reviews/user/:id)
    const userRes = await query(
      `SELECT id, username, avatar_url, rating_avg, rating_count, address_country, city,
              is_verified, is_pro, bio, created_at
       FROM users
       WHERE username = $1`,
      [username]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const user = userRes.rows[0];

    // 2. Fetch user listings (Active & Sold)
    const listingsRes = await query(
      `SELECT id, title, price, status, images, condition, set_number
       FROM listings
       WHERE seller_id = $1
       AND status IN ('active', 'sold')
       ORDER BY created_at DESC`,
      [user.id]
    );

    const listings = {
      active: listingsRes.rows.filter(l => l.status === 'active'),
      sold:   listingsRes.rows.filter(l => l.status === 'sold'),
    };

    // 3. Fetch recent reviews (5 most recent, for the profile tab preview)
    const reviewsRes = await query(
      `SELECT
         r.id, r.rating, r.comment, r.created_at,
         u.username   AS reviewer_username,
         u.avatar_url AS reviewer_avatar,
         l.title      AS listing_title,
         l.set_number AS listing_set_number
       FROM reviews r
       JOIN users    u ON u.id = r.reviewer_id
       JOIN orders   o ON o.id = r.order_id
       JOIN listings l ON l.id = o.listing_id
       WHERE r.reviewed_id = $1
       ORDER BY r.created_at DESC
       LIMIT 5`,
      [user.id]
    );

    res.json({ user, listings, reviews: reviewsRes.rows });
  } catch (err) {
    console.error('USER PROFILE ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero del profilo' });
  }
});

/**
 * GET /api/users/bids/me
 * Returns all listings where the user has placed at least one bid.
 */
router.get('/bids/me', auth, async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT l.*, 
        (SELECT bidder_id FROM bids WHERE listing_id = l.id ORDER BY amount DESC, created_at ASC LIMIT 1) as current_highest_bidder_id
       FROM listings l
       JOIN bids b ON l.id = b.listing_id
       WHERE b.bidder_id = $1
       ORDER BY l.auction_end DESC`,
      [req.user.userId]
    );

    const formatted = result.rows.map(row => {
      let isEnded = false;
      if (row.auction_end && new Date(row.auction_end) < new Date()) {
        isEnded = true;
      }

      let bidStatus = 'outbid'; // default
      if (row.current_highest_bidder_id === req.user.userId) {
        bidStatus = isEnded ? 'won' : 'winning';
      } else {
        bidStatus = isEnded ? 'lost' : 'outbid';
      }

      return {
        ...row,
        bidStatus
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('BIDS PROFILE ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero delle tue offerte' });
  }
});

module.exports = router;
