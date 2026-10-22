// The one secret every JWT on the site is signed and verified with. There is deliberately no fallback value:
// a hardcoded default would be public (it's in the repo), so anyone could sign a valid token for any user
// the moment the env var went missing. The server refuses to boot instead (see server.js).
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Throws unless JWT_SECRET is set. A short secret can be brute-forced offline from any token, so in production
 * it's fatal too; in development it only warns, so a weak local .env doesn't block work.
 */
function assertJwtSecret(env = process.env, warn = console.warn) {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Refusing to start: login tokens could not be verified safely.');
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    const msg = `JWT_SECRET is too short (${secret.length} chars, need at least ${MIN_JWT_SECRET_LENGTH}).`;
    if (env.NODE_ENV === 'production') throw new Error(msg);
    warn(`[security] ${msg} Fine for local development only.`);
  }
  return secret;
}

/** The secret to sign/verify with; throws instead of ever returning a default. */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set.');
  return secret;
}

module.exports = { assertJwtSecret, getJwtSecret, MIN_JWT_SECRET_LENGTH };
