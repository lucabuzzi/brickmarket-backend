const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { adminAuth } = require('../middleware/auth');

/**
 * GET /api/admin/stats
 * Protected: Admin only (DB-backed role check).
 * Returns high-level platform statistics for the admin dashboard.
 */
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [usersRes, listingsRes, ordersRes, reviewsRes, catalogRes] = await Promise.all([
      query(`
        SELECT
          COUNT(*)::int                                                  AS total_users,
          COUNT(*) FILTER (WHERE role = 'admin')::int                   AS total_admins,
          COUNT(*) FILTER (WHERE role = 'seller' OR role = 'both')::int AS total_sellers,
          COUNT(*) FILTER (WHERE is_pro = true)::int                    AS total_pro,
          COUNT(*) FILTER (WHERE is_verified = true)::int               AS total_verified,
          COUNT(*) FILTER (WHERE is_active = false)::int                AS total_inactive,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_last_30d
        FROM users
      `),
      query(`
        SELECT
          COUNT(*)::int                                               AS total_listings,
          COUNT(*) FILTER (WHERE status = 'active')::int             AS active_listings,
          COUNT(*) FILTER (WHERE status = 'sold')::int               AS sold_listings,
          COUNT(*) FILTER (WHERE status = 'draft')::int              AS draft_listings,
          COUNT(*) FILTER (WHERE type = 'auction')::int              AS auction_listings
        FROM listings
      `),
      query(`
        SELECT
          COUNT(*)::int                                                  AS total_orders,
          COUNT(*) FILTER (WHERE status = 'completed')::int             AS completed_orders,
          COUNT(*) FILTER (WHERE status = 'pending_payment')::int       AS pending_orders,
          COUNT(*) FILTER (WHERE status = 'disputed')::int              AS disputed_orders,
          COALESCE(SUM(total_buyer) FILTER (WHERE status = 'completed'), 0)::numeric AS total_gmv
        FROM orders
      `),
      query(`
        SELECT
          COUNT(*)::int                              AS total_reviews,
          ROUND(AVG(rating)::numeric, 2)::numeric   AS platform_avg_rating
        FROM reviews
      `),
      query(`SELECT COUNT(*)::int as total_sets FROM master_sets`)
    ]);

    res.json({
      users:    usersRes.rows[0],
      listings: {
        ...listingsRes.rows[0],
        catalogTotal: catalogRes.rows[0].total_sets
      },
      orders:   ordersRes.rows[0],
      reviews:  reviewsRes.rows[0],
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('ADMIN STATS ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero delle statistiche admin.' });
  }
});

/**
 * GET /api/admin/users/detailed
 * Paginated list of users with complex CRM metrics.
 */
router.get('/users/detailed', adminAuth, async (req, res) => {
  const { page = 1, limit = 20, country, role } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  let queryParams = [];
  let paramCount = 1;

  if (country) {
    whereClause += ` AND address_country = $${paramCount}`;
    queryParams.push(country);
    paramCount++;
  }
  
  if (role) {
    whereClause += ` AND role = $${paramCount}`;
    queryParams.push(role);
    paramCount++;
  }

  try {
    const totalRes = await query(`SELECT COUNT(*) FROM users ${whereClause}`, queryParams);
    const totalUsers = parseInt(totalRes.rows[0].count, 10);

    const usersRes = await query(`
      SELECT 
        u.id, u.username, u.email, u.address_country, u.created_at, u.role, 
        u.is_pro, u.is_verified, u.is_active, u.rating_avg, u.sales_count, u.rating_count,
        (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id AND o.status = 'completed')::int as total_purchases,
        (SELECT COUNT(*) FROM orders o WHERE o.seller_id = u.id AND o.status = 'completed')::int as total_sales,
        (SELECT COUNT(*) FROM listings l WHERE l.seller_id = u.id AND l.type = 'auction')::int as auctions_created,
        (SELECT COUNT(*) FROM bids b WHERE b.bidder_id = u.id)::int as total_bids,
        (SELECT COUNT(*) FROM bids b WHERE b.bidder_id = u.id AND b.is_winning = true)::int as auctions_won
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `, [...queryParams, limit, offset]);

    // Geo-data aggregation for the heatmap (not paginated, across filtered dataset or all)
    const geoRes = await query(`
      SELECT address_country as country, COUNT(*)::int as user_count 
      FROM users 
      WHERE address_country IS NOT NULL
      GROUP BY address_country
    `);

    res.json({
      users: usersRes.rows,
      pagination: {
        total: totalUsers,
        page: parseInt(page, 10),
        pages: Math.ceil(totalUsers / limit)
      },
      geoData: geoRes.rows
    });

  } catch (err) {
    console.error('ADMIN USERS DETAILED ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero dei dati CRM utenti.' });
  }
});

