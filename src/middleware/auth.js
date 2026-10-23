const { query } = require('../db');
const { extractToken, verifyToken } = require('../utils/authToken');

/**
 * Builds a guard that verifies the JWT, attaches req.user (the token payload) and re-checks the account in the
 * DB on every request, so a disabled account (or, for admins, a demoted one) can't keep using a still-valid token
 * issued before the change. Answers, in order: 401 no token, 403 invalid token, 403 unknown user, 403 disabled,
 * 403 not an admin (admin guard only). A DB failure also answers 403 "Token non valido".
 */
function requireUser({ admin = false } = {}) {
  const sql = admin ? 'SELECT role, is_active FROM users WHERE id = $1' : 'SELECT is_active FROM users WHERE id = $1';
  const logPrefix = admin ? 'Admin JWT verify failed:' : 'JWT verify failed:';

  return async (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Accesso negato. Token mancante.' });
    }

    try {
      const verified = verifyToken(token);
      req.user = verified;

      const { rows: [dbUser] } = await query(sql, [verified.userId]);
      if (!dbUser) {
        return res.status(403).json({ error: 'Utente non trovato.' });
      }
      if (dbUser.is_active === false) {
        return res.status(403).json({ error: 'Account disabilitato.' });
      }
      if (admin && dbUser.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso riservato agli amministratori.' });
      }

      return next();
    } catch (err) {
      console.error(logPrefix, err.message);
      return res.status(403).json({ error: 'Token non valido' });
    }
  };
}

/** Standard guard: any active account. */
const auth = requireUser();

/** Admin guard: an active account whose role in the DB (not in the token) is still 'admin'. */
const adminAuth = requireUser({ admin: true });

module.exports = auth;
module.exports.adminAuth = adminAuth;
