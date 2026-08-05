const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { adminAuth } = require('../middleware/auth');
const { computeDaySnapshot, backfillSnapshots } = require('../services/analyticsSnapshot');

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
        u.seller_type, u.company_name,
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
 * GET /api/admin/users
 * Simple, focused list of every registered user with their current wallet
 * balance (LEFT JOIN so users who have never touched ClutchVault still show
 * up, with a null/zero balance) — distinct from /users/detailed's heavier
 * marketplace CRM stats (ratings, sales, bids), which this intentionally
 * does not duplicate. Supports ?search= (username/email) and pagination.
 */
router.get('/users', adminAuth, async (req, res) => {
  const { search } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const params = [];
    let whereClause = '';
    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE u.username ILIKE $${params.length} OR u.email ILIKE $${params.length}`;
    }

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const result = await query(`
      SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at,
             w.balance_credits, w.updated_at AS wallet_updated_at
      FROM users u
      LEFT JOIN public.user_wallets w ON w.user_id = u.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, params);

    const countResult = await query(`SELECT COUNT(*)::int AS total FROM users u ${whereClause}`, search ? [`%${search}%`] : []);

    res.json({
      users: result.rows.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        isActive: u.is_active,
        createdAt: u.created_at,
        balanceCredits: u.balance_credits !== null ? parseFloat(u.balance_credits) : null,
        walletUpdatedAt: u.wallet_updated_at
      })),
      total: countResult.rows[0]?.total || 0,
      limit,
      offset
    });
  } catch (err) {
    console.error('ADMIN USERS LIST ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero dell\'elenco utenti.' });
  }
});

/**
 * GET /api/admin/wallet/transactions
 * Full, append-only ledger of every ClutchVault credit transaction across every user
 * (deposits, contest entries/refunds, shop purchases, payouts) — the audit trail the
 * in-memory mock DB could never provide, since it lived only in process RAM.
 * Optional ?userId= to filter to a single account, ?limit=/?offset= to paginate.
 */