/**
 * GET /api/admin/users/:id/history
 * Fetch a user's chronological timeline of bids, top-sold categories, and average bid price.
 */
router.get('/users/:id/history', adminAuth, async (req, res) => {
  const userId = req.params.id;
  try {
    const bidsHistoryRes = await query(`
      SELECT b.id, b.amount, b.is_winning, b.created_at, l.title as listing_title, l.id as listing_id
      FROM bids b
      JOIN listings l ON b.listing_id = l.id
      WHERE b.bidder_id = $1
      ORDER BY b.created_at DESC
      LIMIT 50
    `, [userId]);

    const topSoldRes = await query(`
      SELECT l.theme, COUNT(*)::int as sales_count
      FROM orders o
      JOIN listings l ON o.listing_id = l.id
      WHERE o.seller_id = $1 AND o.status = 'completed' AND l.theme IS NOT NULL
      GROUP BY l.theme
      ORDER BY sales_count DESC
      LIMIT 5
    `, [userId]);
    
    const avgBidRes = await query(`
      SELECT ROUND(AVG(amount)::numeric, 2)::numeric as avg_bid_amount
      FROM bids 
      WHERE bidder_id = $1
    `, [userId]);

    res.json({
      bids: bidsHistoryRes.rows,
      topCategories: topSoldRes.rows,
      avgBid: avgBidRes.rows[0]?.avg_bid_amount || 0
    });
  } catch (err) {
    console.error('ADMIN USER HISTORY ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero della history utente.' });
  }
});

/**
 * GET /api/admin/archive
 * Returns all non-active listings with sensitive transaction data (Buyer, Seller, Fees).
 */
router.get('/archive', adminAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        l.id, l.title, l.status, l.price as listing_price, l.updated_at as archived_at,
        o.id as order_id, o.buyer_id, o.seller_id, 
        ub.username as buyer_username, us.username as seller_username,
        o.shipping_cost, o.platform_fee, o.total_buyer, o.created_at as sale_date,
        o.selected_carrier
      FROM listings l
      LEFT JOIN orders o ON l.id = o.listing_id
      LEFT JOIN users ub ON o.buyer_id = ub.id
      LEFT JOIN users us ON l.seller_id = us.id
      WHERE l.status IN ('sold', 'expired', 'removed')
      ORDER BY l.updated_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('ADMIN ARCHIVE ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero dell\'archivio admin.' });
  }
});

/**
 * GET /api/admin/analytics/interactions
 * Returns a list of trading pairings (User A bought X times from User B).
 */
router.get('/analytics/interactions', adminAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ub.id as buyer_id, ub.username as buyer_username,
        us.id as seller_id, us.username as seller_username,
        COUNT(o.id)::int as trade_count,
        SUM(o.total_buyer)::numeric as total_volume
      FROM orders o
      JOIN users ub ON o.buyer_id = ub.id
      JOIN users us ON o.seller_id = us.id
      WHERE o.status = 'completed'
      GROUP BY ub.id, ub.username, us.id, us.username
      ORDER BY trade_count DESC, total_volume DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('ADMIN INTERACTIONS ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero delle interazioni.' });
  }
});

/**
 * POST /api/admin/listings/:id/restore
 * Reactivates an accidentally expired or removed item.
 */
router.post('/listings/:id/restore', adminAuth, async (req, res) => {
  const listingId = req.params.id;
  try {
    const result = await query(
      `UPDATE listings SET status = 'active', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [listingId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Annuncio non trovato.' });
    res.json({ success: true, listing: result.rows[0] });
  } catch (err) {
    console.error('ADMIN RESTORE ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel ripristino dell\'annuncio.' });
  }
});

module.exports = router;
