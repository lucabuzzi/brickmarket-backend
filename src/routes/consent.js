const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { parseConsent, recordConsent } = require('../services/consentLog');
const { optionalUserId } = require('../utils/authToken');

const router = express.Router();

router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Troppe richieste, riprova tra poco.' },
}));

/**
 * POST /api/consent
 * Public. Records a cookie-banner choice as proof of consent. Works for "rejected" too, and does not
 * set any cookie of its own.
 */
router.post('/', async (req, res) => {
  const parsed = parseConsent(req.body);
  if (!parsed) return res.status(400).json({ error: 'Dati del consenso non validi.' });
  try {
    await recordConsent(db, { ...parsed, userId: optionalUserId(req), ip: req.ip, userAgent: req.get('user-agent') });
    return res.status(204).end();
  } catch (err) {
    console.error('consent log error:', err.message);
    return res.status(500).json({ error: 'Errore interno.' });
  }
});

module.exports = router;
