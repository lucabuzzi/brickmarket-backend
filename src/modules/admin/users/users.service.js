// Admin user management: CRM and plain lists, profile, history, site activity, identity documents, and the
// role/status edit (an admin can never ban, delete or demote their own account).
const HttpError = require('../../../http/HttpError');
const repo = require('./users.repository');
const privateDocuments = require('../../../services/privateDocuments');
const { updateUserSchema, validate } = require('../../../validators/adminUserValidators');

const USER_NOT_FOUND = 'Utente non trovato.';
const toNumberOrNull = (v) => (v !== null ? parseFloat(v) : null);
/** Paging from the query string: `limit` defaults to `def`, capped at `max`; `offset` defaults to 0. */
const paging = (q, def, max) => ({
  limit: Math.min(parseInt(q.limit, 10) || def, max),
  offset: parseInt(q.offset, 10) || 0,
});

/**
 * Paginated CRM list (`page`/`limit` as sent, defaults 1/20) with the per-country heatmap.
 * Page and limit are used as received, like the original route: `(page - 1) * limit` and `total / limit`.
 */
async function crmList({ page = 1, limit = 20, country, role }) {
  const offset = (page - 1) * limit;
  const total = await repo.countCrm({ country, role });
  const users = await repo.findCrmPage({ country, role }, limit, offset);
  const geoData = await repo.countByCountry();
  return {
    users,
    pagination: { total, page: parseInt(page, 10), pages: Math.ceil(total / limit) },
    geoData,
  };
}

/** Last 50 bids, top 5 sold themes and the average bid of one user. */
async function history(userId) {
  const bids = await repo.recentBids(userId);
  const topCategories = await repo.topSoldThemes(userId);
  const avgBid = await repo.averageBid(userId);
  return { bids, topCategories, avgBid: avgBid || 0 };
}

/** Plain user list with wallet balance; `search` matches username or e-mail. Default 50 per page, max 200. */
async function listWithWallet(q) {
  const { limit, offset } = paging(q, 50, 200);
  const rows = await repo.findWithWallet(q.search, limit, offset);
  const total = await repo.countMatching(q.search);
  return {
    users: rows.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      isActive: u.is_active,
      createdAt: u.created_at,
      balanceCredits: toNumberOrNull(u.balance_credits),
      walletUpdatedAt: u.wallet_updated_at,
    })),
    total: total || 0,
    limit,
    offset,
  };
}

async function profile(id) {
  const u = await repo.findProfile(id);
  if (!u) throw new HttpError(404, USER_NOT_FOUND);
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.full_name,
    avatarUrl: u.avatar_url,
    role: u.role,
    isActive: u.is_active,
    accountStatus: u.account_status || 'active',
    isVerified: u.is_verified,
    isPro: u.is_pro,
    sellerType: u.seller_type,
    companyName: u.company_name,
    country: u.address_country,
    city: u.city,
    ratingAvg: toNumberOrNull(u.rating_avg),
    ratingCount: u.rating_count,
    salesCount: u.sales_count,
    createdAt: u.created_at,
    balanceCredits: toNumberOrNull(u.balance_credits),
  };
}

/** The pro seller's identity documents as short-lived signed links (the stored files are never public). */
async function documentLinks(id) {
  const u = await repo.findDocumentRefs(id);
  if (!u) throw new HttpError(404, USER_NOT_FOUND);
  return {
    idScan: privateDocuments.getDocumentUrl(u.id_scan_url),
    businessLicense: privateDocuments.getDocumentUrl(u.business_license_url),
    expiresInSeconds: privateDocuments.LINK_TTL_SECONDS,
  };
}

async function activity(userId) {
  const { summary, pageviews, topPages } = await repo.siteActivity(userId);
  return {
    sessionCount: summary.session_count,
    totalTimeSeconds: summary.total_time_seconds,
    totalPageviews: pageviews.total_pageviews,
    firstSeenAt: summary.first_seen_at,
    lastSeenAt: summary.last_seen_at,
    topPages,
  };
}

/** Body { role?, status? } -> { success, user }. Validation and self-protection happen before any write. */
function checkUpdate(targetId, adminId, body) {
  const { error, value } = validate(updateUserSchema, body);
  if (error) throw new HttpError(400, error);
  if (targetId === adminId && value.status && value.status !== 'active') {
    throw new HttpError(400, 'Non puoi bannare o cancellare il tuo stesso account.');
  }
  if (targetId === adminId && value.role && value.role !== 'admin') {
    throw new HttpError(400, 'Non puoi rimuovere il ruolo admin dal tuo stesso account.');
  }
  return value;
}

async function applyUpdate(targetId, value) {
  const row = await repo.updateRoleAndStatus(targetId, value);
  if (!row) throw new HttpError(404, USER_NOT_FOUND);
  return {
    success: true,
    user: { id: row.id, username: row.username, role: row.role, isActive: row.is_active, accountStatus: row.account_status },
  };
}

async function updateUser(targetId, adminId, body) {
  return applyUpdate(targetId, checkUpdate(targetId, adminId, body));
}

module.exports = { crmList, history, listWithWallet, profile, documentLinks, activity, updateUser };
