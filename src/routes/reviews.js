/**
 * Reviews API Routes
 *
 * POST /api/reviews           — Submit a review (auth required)
 * GET  /api/reviews/user/:id  — Get reviews for a user (public)
 * GET  /api/reviews/pending   — Get orders awaiting review from the current user (auth required)
 */
const express = require('express');
const router  = express.Router();
const { query } = require('../db');
const auth = require('../middleware/auth');

/* ─────────────────────────────────────────────
   POST /api/reviews
   Submit a rating + comment for a completed transaction.
   Security checks (all DB-enforced + code-enforced):
     1. Order must exist and be in 'completed' / 'confirmed' status.
     2. Reviewer must be either buyer or seller on that order.
     3. Reviewer cannot review themselves (buyer_id ≠ seller_id is guaranteed
        by the order itself, but we double-check here).
     4. One review per (order_id, reviewer_id) — enforced by UNIQUE constraint.
───────────────────────────────────────────── */
router.post('/', auth, async (req, res) => {
  const reviewerId = req.user.userId;
  const { order_id, rating, comment } = req.body;

  // --- Input validation ---
  if (!order_id || !rating) {
    return res.status(400).json({ error: 'order_id e rating sono obbligatori.' });
  }
  const ratingNum = parseInt(rating, 10);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Il voto deve essere tra 1 e 5.' });
  }
  if (comment && comment.length > 1000) {
    return res.status(400).json({ error: 'Il commento non può superare 1000 caratteri.' });
  }

  try {
    // --- Fetch the order ---
    const orderRes = await query(
      `SELECT o.id, o.buyer_id, o.seller_id, o.status, l.title AS listing_title
       FROM orders o
       JOIN listings l ON l.id = o.listing_id
       WHERE o.id = $1`,
      [order_id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ordine non trovato.' });
    }

    const order = orderRes.rows[0];

    // --- Guard: order must be in a reviewable state ---
    const reviewableStatuses = ['confirmed', 'completed'];
    if (!reviewableStatuses.includes(order.status)) {
      return res.status(403).json({
        error: 'Puoi lasciare una recensione solo dopo che la transazione è stata completata.',
      });
    }

    // --- Guard: reviewer must be a party to this order ---
    const isBuyer  = order.buyer_id  === reviewerId;
    const isSeller = order.seller_id === reviewerId;
    if (!isBuyer && !isSeller) {
      return res.status(403).json({ error: 'Non sei parte di questa transazione.' });
    }

    // --- Determine who is being reviewed ---
    const reviewedId = isBuyer ? order.seller_id : order.buyer_id;

    // --- Guard: cannot review yourself (belt-and-suspenders) ---
    if (reviewedId === reviewerId) {
      return res.status(403).json({ error: 'Non puoi recensire te stesso.' });
    }

    // --- Insert (UNIQUE constraint on order_id + reviewer_id prevents duplicates) ---
    const insertRes = await query(
      `INSERT INTO reviews (order_id, reviewer_id, reviewed_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, rating, comment, created_at`,
      [order_id, reviewerId, reviewedId, ratingNum, comment?.trim() || null]
    );

    // rating_avg and rating_count are updated automatically via DB trigger

    return res.status(201).json({
      message: 'Recensione inviata con successo!',
      review: insertRes.rows[0],
    });

  } catch (err) {
    // PostgreSQL unique violation = duplicate review
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Hai già lasciato una recensione per questa transazione.' });
    }
    console.error('[Reviews POST] Error:', err.message);
    return res.status(500).json({ error: 'Errore interno durante l\'invio della recensione.' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/reviews/user/:userId
   Fetch the most recent 20 reviews received by a user (public).
   Joins reviewer username + avatar, and the listing title for context.
───────────────────────────────────────────── */
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await query(
      `SELECT
         r.id,
         r.rating,
         r.comment,
         r.created_at,
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
       LIMIT 20`,
      [userId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('[Reviews GET user] Error:', err.message);
    return res.status(500).json({ error: 'Errore nel recupero delle recensioni.' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/reviews/pending
   Returns orders the current user can still review
   (completed/confirmed, where they haven't reviewed yet).
   Used to trigger the feedback modal on the frontend.
───────────────────────────────────────────── */
router.get('/pending', auth, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await query(
      `SELECT
         o.id          AS order_id,
         o.status,
         o.created_at,
         l.title       AS listing_title,
         l.set_number,
         l.images,
         -- The person the current user would review
         CASE WHEN o.buyer_id = $1 THEN s.username ELSE b.username END AS counterpart_username,
         CASE WHEN o.buyer_id = $1 THEN s.avatar_url ELSE b.avatar_url END AS counterpart_avatar,
         CASE WHEN o.buyer_id = $1 THEN o.seller_id ELSE o.buyer_id END AS counterpart_id,
         CASE WHEN o.buyer_id = $1 THEN 'buyer' ELSE 'seller' END AS my_role
       FROM orders o
       JOIN listings l ON l.id = o.listing_id
       JOIN users    b ON b.id = o.buyer_id
       JOIN users    s ON s.id = o.seller_id
       WHERE (o.buyer_id = $1 OR o.seller_id = $1)
         AND o.status IN ('confirmed', 'completed')
         -- Not already reviewed by this user
         AND NOT EXISTS (
           SELECT 1 FROM reviews r
           WHERE r.order_id = o.id
             AND r.reviewer_id = $1
         )
       ORDER BY o.updated_at DESC
       LIMIT 10`,
      [userId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error('[Reviews GET pending] Error:', err.message);
    return res.status(500).json({ error: 'Errore nel recupero delle recensioni in sospeso.' });
  }
});

module.exports = router;
