// Admin dashboard figures: shapes the raw totals into the payloads the admin pages read, and fills the
// calendar's "today" (never stored yet) with a live-computed snapshot.
const HttpError = require('../../../http/HttpError');
const repo = require('./analytics.repository');
const { computeDaySnapshot, backfillSnapshots } = require('../../../services/analyticsSnapshot');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A share as a percentage with one decimal (0 when there is nothing to divide). */
const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

async function platformStats() {
  const t = await repo.platformTotals();
  return {
    users: t.users,
    listings: { ...t.listings, catalogTotal: t.catalog.total_sets },
    orders: t.orders,
    reviews: t.reviews,
    generated_at: new Date().toISOString(),
  };
}

function tradingPairs() {
  return repo.tradingPairs();
}

async function trafficOverview() {
  const r = await repo.trafficOverview();
  const { started, completed } = r.funnel[0];
  const totalVisitors = r.authFunnel[0].total_visitors;
  const authenticatedVisitors = r.authFunnel[0].authenticated_visitors;

  return {
    visitors: r.visitors[0],
    sessions: r.sessions[0],
    pageviews: { ...r.pageviews[0], top_paths: r.topPaths },
    registrations: r.registrations[0],
    funnel: { started, completed, conversion_rate: percent(completed, started) },
    geo: { countries: r.geo },
    auth_funnel: {
      total_visitors: totalVisitors,
      authenticated_visitors: authenticatedVisitors,
      bounced_visitors: totalVisitors - authenticatedVisitors,
      authentication_rate: percent(authenticatedVisitors, totalVisitors),
    },
    daily_series: r.daily,
    generated_at: new Date().toISOString(),
  };
}

/** `limit` from the query string: default 50, at most 200. */
function recentSessions(limit) {
  return repo.recentSessions(Math.min(parseInt(limit, 10) || 50, 200));
}

async function behavior() {
  const r = await repo.behavior();
  return {
    top_pages_by_time: r.pages,
    top_clicks: r.clicks,
    top_clicks_by_page: r.clicksByPage,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Per-day summary of a calendar month (`month` 1-12). Past days come from the stored snapshots; today never
 * has one yet (snapshots are saved for completed days), so it's computed live and appended.
 */
async function calendar(yearParam, monthParam) {
  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new HttpError(400, 'Parametri year/month non validi.');
  }

  const days = await repo.snapshotsOfMonth(`${year}-${String(month).padStart(2, '0')}-01`);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const isCurrentMonth = today.getUTCFullYear() === year && (today.getUTCMonth() + 1) === month;
  if (isCurrentMonth && !days.some((d) => d.date === todayStr)) {
    days.push(await computeDaySnapshot(todayStr));
  }
  return { year, month, days };
}

/** One day ('YYYY-MM-DD'): the stored snapshot, or one computed live (today, or a day not yet backfilled). */
async function day(date) {
  if (!DATE_RE.test(date || '')) throw new HttpError(400, 'Parametro date non valido (atteso YYYY-MM-DD).');
  return (await repo.snapshotOfDay(date)) || computeDaySnapshot(date);
}

/** (Re)computes the daily snapshots from `fromDate` through yesterday. Idempotent. */
async function backfill(fromDate) {
  if (!DATE_RE.test(fromDate || '')) throw new HttpError(400, 'Parametro fromDate non valido (atteso YYYY-MM-DD).');
  const results = await backfillSnapshots(fromDate);
  return { success: true, days_computed: results.length };
}

module.exports = { platformStats, tradingPairs, trafficOverview, recentSessions, behavior, calendar, day, backfill };
