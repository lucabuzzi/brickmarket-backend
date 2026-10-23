// SQL behind the admin dashboard: platform totals, traffic analytics, trading pairs, daily snapshots.
const { query } = require('../../../db');

/** Five independent totals, run concurrently: [users, listings, orders, reviews, catalog] first rows. */
async function platformTotals() {
  const [usersRes, listingsRes, ordersRes, reviewsRes, catalogRes] = await Promise.all([
    query(`
      SELECT
        COUNT(*)::int                                                  AS total_users,
        COUNT(*) FILTER (WHERE role = 'admin')::int                   AS total_admins,
        (SELECT COUNT(DISTINCT seller_id) FROM listings)::int         AS total_sellers,
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
    query(`SELECT COUNT(*)::int as total_sets FROM master_sets`),
  ]);
  return {
    users: usersRes.rows[0],
    listings: listingsRes.rows[0],
    orders: ordersRes.rows[0],
    reviews: reviewsRes.rows[0],
    catalog: catalogRes.rows[0],
  };
}

/** Who bought from whom, most trades first (completed orders, top 100). */
async function tradingPairs() {
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
  return result.rows;
}

/** Every traffic figure of the overview page, run concurrently. Each value is the query's rows. */
async function trafficOverview() {
  const [visitors, sessions, pageviews, topPaths, registrations, funnel, daily, geo, authFunnel] = await Promise.all([
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
  return {
    visitors: visitors.rows,
    sessions: sessions.rows,
    pageviews: pageviews.rows,
    topPaths: topPaths.rows,
    registrations: registrations.rows,
    funnel: funnel.rows,
    daily: daily.rows,
    geo: geo.rows,
    authFunnel: authFunnel.rows,
  };
}

/** Most recent visitor sessions with their pageview count and username when known. */
async function recentSessions(limit) {
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
  return result.rows;
}

/** Last 30 days: dwell time per page and the most-clicked elements (overall and per page), concurrently. */
async function behavior() {
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
  return { pages: pagesRes.rows, clicks: clicksRes.rows, clicksByPage: clicksByPageRes.rows };
}

/** Stored daily snapshots of the month starting at `monthStart` ('YYYY-MM-01'), oldest first. */
async function snapshotsOfMonth(monthStart) {
  const result = await query(
    `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date, visitors, sessions, avg_duration_seconds, pageviews,
            new_registrations, logins, bounced_visitors
     FROM analytics_daily_snapshots
     WHERE date >= $1::date AND date < ($1::date + INTERVAL '1 month')
     ORDER BY date ASC`,
    [monthStart]
  );
  return result.rows;
}

/** The stored snapshot of one day ('YYYY-MM-DD'), or null. */
async function snapshotOfDay(date) {
  const result = await query(
    `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date, visitors, sessions, avg_duration_seconds,
            pageviews, new_registrations, logins, bounced_visitors, countries
     FROM analytics_daily_snapshots WHERE date = $1`,
    [date]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

module.exports = {
  platformTotals,
  tradingPairs,
  trafficOverview,
  recentSessions,
  behavior,
  snapshotsOfMonth,
  snapshotOfDay,
};
