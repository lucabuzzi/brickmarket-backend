const axios = require('axios');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Cloudflare's official "always passes" test secret — used only if no real
// secret is configured, so registration/login keep working in local dev
// before a real Turnstile widget is set up. Replace with a real secret in
// production (TURNSTILE_SECRET_KEY in .env).
const DEV_FALLBACK_SECRET = '1x0000000000000000000000000000000AA';

async function verifyTurnstile(token, remoteip) {
  if (!token) return false;
  const secret = process.env.TURNSTILE_SECRET_KEY || DEV_FALLBACK_SECRET;

  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    if (remoteip) params.append('remoteip', remoteip);

    const { data } = await axios.post(VERIFY_URL, params);
    return data.success === true;
  } catch (err) {
    console.error('TURNSTILE VERIFY ERROR:', err.message);
    return false;
  }
}

module.exports = { verifyTurnstile };
