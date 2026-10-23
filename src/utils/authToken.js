// The one place that reads the site's login token from a request and verifies it. Used by the auth guards
// (src/middleware/auth.js), by the routes where logging in is optional (analytics, consent, listing detail),
// by ClutchVault's guard (routes/contest.js) and by the game plaza socket (server.js).
// Kept out of middleware/auth.js on purpose: tests replace that module with a bare guard function.
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');

/**
 * The token in the Authorization header: "Bearer <token>" or the bare token. null when there is no header.
 * With `bearerOnly`, a header without the "Bearer " prefix counts as no token.
 */
function extractToken(req, { bearerOnly = false } = {}) {
  const header = req.header ? req.header('Authorization') : req.headers?.authorization;
  if (!header) return null;
  if (header.startsWith('Bearer ')) return header.split(' ')[1];
  return bearerOnly ? null : header;
}

/** The token's payload; throws when the token is invalid, expired or signed with another secret. */
function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

/** The logged-in user's id when the request carries a valid token, null otherwise (never throws). */
function optionalUserId(req, opts) {
  const token = extractToken(req, opts);
  if (!token) return null;
  try {
    return verifyToken(token).userId || null;
  } catch {
    return null;
  }
}

module.exports = { extractToken, verifyToken, optionalUserId };
