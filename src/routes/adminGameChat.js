/**
 * /api/admin/game-chat — moderation of the typed plaza chat of CardBrix the game (admins only, adminAuth).
 *
 *   GET    /                    settings (with defaults and limits), banned terms, players muted now
 *   PUT    /settings/:key       { value }  one setting (validated by chatModeration/settings.js)
 *   POST   /terms               { term }   add a banned term ("stronz*" also matches longer words)
 *   DELETE /terms/:id
 *   GET    /log?limit&offset&userId        blocked messages, newest first
 *   POST   /mutes               { username, minutes }  mute a player by hand
 *   DELETE /mutes/:userId                  unmute
 *   POST   /preview             { text }   would this message pass? nothing logged, nobody muted
 *
 * A settings change reaches the players in the plaza at once (`onSettingsChanged`, the plaza's refreshChat).
 */

const express = require('express');
const { adminAuth } = require('../middleware/auth');
const settingsLib = require('../services/chatModeration/settings');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MUTE_MINUTES = 60 * 24 * 365;

function createAdminGameChatRouter({ repo, moderator, authMiddleware = adminAuth, onSettingsChanged = () => {} }) {
  const router = express.Router();
  router.use(authMiddleware);

  const fail = (res, err, what) => {
    console.error(`ADMIN GAME CHAT ${what} ERROR:`, err.message);
    return res.status(500).json({ error: 'Errore del server, riprova.' });
  };

  router.get('/', async (req, res) => {
    try {
      const [settings, rows, terms, mutes] = await Promise.all([repo.getSettings(), repo.listSettingRows(), repo.listTerms(), repo.listMutes()]);
      const updatedAt = Object.fromEntries(rows.map((r) => [r.key, r.updated_at]));
      res.json({ settings, defaults: settingsLib.DEFAULTS, ranges: settingsLib.INT_RANGES, updatedAt, terms, mutes });
    } catch (err) {
      return fail(res, err, 'LOAD');
    }
  });

  router.put('/settings/:key', async (req, res) => {
    const { key } = req.params;
    if (!Object.prototype.hasOwnProperty.call(settingsLib.DEFAULTS, key)) return res.status(404).json({ error: 'Impostazione sconosciuta.' });
    let value;
    try {
      value = settingsLib.validate(key, req.body?.value);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    try {
      await repo.setSetting(key, value, req.user.userId);
      console.log(`[game-chat] admin=${req.user.userId} set ${key}=${JSON.stringify(value).slice(0, 80)}`);
      onSettingsChanged();
      return res.json({ key, value });
    } catch (err) {
      return fail(res, err, 'SETTING');
    }
  });

  router.post('/terms', async (req, res) => {
    const term = req.body?.term;
    if (typeof term !== 'string' || !term.trim() || term.trim().length > 80) {
      return res.status(400).json({ error: 'La parola deve avere da 1 a 80 caratteri.' });
    }
    try {
      const row = await repo.addTerm(term, req.user.userId);
      if (!row) return res.status(409).json({ error: 'Questa parola è già nell\'elenco.' });
      return res.status(201).json(row);
    } catch (err) {
      return fail(res, err, 'ADD TERM');
    }
  });

  router.delete('/terms/:id', async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Parola non valida.' });
    try {
      return (await repo.removeTerm(id)) ? res.json({ ok: true }) : res.status(404).json({ error: 'Parola non trovata.' });
    } catch (err) {
      return fail(res, err, 'REMOVE TERM');
    }
  });

  router.get('/log', async (req, res) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
    const userId = req.query.userId ? String(req.query.userId) : null;
    if (userId && !UUID.test(userId)) return res.status(400).json({ error: 'Utente non valido.' });
    try {
      return res.json(await repo.listLog({ limit, offset, userId }));
    } catch (err) {
      return fail(res, err, 'LOG');
    }
  });

  router.post('/mutes', async (req, res) => {
    const minutes = Number(req.body?.minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MUTE_MINUTES) {
      return res.status(400).json({ error: 'Durata non valida: da 1 minuto a 1 anno.' });
    }
    try {
      const user = await repo.findUser(req.body?.username);
      if (!user) return res.status(404).json({ error: 'Utente non trovato.' });
      const until = new Date(Date.now() + minutes * 60 * 1000);
      await repo.setMute(user.id, until, 'admin', req.user.userId);
      console.log(`[game-chat] admin=${req.user.userId} muted user=${user.id} for ${minutes} min`);
      return res.json({ user_id: user.id, username: user.username, muted_until: until.toISOString(), reason: 'admin' });
    } catch (err) {
      return fail(res, err, 'MUTE');
    }
  });

  router.delete('/mutes/:userId', async (req, res) => {
    if (!UUID.test(req.params.userId)) return res.status(400).json({ error: 'Utente non valido.' });
    try {
      const done = await repo.clearMute(req.params.userId);
      if (done) console.log(`[game-chat] admin=${req.user.userId} unmuted user=${req.params.userId}`);
      return done ? res.json({ ok: true }) : res.status(404).json({ error: 'Questo utente non è silenziato.' });
    } catch (err) {
      return fail(res, err, 'UNMUTE');
    }
  });

  router.post('/preview', async (req, res) => {
    const text = req.body?.text;
    if (typeof text !== 'string' || text.length > 1000) return res.status(400).json({ error: 'Scrivi un messaggio da provare.' });
    try {
      return res.json(await moderator.preview(text));
    } catch (err) {
      return fail(res, err, 'PREVIEW');
    }
  });

  return router;
}

module.exports = { createAdminGameChatRouter };
