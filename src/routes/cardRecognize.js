/**
 * /api/cards/recognize — a seller photographs a card (One Piece, Magic, Pokémon, Yu-Gi-Oh!, Lorcana) and gets back the
 * real prints it can be (src/services/cardRecognition.js); the sell page then lets them pick the exact one. With
 * game "lego" the photo is of a LEGO box instead, and the answer is the catalog set it shows (legoRecognition.js).
 *
 *   GET  /recognize/status   public: { enabled, games } so the sell page shows the camera button only where it works
 *   POST /recognize          logged in, multipart: "game" (default onepiece, or "lego") and "image" (one photo, <= 10 MB)
 *
 * The photo stays in memory for the request: it is never written to disk, uploaded or logged. Each seller has an
 * hourly and a daily allowance, and the whole site a daily one, because every photo is a paid call to the reader.
 */

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const recognition = require('../services/cardRecognition');
const legoRecognition = require('../services/legoRecognition');
const cardCatalog = require('../services/cardCatalog');

const MAX_BYTES = 10 * 1024 * 1024;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const limitFromEnv = (name, fallback) => {
  const n = Number.parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// RecognitionError code -> HTTP status; the client shows its own message for each `code`
const ERROR_STATUS = { bad_image: 400, unsupported_game: 400, not_configured: 503, rate_limited: 503, timeout: 504, provider_error: 502 };

function createCardRecognizeRouter({
  recognize = recognition.recognizeCard,
  recognizeLego = legoRecognition.recognizeLegoSet,
  isEnabled = recognition.isEnabled,
  enabledGames = recognition.enabledGames,
  cachePrints = cardCatalog.cachePrints,
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
    res.json({ enabled: isEnabled(), games: enabledGames() });
  });

  router.post('/recognize', authMiddleware, enabledOnly, userHourly, userDaily, siteDaily, readPhoto, async (req, res) => {
    const t0 = Date.now();
    // the sell page sends the game chosen in the form; the One Piece-only client of before sent none
    const game = String(req.body?.game || 'onepiece').toLowerCase();
    if (!enabledGames().includes(game)) {
      return res.status(400).json({ error: 'Il riconoscimento non è disponibile per questo gioco.', code: 'unsupported_game' });
    }
    if (game === 'lego') return recognizeLegoPhoto(req, res, t0);
    try {
      const result = await recognize(game, req.file.buffer);
      req.file.buffer = null;
      if (result.prints.length) await cachePrints(game, result.prints);
      const { reading } = result;
      const read = [reading?.code, reading?.setCode, reading?.number].filter(Boolean).join(' ') || '-';
      // never the photo: who, what was read and how long it took
      console.log(`[card-recognize] user=${req.user.userId} game=${game} status=${result.status} read=${read.slice(0, 40)} prints=${result.prints.length} `
        + `ms=${Date.now() - t0} tokens=${result.usage?.inputTokens ?? '?'}/${result.usage?.outputTokens ?? '?'}`);
      return res.json({
        game,
        status: result.status,
        reading: reading && {
          code: reading.code, name: reading.name, number: reading.number ?? null, setCode: reading.setCode ?? null,
          rarity: reading.rarity, language: reading.language, condition: reading.condition ?? null,
        },
        nameMatches: result.nameMatches,
        prints: result.prints,
      });
    } catch (err) {
      const status = ERROR_STATUS[err && err.code];
      if (!status) console.error('[card-recognize] Unexpected error:', err);
      else console.warn(`[card-recognize] user=${req.user.userId} game=${game} error=${err.code} ms=${Date.now() - t0}`);
      return res.status(status || 500).json({ error: 'Riconoscimento non riuscito, riprova o scegli la carta dal catalogo.', code: status ? err.code : 'internal' });
    }
  });

  /** A LEGO box: the set it shows, from the catalog (same limits, same "never the photo" logging as the cards). */
  async function recognizeLegoPhoto(req, res, t0) {
    try {
      const result = await recognizeLego(req.file.buffer);
      req.file.buffer = null;
      console.log(`[card-recognize] user=${req.user.userId} game=lego status=${result.status} read=${result.reading?.setNumber || '-'} `
        + `ms=${Date.now() - t0} tokens=${result.usage?.inputTokens ?? '?'}/${result.usage?.outputTokens ?? '?'}`);
      return res.json({ game: 'lego', status: result.status, reading: result.reading, set: result.set, pricing: result.pricing });
    } catch (err) {
      const status = ERROR_STATUS[err && err.code];
      if (!status) console.error('[card-recognize] Unexpected error:', err);
      else console.warn(`[card-recognize] user=${req.user.userId} game=lego error=${err.code} ms=${Date.now() - t0}`);
      return res.status(status || 500).json({ error: 'Riconoscimento non riuscito, riprova con una foto più nitida della scatola.', code: status ? err.code : 'internal' });
    }
  }

  return router;
}

module.exports = createCardRecognizeRouter();
module.exports.createCardRecognizeRouter = createCardRecognizeRouter;
