/**
 * POST /api/support/chat
 *
 * Help Center chatbot endpoint. No auth required — this is the public
 * support widget. Grounded on the BrickMarket knowledge base in
 * services/chatbot.js (FAQ + legal rules + site overview).
 */
const express = require('express');
const router = express.Router();
const { askSupportBot } = require('../services/chatbot');

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_TURNS = 6;

// Simple in-memory rate limiter: max 15 messages per IP per minute
// (mirrors the pattern used in routes/sets.js).
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - record.start > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  record.count++;
  rateLimitMap.set(ip, record);
  return record.count > RATE_MAX;
}

router.post('/chat', async (req, res) => {
  const { message, history } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Il messaggio non può essere vuoto.' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Il messaggio è troppo lungo (max ${MAX_MESSAGE_LENGTH} caratteri).` });
  }

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Troppi messaggi. Riprova tra un minuto.' });
  }

  // Sanitize history: only well-formed {role, text} pairs, capped in length.
  const safeHistory = Array.isArray(history)
    ? history
        .filter((h) => h && (h.role === 'user' || h.role === 'bot') && typeof h.text === 'string')
        .slice(-MAX_HISTORY_TURNS)
        .map((h) => ({ role: h.role, text: h.text.slice(0, MAX_MESSAGE_LENGTH) }))
    : [];

  try {
    const { reply, configured } = await askSupportBot(message.trim(), safeHistory);
    return res.json({ reply, configured });
  } catch (err) {
    console.error('[Support Chat] Unexpected error:', err);
    return res.status(500).json({ error: 'Errore interno del servizio di assistenza.' });
  }
});

module.exports = router;
