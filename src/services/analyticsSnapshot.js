const { query } = require('../db');

/**
 * Computes the full analytics summary for a single calendar day (UTC),
 * from the raw analytics_* tables. Used both to populate historical
 * snapshots and to answer "today" (which has no stored snapshot yet)
 * on the fly, so the two code paths always agree on how numbers are derived.
 */
async function computeDaySnapshot(dateStr) {
  const [
    visitorsRes, sessionsRes, pageviewsRes, registrationsRes,
    loginsRes, authFunnelRes, countriesRes,
  ] = await Promise.all([
    query(
      `SELECT COUNT(DISTINCT visitor_id)::int AS visitors
       FROM analytics_sessions
       WHERE started_at::date = $1::date`,
      [dateStr]
    ),
    query(
      `SELECT COUNT(*)::int AS sessions,
              COALESCE(ROUND(AVG(duration_seconds)), 0)::int AS avg_duration_seconds
       FROM analytics_sessions
       WHERE started_at::date = $1::date`,
      [dateStr]
    ),
    query(
      `SELECT COUNT(*)::int AS pageviews
       FROM analytics_pageviews
       WHERE viewed_at::date = $1::date`,
      [dateStr]
    ),
    query(
      `SELECT COUNT(*)::int AS new_registrations
       FROM users
       WHERE created_at::date = $1::date`,
      [dateStr]
    ),
    query(
      `SELECT COUNT(*)::int AS logins
       FROM analytics_events
       WHERE event_type = 'login' AND created_at::date = $1::date`,
      [dateStr]
    ),
    query(
      `WITH visited AS (
         SELECT DISTINCT visitor_id FROM analytics_sessions WHERE started_at::date = $1::date
       ),
       authenticated AS (
         SELECT DISTINCT visitor_id FROM analytics_events
         WHERE event_type IN ('login', 'registration_completed') AND created_at::date = $1::date
       )
       SELECT
         (SELECT COUNT(*) FROM visited)::int AS total_visitors,
         (SELECT COUNT(*) FROM visited v JOIN authenticated a ON a.visitor_id = v.visitor_id)::int AS authenticated_visitors`,
      [dateStr]
    ),
    query(
      `SELECT COALESCE(country, '??') AS country, COUNT(DISTINCT visitor_id)::int AS visitors
       FROM analytics_sessions
       WHERE started_at::date = $1::date
       GROUP BY country
       ORDER BY visitors DESC`,
      [dateStr]
    ),
  ]);

  const totalVisitors = authFunnelRes.rows[0].total_visitors;
  const authenticatedVisitors = authFunnelRes.rows[0].authenticated_visitors;

  return {
    date: dateStr,
    visitors: visitorsRes.rows[0].visitors,
    sessions: sessionsRes.rows[0].sessions,
    avg_duration_seconds: sessionsRes.rows[0].avg_duration_seconds,
    pageviews: pageviewsRes.rows[0].pageviews,
    new_registrations: registrationsRes.rows[0].new_registrations,
    logins: loginsRes.rows[0].logins,
    bounced_visitors: totalVisitors - authenticatedVisitors,
    countries: countriesRes.rows,
  };
}

/** Computes and upserts the snapshot row for a single day. */
async function saveDaySnapshot(dateStr) {
  const s = await computeDaySnapshot(dateStr);
  await query(
    `INSERT INTO analytics_daily_snapshots
       (date, visitors, sessions, avg_duration_seconds, pageviews, new_registrations, logins, bounced_visitors, countries, computed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (date) DO UPDATE SET
       visitors = EXCLUDED.visitors,
       sessions = EXCLUDED.sessions,
       avg_duration_seconds = EXCLUDED.avg_duration_seconds,
       pageviews = EXCLUDED.pageviews,
       new_registrations = EXCLUDED.new_registrations,
       logins = EXCLUDED.logins,
       bounced_visitors = EXCLUDED.bounced_visitors,
       countries = EXCLUDED.countries,
       computed_at = NOW()`,
    [s.date, s.visitors, s.sessions, s.avg_duration_seconds, s.pageviews, s.new_registrations, s.logins, s.bounced_visitors, JSON.stringify(s.countries)]
  );
  return s;
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Saves snapshots for every day from `fromDateStr` up to (and including)
 * yesterday (UTC) — never today, since today isn't finished yet and would
 * produce an incomplete/misleading permanent record. Idempotent: safe to
 * re-run any time (e.g. on server boot, to backfill days missed while down).
 */
async function backfillSnapshots(fromDateStr) {
  const start = new Date(fromDateStr + 'T00:00:00.000Z');
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  const results = [];
  for (let d = new Date(start); d <= yesterday; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = toDateStr(d);
    const snapshot = await saveDaySnapshot(dateStr);
    results.push(snapshot);
  }
  return results;
}

module.exports = { computeDaySnapshot, saveDaySnapshot, backfillSnapshots };
