// SQL behind the admin user pages: CRM list, plain list with wallet, profile, history, activity, documents, edit.
const { query } = require('../../../db');

/** WHERE clause and parameters of the CRM list's filters (country case-insensitive, exact role). */
function crmFilter({ country, role }) {
  let clause = 'WHERE 1=1';
  const params = [];
  if (country) {
    params.push(country);
    clause += ` AND UPPER(address_country) = UPPER($${params.length})`;
  }
  if (role) {
    params.push(role);
    clause += ` AND role = $${params.length}`;
  }
  return { clause, params };
}

/** @returns {Promise<number>} users matching the CRM filters */
async function countCrm(filters) {
  const { clause, params } = crmFilter(filters);
  const result = await query(`SELECT COUNT(*) FROM users ${clause}`, params);
  return parseInt(result.rows[0].count, 10);
}

/** One page of users with their marketplace counters (purchases, sales, auctions, bids), newest first. */
async function findCrmPage(filters, limit, offset) {
  const { clause, params } = crmFilter(filters);
  const result = await query(`
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
    ${clause}
    ORDER BY u.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);
  return result.rows;
}

/** Users per country, for the heatmap (all users, not just the filtered page). */
async function countByCountry() {
  const result = await query(`
    SELECT UPPER(address_country) as country, COUNT(*)::int as user_count
    FROM users
    WHERE address_country IS NOT NULL
    GROUP BY UPPER(address_country)
  `);
  return result.rows;
}

async function recentBids(userId) {
  const result = await query(`
    SELECT b.id, b.amount, b.is_winning, b.created_at, l.title as listing_title, l.id as listing_id
    FROM bids b
    JOIN listings l ON b.listing_id = l.id
    WHERE b.bidder_id = $1
    ORDER BY b.created_at DESC
    LIMIT 50
  `, [userId]);
  return result.rows;
}

/** The themes this user sold most (completed orders, top 5). */
async function topSoldThemes(userId) {
  const result = await query(`
    SELECT l.theme, COUNT(*)::int as sales_count
    FROM orders o
    JOIN listings l ON o.listing_id = l.id
    WHERE o.seller_id = $1 AND o.status = 'completed' AND l.theme IS NOT NULL
    GROUP BY l.theme
    ORDER BY sales_count DESC
    LIMIT 5
  `, [userId]);
  return result.rows;
}

/** Average bid as a numeric string, or null without bids. */
async function averageBid(userId) {
  const result = await query(`
    SELECT ROUND(AVG(amount)::numeric, 2)::numeric as avg_bid_amount
    FROM bids
    WHERE bidder_id = $1
  `, [userId]);
  return result.rows[0]?.avg_bid_amount;
}

/** `text` matched against username or e-mail; null for no filter. */
const searchFilter = (text) => (text
  ? { clause: 'WHERE u.username ILIKE $1 OR u.email ILIKE $1', params: [`%${text}%`] }
  : { clause: '', params: [] });

/** One page of users with their wallet balance (LEFT JOIN: users without a wallet still show up). */
async function findWithWallet(search, limit, offset) {
  const { clause, params } = searchFilter(search);
  const result = await query(`
    SELECT u.id, u.username, u.email, u.role, u.is_active, u.created_at,
           w.balance_credits, w.updated_at AS wallet_updated_at
    FROM users u
    LEFT JOIN public.user_wallets w ON w.user_id = u.id
    ${clause}
    ORDER BY u.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);
  return result.rows;
}

/** @returns {Promise<number|undefined>} */
async function countMatching(search) {
  const { clause, params } = searchFilter(search);
  const result = await query(`SELECT COUNT(*)::int AS total FROM users u ${clause}`, params);
  return result.rows[0]?.total;
}

/** The full admin profile with the wallet balance, or null. */
async function findProfile(id) {
  const result = await query(`
    SELECT u.id, u.username, u.email, u.full_name, u.avatar_url, u.role,
           u.is_active, u.account_status, u.is_verified, u.is_pro,
           u.seller_type, u.company_name, u.address_country, u.city,
           u.rating_avg, u.rating_count, u.sales_count, u.created_at,
           w.balance_credits
    FROM users u
    LEFT JOIN public.user_wallets w ON w.user_id = u.id
    WHERE u.id = $1
  `, [id]);
  return result.rows[0] || null;
}

/** The stored references of the user's identity documents, or null for an unknown user. */
async function findDocumentRefs(id) {
  const result = await query('SELECT id_scan_url, business_license_url FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/** Sessions summary, total pageviews and top 10 pages of one user, run concurrently. */
async function siteActivity(userId) {
  const [summaryRes, pageviewsRes, topPathsRes] = await Promise.all([
    query(`
      SELECT
        COUNT(*)::int AS session_count,
        COALESCE(SUM(duration_seconds), 0)::int AS total_time_seconds,
        MIN(started_at) AS first_seen_at,
        MAX(last_seen_at) AS last_seen_at
      FROM analytics_sessions
      WHERE user_id = $1
    `, [userId]),
    query(`
      SELECT COUNT(*)::int AS total_pageviews
      FROM analytics_pageviews p
      JOIN analytics_sessions s ON s.id = p.session_id
      WHERE s.user_id = $1
    `, [userId]),
    query(`
      SELECT p.path, COUNT(*)::int AS views
      FROM analytics_pageviews p
      JOIN analytics_sessions s ON s.id = p.session_id
      WHERE s.user_id = $1
      GROUP BY p.path
      ORDER BY views DESC
      LIMIT 10
    `, [userId]),
  ]);
  return { summary: summaryRes.rows[0], pageviews: pageviewsRes.rows[0], topPages: topPathsRes.rows };
}

/**
 * Sets role and/or account status; is_active follows the status (true only when 'active').
 * @returns the updated row, or null for an unknown user
 */
async function updateRoleAndStatus(id, { role, status }) {
  const sets = [];
  const params = [];
  if (role) {
    params.push(role);
    sets.push(`role = $${params.length}`);
  }
  if (status) {
    params.push(status);
    sets.push(`account_status = $${params.length}`);
    params.push(status === 'active');
    sets.push(`is_active = $${params.length}`);
  }
  params.push(id);
  const result = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING id, username, role, is_active, account_status`,
    params
  );
  return result.rows[0] || null;
}

module.exports = {
  countCrm,
  findCrmPage,
  countByCountry,
  recentBids,
  topSoldThemes,
  averageBid,
  findWithWallet,
  countMatching,
  findProfile,
  findDocumentRefs,
  siteActivity,
  updateRoleAndStatus,
};
