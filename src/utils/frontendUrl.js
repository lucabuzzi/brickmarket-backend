// Base URL of the website, used to build links that leave the backend (emails, Stripe return URLs).
// FRONTEND_URL wins when set; otherwise production falls back to the real site instead of localhost —
// a verification email whose link points to http://localhost:5173 is useless to every real user.
const PRODUCTION_FALLBACK = 'https://cardbrix.com';
const DEV_FALLBACK = 'http://localhost:5173';

function getFrontendUrl(env = process.env) {
  const raw = (env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
  if (raw) return raw;
  return env.NODE_ENV === 'production' ? PRODUCTION_FALLBACK : DEV_FALLBACK;
}

module.exports = { getFrontendUrl, PRODUCTION_FALLBACK, DEV_FALLBACK };
