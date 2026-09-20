// Mints JWTs the exact same way src/services/authService.js#generateToken does
// ({ userId, role }, JWT_SECRET, 7d) — lets tests authenticate as a real,
// already-existing user without going through registration/Turnstile/email
// verification.
require('./loadTestEnv');
const jwt = require('jsonwebtoken');

function tokenFor(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { tokenFor };
