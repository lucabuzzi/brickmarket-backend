const jwt = require('jsonwebtoken');
const { query } = require('../db');

/**
 * Standard auth middleware — verifies the JWT and attaches req.user.
 */
const auth = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader) {
    return res.status(401).json({ error: 'Accesso negato. Token mancante.' });
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    console.error('JWT verify failed:', err.message);
    res.status(403).json({ error: 'Token non valido' });
  }
};

/**
 * Admin auth middleware — verifies the JWT and performs a DB-backed
 * role check to ensure the token owner still has role = 'admin'.
 * This prevents privilege escalation via stale tokens.
 */
const adminAuth = async (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader) {
    return res.status(401).json({ error: 'Accesso negato. Token mancante.' });
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : authHeader;

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;

    // DB-backed check: always re-verify the role from the DB, not the token
    const result = await query(
      'SELECT role, is_active FROM users WHERE id = $1',
      [verified.userId]
    );

    const dbUser = result.rows[0];

    if (!dbUser) {
      return res.status(403).json({ error: 'Utente non trovato.' });
    }
    if (dbUser.is_active === false) {
      return res.status(403).json({ error: 'Account disabilitato.' });
    }
    if (dbUser.role !== 'admin') {
      return res.status(403).json({ error: 'Accesso riservato agli amministratori.' });
    }

    next();
  } catch (err) {
    console.error('Admin JWT verify failed:', err.message);
    res.status(403).json({ error: 'Token non valido' });
  }
};

module.exports = auth;
module.exports.adminAuth = adminAuth;