router.get('/wallet/transactions', adminAuth, async (req, res) => {
  const { userId } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const params = [];
    let whereClause = '';
    if (userId) {
      params.push(userId);
      whereClause = `WHERE ct.user_id = $${params.length}`;
    }

    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const result = await query(`
      SELECT ct.id, ct.user_id, u.username, u.email, ct.amount, ct.type, ct.reference_id, ct.created_at,
             w.balance_credits AS current_balance
      FROM public.credit_transactions ct
      JOIN users u ON u.id = ct.user_id
      LEFT JOIN public.user_wallets w ON w.user_id = ct.user_id
      ${whereClause}
      ORDER BY ct.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, params);

    const countResult = await query(`
      SELECT COUNT(*)::int AS total FROM public.credit_transactions ct ${whereClause}
    `, userId ? [userId] : []);

    res.json({
      transactions: result.rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        email: r.email,
        amount: parseFloat(r.amount),
        type: r.type,
        referenceId: r.reference_id,
        createdAt: r.created_at,
        currentBalance: r.current_balance !== null ? parseFloat(r.current_balance) : null
      })),
      total: countResult.rows[0]?.total || 0,
      limit,
      offset
    });
  } catch (err) {
    console.error('ADMIN WALLET TRANSACTIONS ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero dello storico transazioni wallet.' });
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
 * GET /api/admin/analytics/overview
 * Returns visitor/session/pageview KPIs, the registration funnel, and a daily visits series.
 */
router.get('/analytics/overview', adminAuth, async (req, res) => {
  try {
    const [visitorsRes, sessionsRes, pageviewsRes, topPathsRes, registrationsRes, funnelRes, dailyRes, geoRes, authFunnelRes] = await Promise.all([
      query(`
        SELECT
          COUNT(DISTINCT visitor_id) FILTER (WHERE started_at >= CURRENT_DATE)::int AS today,
          COUNT(DISTINCT visitor_id) FILTER (WHERE started_at >= NOW() - INTERVAL '7 days')::int AS last_7d,
          COUNT(DISTINCT visitor_id) FILTER (WHERE started_at >= NOW() - INTERVAL '30 days')::int AS last_30d
        FROM analytics_sessions
      `),
      query(`
        SELECT
          COUNT(*) FILTER (WHERE started_at >= CURRENT_DATE)::int AS today,
          COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '7 days')::int AS last_7d,
          COALESCE(ROUND(AVG(duration_seconds) FILTER (WHERE started_at >= NOW() - INTERVAL '7 days')), 0)::int AS avg_duration_seconds
        FROM analytics_sessions
      `),
      query(`
        SELECT
          COUNT(*) FILTER (WHERE viewed_at >= CURRENT_DATE)::int AS today,
          COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days')::int AS last_7d
        FROM analytics_pageviews
      `),
      query(`
        SELECT path, COUNT(*)::int AS count
        FROM analytics_pageviews
        WHERE viewed_at >= NOW() - INTERVAL '7 days'
        GROUP BY path
        ORDER BY count DESC
        LIMIT 10
      `),
      query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS today,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last_7d
        FROM users
      `),
      query(`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'registration_started')::int AS started,
          COUNT(*) FILTER (WHERE event_type = 'registration_completed')::int AS completed
        FROM analytics_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `),
      query(`
        SELECT
          d.date,
          COALESCE(v.visitors, 0)::int AS visitors,
          COALESCE(pv.pageviews, 0)::int AS pageviews
        FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS d(date)
        LEFT JOIN (
          SELECT date_trunc('day', started_at)::date AS date, COUNT(DISTINCT visitor_id) AS visitors
          FROM analytics_sessions
          WHERE started_at >= NOW() - INTERVAL '14 days'
          GROUP BY 1
        ) v ON v.date = d.date::date
        LEFT JOIN (
          SELECT date_trunc('day', viewed_at)::date AS date, COUNT(*) AS pageviews
          FROM analytics_pageviews
          WHERE viewed_at >= NOW() - INTERVAL '14 days'
          GROUP BY 1
        ) pv ON pv.date = d.date::date
        ORDER BY d.date ASC
      `),
      query(`
        SELECT
          COALESCE(country, '??') AS country,
          COUNT(DISTINCT visitor_id)::int AS visitors
        FROM analytics_sessions
        WHERE started_at >= NOW() - INTERVAL '30 days'
        GROUP BY country
        ORDER BY visitors DESC
        LIMIT 15
      `),
      query(`
        WITH visited AS (
          SELECT DISTINCT visitor_id
          FROM analytics_sessions
          WHERE started_at >= NOW() - INTERVAL '30 days'
        ),
        authenticated AS (
          SELECT DISTINCT visitor_id
          FROM analytics_events
          WHERE event_type IN ('login', 'registration_completed')
            AND created_at >= NOW() - INTERVAL '30 days'
        )
        SELECT
          (SELECT COUNT(*) FROM visited)::int AS total_visitors,
          (SELECT COUNT(*) FROM visited v JOIN authenticated a ON a.visitor_id = v.visitor_id)::int AS authenticated_visitors
      `),
    ]);

    const started = funnelRes.rows[0].started;
    const completed = funnelRes.rows[0].completed;

    const totalVisitors = authFunnelRes.rows[0].total_visitors;
    const authenticatedVisitors = authFunnelRes.rows[0].authenticated_visitors;
    const bouncedVisitors = totalVisitors - authenticatedVisitors;

    res.json({
      visitors: visitorsRes.rows[0],
      sessions: sessionsRes.rows[0],
      pageviews: { ...pageviewsRes.rows[0], top_paths: topPathsRes.rows },
      registrations: registrationsRes.rows[0],
      funnel: {
        started,
        completed,
        conversion_rate: started > 0 ? Math.round((completed / started) * 1000) / 10 : 0
      },
      geo: {
        countries: geoRes.rows,
      },
      auth_funnel: {
        total_visitors: totalVisitors,
        authenticated_visitors: authenticatedVisitors,
        bounced_visitors: bouncedVisitors,
        authentication_rate: totalVisitors > 0 ? Math.round((authenticatedVisitors / totalVisitors) * 1000) / 10 : 0
      },
      daily_series: dailyRes.rows,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('ADMIN ANALYTICS ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero delle statistiche di analytics.' });
  }
});

/**
 * GET /api/admin/analytics/sessions
 * Recent visitor sessions with pageview counts, joined with users when identifiable.
 */
router.get('/analytics/sessions', adminAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  try {
    const result = await query(`
      SELECT
        s.id, s.visitor_id, s.user_id, u.username, s.entry_path,
        s.started_at, s.last_seen_at, s.duration_seconds,
        (SELECT COUNT(*) FROM analytics_pageviews p WHERE p.session_id = s.id)::int AS pageview_count
      FROM analytics_sessions s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.started_at DESC
      LIMIT $1
    `, [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error('ADMIN ANALYTICS SESSIONS ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero delle sessioni.' });
  }
});

/**
 * GET /api/admin/analytics/behavior
 * Per-page average dwell time (derived from consecutive pageview timestamps) and
 * the most-clicked interactive elements (overall and per page), last 30 days.
 */
