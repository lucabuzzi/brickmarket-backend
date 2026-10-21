// Proof of cookie consent (art. 7.1 GDPR): one append-only row per choice made in the banner.
// Only a keyed hash of the IP is stored (never the address), plus a truncated user agent.
// Pure helpers (validate, hash) are unit-tested in tests/consent-log.test.js.
const crypto = require('crypto');

const CHOICES = ['accepted', 'rejected'];
const SOURCES = ['banner', 'gpc', 'settings'];
const VERSION_RE = /^[0-9A-Za-z._-]{1,20}$/;

/** Returns the cleaned { choice, source, policyVersion } or null when the body is not acceptable. */
function parseConsent(body) {
  const { choice, source, policy_version: policyVersion } = body || {};
  if (!CHOICES.includes(choice) || !SOURCES.includes(source)) return null;
  if (typeof policyVersion !== 'string' || !VERSION_RE.test(policyVersion)) return null;
  return { choice, source, policyVersion };
}

/** HMAC-SHA256 of the IP with a server secret: comparable for equality, not reversible by brute force. */
function hashIp(ip, secret = process.env.CONSENT_HASH_SECRET || process.env.JWT_SECRET) {
  if (!ip || !secret) return null;
  return crypto.createHmac('sha256', secret).update(String(ip)).digest('hex');
}

async function recordConsent(db, { choice, source, policyVersion, userId, ip, userAgent }) {
  await db.query(
    `INSERT INTO public.consent_log (choice, source, policy_version, user_id, ip_hash, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [choice, source, policyVersion, userId || null, hashIp(ip), userAgent ? String(userAgent).slice(0, 200) : null]
  );
}

/** Retention: delete rows older than `days`. Meant for a scheduled job (period set in the privacy policy). */
async function purgeOlderThan(db, days) {
  const r = await db.query(`DELETE FROM public.consent_log WHERE created_at < NOW() - ($1 || ' days')::interval`, [String(days)]);
  return r.rowCount;
}

module.exports = { parseConsent, hashIp, recordConsent, purgeOlderThan, CHOICES, SOURCES };
