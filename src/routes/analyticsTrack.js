const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const { lookupCountry } = require('../services/geoip');

const VISITOR_COOKIE = 'bm_visitor_id';
const VISITOR_COOKIE_MAX_AGE = 400 * 24 * 60 * 60 * 1000; // ~400 days (Chrome's cap)
const EVENT_TYPES = ['registration_started', 'registration_completed', 'login'];
const CLICK_TARGET_TYPES = ['link', 'button'];

const trackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.cookies?.[VISITOR_COOKIE] || req.ip,
  message: { error: 'Troppe richieste di tracciamento, riprova tra poco.' }
});
router.use(trackingLimiter);

function getOptionalUserId(req) {
  const authHeader = req.header('Authorization');
  if (!authHeader) return null;
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    return verified.userId || null;
  } catch {
    return null;
  }
}

function getOrSetVisitorId(req, res) {
  let visitorId = req.cookies?.[VISITOR_COOKIE];
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    res.cookie(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.ANALYTICS_COOKIE_SAMESITE || 'lax',
      maxAge: VISITOR_COOKIE_MAX_AGE,
      path: '/',
    });
  }
  return visitorId;
}

function isValidUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isValidPath(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 300;
}

/**
 * POST /api/analytics/pageview
 * Public: no auth required, tracks an anonymous or logged-in page view.
 */
router.post('/pageview', async (req, res) => {
  const { session_id, path } = req.body || {};
  if (!isValidUuid(session_id) || !isValidPath(path)) {
    return res.status(400).json({ error: 'Parametri di tracciamento non validi.' });
  }

  try {
    const visitorId = getOrSetVisitorId(req, res);
    const userId = getOptionalUserId(req);
    const country = lookupCountry(req);

    await query(`
      INSERT INTO analytics_sessions (id, visitor_id, user_id, entry_path, country)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        last_seen_at = NOW(),
        user_id = COALESCE(analytics_sessions.user_id, EXCLUDED.user_id),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - analytics_sessions.started_at))::int
    `, [session_id, visitorId, userId, path, country]);

    await query(`
      INSERT INTO analytics_pageviews (session_id, path) VALUES ($1, $2)
    `, [session_id, path]);

    res.json({ ok: true });
  } catch (err) {
    console.error('ANALYTICS TRACK ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel salvataggio dei dati di tracciamento.' });
  }
});

/**
 * POST /api/analytics/heartbeat
 * Public: periodic ping (and beacon-on-exit) to compute session duration.
 */
router.post('/heartbeat', async (req, res) => {
  const { session_id } = req.body || {};
  if (!isValidUuid(session_id)) {
    return res.status(400).json({ error: 'Parametri di tracciamento non validi.' });
  }

  try {
    await query(`
      UPDATE analytics_sessions
      SET last_seen_at = NOW(), duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int
      WHERE id = $1
    `, [session_id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('ANALYTICS TRACK ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel salvataggio dei dati di tracciamento.' });
  }
});

/**
 * POST /api/analytics/event
 * Public: fires a whitelisted, value-free funnel event (no form field data is ever accepted here).
 */
router.post('/event', async (req, res) => {
  const { session_id, event_type, path } = req.body || {};
  if (!isValidUuid(session_id) || !EVENT_TYPES.includes(event_type)) {
    return res.status(400).json({ error: 'Parametri di tracciamento non validi.' });
  }

  try {
    const visitorId = getOrSetVisitorId(req, res);
    const userId = getOptionalUserId(req);

    await query(`
      INSERT INTO analytics_events (session_id, visitor_id, user_id, event_type, path)
      VALUES ($1, $2, $3, $4, $5)
    `, [session_id, visitorId, userId, event_type, isValidPath(path) ? path : null]);

    res.json({ ok: true });
  } catch (err) {
    console.error('ANALYTICS TRACK ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel salvataggio dei dati di tracciamento.' });
  }
});

/**
 * POST /api/analytics/click
 * Public: tracks a click on an interactive element (link or button) — label text only, no form values.
 */
router.post('/click', async (req, res) => {
  const { session_id, path, target_label, target_type, target_href } = req.body || {};
  if (!isValidUuid(session_id) || !isValidPath(path) || !CLICK_TARGET_TYPES.includes(target_type)) {
    return res.status(400).json({ error: 'Parametri di tracciamento non validi.' });
  }

  try {
    const visitorId = getOrSetVisitorId(req, res);
    const userId = getOptionalUserId(req);

    await query(`
      INSERT INTO analytics_clicks (session_id, visitor_id, user_id, path, target_label, target_type, target_href)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      session_id, visitorId, userId, path,
      typeof target_label === 'string' ? target_label.slice(0, 150) : null,
      target_type,
      typeof target_href === 'string' ? target_href.slice(0, 500) : null,
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error('ANALYTICS TRACK ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel salvataggio dei dati di tracciamento.' });
  }
});

module.exports = router;