router.get('/analytics/behavior', adminAuth, async (req, res) => {
  try {
    const [pagesRes, clicksRes, clicksByPageRes] = await Promise.all([
      query(`
        WITH page_durations AS (
          SELECT
            p.path,
            COALESCE(
              LEAD(p.viewed_at) OVER (PARTITION BY p.session_id ORDER BY p.viewed_at),
              s.last_seen_at
            ) AS next_ts,
            p.viewed_at
          FROM analytics_pageviews p
          JOIN analytics_sessions s ON s.id = p.session_id
          WHERE p.viewed_at >= NOW() - INTERVAL '30 days'
        )
        SELECT
          path,
          COUNT(*)::int AS views,
          ROUND(AVG(LEAST(EXTRACT(EPOCH FROM (next_ts - viewed_at)), 1800)))::int AS avg_duration_seconds
        FROM page_durations
        WHERE next_ts > viewed_at
        GROUP BY path
        ORDER BY views DESC
        LIMIT 20
      `),
      query(`
        SELECT target_label, target_type, target_href, COUNT(*)::int AS count
        FROM analytics_clicks
        WHERE created_at >= NOW() - INTERVAL '30 days' AND target_label IS NOT NULL AND target_label <> ''
        GROUP BY target_label, target_type, target_href
        ORDER BY count DESC
        LIMIT 20
      `),
      query(`
        SELECT path, target_label, COUNT(*)::int AS count
        FROM analytics_clicks
        WHERE created_at >= NOW() - INTERVAL '30 days' AND target_label IS NOT NULL AND target_label <> ''
        GROUP BY path, target_label
        ORDER BY count DESC
        LIMIT 20
      `),
    ]);

    res.json({
      top_pages_by_time: pagesRes.rows,
      top_clicks: clicksRes.rows,
      top_clicks_by_page: clicksByPageRes.rows,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('ADMIN ANALYTICS BEHAVIOR ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero del comportamento utenti.' });
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

/**
 * GET /api/admin/analytics/calendar?year=2026&month=7
 * Per-day summary for a calendar month, for the historical calendar view.
 * Reads from analytics_daily_snapshots (fast, pre-computed) for past days,
 * and computes "today" on the fly since it has no stored snapshot yet.
 */
router.get('/analytics/calendar', adminAuth, async (req, res) => {
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10); // 1-12
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Parametri year/month non validi.' });
  }

  try {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

    const result = await query(
      `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date, visitors, sessions, avg_duration_seconds, pageviews,
              new_registrations, logins, bounced_visitors
       FROM analytics_daily_snapshots
       WHERE date >= $1::date AND date < ($1::date + INTERVAL '1 month')
       ORDER BY date ASC`,
      [monthStart]
    );

    const days = result.rows;

    // If "today" falls within the requested month and has no stored snapshot
    // yet (it never does — snapshots are only saved for completed days),
    // append a live-computed entry so the current day isn't blank on the calendar.
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const isCurrentMonth = today.getUTCFullYear() === year && (today.getUTCMonth() + 1) === month;
    if (isCurrentMonth && !days.some(d => d.date === todayStr)) {
      const todaySnapshot = await computeDaySnapshot(todayStr);
      days.push(todaySnapshot);
    }

    res.json({ year, month, days });
  } catch (err) {
    console.error('ADMIN ANALYTICS CALENDAR ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero del calendario analytics.' });
  }
});

/**
 * GET /api/admin/analytics/day?date=2026-07-15
 * Full detail for a single day (used by the calendar's day-detail panel).
 */
router.get('/analytics/day', adminAuth, async (req, res) => {
  const date = req.query.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return res.status(400).json({ error: 'Parametro date non valido (atteso YYYY-MM-DD).' });
  }

  try {
    const stored = await query(
      `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date, visitors, sessions, avg_duration_seconds,
              pageviews, new_registrations, logins, bounced_visitors, countries
       FROM analytics_daily_snapshots WHERE date = $1`,
      [date]
    );
    if (stored.rows.length > 0) {
      return res.json(stored.rows[0]);
    }
    // No stored snapshot (e.g. today, or a day not yet backfilled) — compute live.
    const snapshot = await computeDaySnapshot(date);
    res.json(snapshot);
  } catch (err) {
    console.error('ADMIN ANALYTICS DAY ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero dei dati del giorno.' });
  }
});

/**
 * POST /api/admin/analytics/snapshot/backfill
 * Body: { fromDate: 'YYYY-MM-DD' }
 * Manually (re)computes daily snapshots from fromDate through yesterday.
 * Idempotent — safe to re-run. Mainly useful right after enabling the
 * calendar feature, or to recover from any gap (e.g. server downtime).
 */
router.post('/analytics/snapshot/backfill', adminAuth, async (req, res) => {
  const { fromDate } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate || '')) {
    return res.status(400).json({ error: 'Parametro fromDate non valido (atteso YYYY-MM-DD).' });
  }

  try {
    const results = await backfillSnapshots(fromDate);
    res.json({ success: true, days_computed: results.length });
  } catch (err) {
    console.error('ADMIN ANALYTICS BACKFILL ERROR:', err.message);
    res.status(500).json({ error: 'Errore durante il backfill degli snapshot.' });
  }
});

module.exports = router;
