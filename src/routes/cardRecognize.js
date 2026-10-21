/**
 * /api/cards/recognize — a seller photographs a One Piece card and gets back the real prints of the code printed on
 * it (src/services/cardRecognition.js); the sell page then lets them pick the exact one.
 *
 *   GET  /recognize/status   public: { enabled, games } so the sell page shows the camera button only when it works
 *   POST /recognize          logged in, multipart field "image" (one photo, <= 10 MB)
 *
 * The photo stays in memory for the request: it is never written to disk, uploaded or logged. Each seller has an
 * hourly and a daily allowance, and the whole site a daily one, because every photo is a paid call to the reader.
 */

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const recognition = require('../services/cardRecognition');
const onepieceApi = require('../services/onepieceApi');

const MAX_BYTES = 10 * 1024 * 1024;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const limitFromEnv = (name, fallback) => {
  const n = Number.parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// RecognitionError code -> HTTP status; the client shows its own message for each `code`
const ERROR_STATUS = { bad_image: 400, not_configured: 503, rate_limited: 503, timeout: 504, provider_error: 502 };

function createCardRecognizeRouter({
  recognize = recognition.recognizeOnePiece,
  isEnabled = recognition.isEnabled,
  cachePrints = onepieceApi.cachePrints,
  authMiddleware = auth,
  limits = {
    hourly: limitFromEnv('CARD_RECOGNIZE_HOURLY', 20),
    daily: limitFromEnv('CARD_RECOGNIZE_DAILY', 60),
    siteDaily: limitFromEnv('CARD_RECOGNIZE_SITE_DAILY', 1000),
  },
} = {}) {
  const router = express.Router();

  const tooMany = (code) => (req, res) => res.status(429).json({ error: 'Hai raggiunto il limite di riconoscimenti, riprova più tardi.', code });
  const perUser = (windowMs, limit, code) => rateLimit({
    windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
    keyGenerator: (req) => `user:${req.user.userId}`,
    handler: tooMany(code),
  });
  const userHourly = perUser(HOUR, limits.hourly, 'user_hourly_limit');
  const userDaily = perUser(DAY, limits.daily, 'user_daily_limit');
  const siteDaily = rateLimit({
    windowMs: DAY, limit: limits.siteDaily, standardHeaders: false, legacyHeaders: false,
    keyGenerator: () => 'site',
    handler: tooMany('site_daily_limit'),
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1 },
    fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
  }).single('image');

  const enabledOnly = (req, res, next) => (isEnabled()
    ? next()
    : res.status(503).json({ error: 'Il riconoscimento delle carte non è disponibile.', code: 'not_configured' }));

  const readPhoto = (req, res, next) => upload(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'La foto supera i 10 MB.', code: 'too_large' });
    if (err) return res.status(400).json({ error: 'Foto non valida.', code: 'bad_image' });
    if (!req.file) return res.status(400).json({ error: 'Carica una foto della carta.', code: 'no_image' });
    return next();
  });

  router.get('/recognize/status', (req, res) => {
    res.json({ enabled: isEnabled(), games: ['onepiece'] });
  });

  router.post('/recognize', authMiddleware, enabledOnly, userHourly, userDaily, siteDaily, readPhoto, async (req, res) => {
    const t0 = Date.now();
    try {
      const result = await recognize(req.file.buffer);
      req.file.buffer = null;
      if (result.prints.length) await cachePrints(result.prints);
      const { reading } = result;
      // never the photo: who, what was read and how long it took
      console.log(`[card-recognize] user=${req.user.userId} status=${result.status} code=${reading?.code || '-'} prints=${result.prints.length} `
        + `ms=${Date.now() - t0} tokens=${result.usage?.inputTokens ?? '?'}/${result.usage?.outputTokens ?? '?'}`);
      return res.json({
        game: 'onepiece',
        status: result.status,
        reading: reading && { code: reading.code, name: reading.name, rarity: reading.rarity, language: reading.language },
        nameMatches: result.nameMatches,
        prints: result.prints,
      });
    } catch (err) {
      const status = ERROR_STATUS[err && err.code];
      if (!status) console.error('[card-recognize] Unexpected error:', err);
      else console.warn(`[card-recognize] user=${req.user.userId} error=${err.code} ms=${Date.now() - t0}`);
      return res.status(status || 500).json({ error: 'Riconoscimento non riuscito, riprova o scegli la carta dal catalogo.', code: status ? err.code : 'internal' });
    }
  });

  return router;
}

module.exports = createCardRecognizeRouter();
module.exports.createCardRecognizeRouter = createCardRecognizeRouter;
