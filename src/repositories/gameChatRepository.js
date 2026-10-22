/**
 * Storage of the plaza chat moderation (tables of src/db/migrate_game_chat_moderation.js).
 *
 * Settings and banned terms are read on every typed message, so they are cached for a short while; an admin change
 * goes through this module and clears the cache at once. When the database cannot be read the safe values are used:
 * the default settings (typed chat OFF) and the last list of terms read, or the starting list.
 */

const { query } = require('../db');
const settings = require('../services/chatModeration/settings');
const { terms: SEED_TERMS } = require('../config/gameChatBannedTerms.json');

const CACHE_MS = 30 * 1000;

function createGameChatRepository({ db = { query }, now = () => Date.now() } = {}) {
  let settingsCache = null; // { at, value }
  let termsCache = null; // { at, value }
  let settingsErrorAt = -Infinity;

  async function getSettings() {
    if (settingsCache && now() - settingsCache.at < CACHE_MS) return settingsCache.value;
    try {
      const r = await db.query('SELECT key, value FROM public.game_chat_settings');
      settingsCache = { at: now(), value: settings.merge(r.rows) };
    } catch (err) {
      // re-read every 30 s: a missing table (migration not run yet) is reported every 10 minutes, not every time
      if (now() - settingsErrorAt > 10 * 60 * 1000) {
        settingsErrorAt = now();
        console.error('[game-chat] Reading the settings failed, typed chat stays off:', err.message);
      }
      return settings.merge([]);
    }
    return settingsCache.value;
  }

  /** Validates (settings.validate throws with a message for the admin), stores, and clears the cache. */
  async function setSetting(key, value, adminId) {
    const clean = settings.validate(key, value);
    await db.query(
      `INSERT INTO public.game_chat_settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [key, JSON.stringify(clean), adminId || null],
    );
    settingsCache = null;
    return clean;
  }

  async function getTerms() {
    if (termsCache && now() - termsCache.at < CACHE_MS) return termsCache.value;
    try {
      const r = await db.query('SELECT term FROM public.game_chat_banned_terms ORDER BY term');
      termsCache = { at: now(), value: r.rows.map((row) => row.term) };
    } catch (err) {
      console.error('[game-chat] Reading the banned terms failed:', err.message);
      return termsCache ? termsCache.value : SEED_TERMS;
    }
    return termsCache.value;
  }

  async function listTerms() {
    const r = await db.query('SELECT id, term, created_at FROM public.game_chat_banned_terms ORDER BY term');
    return r.rows;
  }

  async function addTerm(term, adminId) {
    const clean = String(term ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!clean || clean.length > 80) throw new Error('La parola deve avere da 1 a 80 caratteri.');
    const r = await db.query(
      `INSERT INTO public.game_chat_banned_terms (term, added_by) VALUES ($1, $2) ON CONFLICT (term) DO NOTHING RETURNING id, term, created_at`,
      [clean, adminId || null],
    );
    termsCache = null;
    return r.rows[0] || null;
  }

  async function removeTerm(id) {
    const r = await db.query('DELETE FROM public.game_chat_banned_terms WHERE id = $1', [id]);
    termsCache = null;
    return r.rowCount > 0;
  }

  /** Never fails the chat: a blocked message that cannot be logged is only reported in the server log. */
  async function logBlocked({ userId, username, message, category, source, detail }) {
    try {
      await db.query(
        `INSERT INTO public.game_chat_moderation_log (user_id, username, message, category, source, detail) VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, username || null, String(message).slice(0, 600), category, source, detail ? String(detail).slice(0, 200) : null],
      );
    } catch (err) {
      console.error('[game-chat] Logging a blocked message failed:', err.message);
    }
  }

  async function purgeLog(days) {
    const r = await db.query(`DELETE FROM public.game_chat_moderation_log WHERE created_at < now() - make_interval(days => $1)`, [days]);
    return r.rowCount || 0;
  }

  /** The end of the player's mute (Date), or null. A database error counts as "not muted": the other checks still run. */
  async function getMute(userId) {
    try {
      const r = await db.query('SELECT muted_until FROM public.game_chat_mutes WHERE user_id = $1', [userId]);
      const until = r.rows[0]?.muted_until;
      return until && new Date(until).getTime() > now() ? new Date(until) : null;
    } catch (err) {
      console.error('[game-chat] Reading a mute failed:', err.message);
      return null;
    }
  }

  async function setMute(userId, until, reason, mutedBy = null) {
    await db.query(
      `INSERT INTO public.game_chat_mutes (user_id, muted_until, reason, muted_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET muted_until = EXCLUDED.muted_until, reason = EXCLUDED.reason, muted_by = EXCLUDED.muted_by, created_at = now()`,
      [userId, until, reason, mutedBy],
    );
  }

  async function clearMute(userId) {
    const r = await db.query('DELETE FROM public.game_chat_mutes WHERE user_id = $1', [userId]);
    return r.rowCount > 0;
  }

  return { getSettings, setSetting, getTerms, listTerms, addTerm, removeTerm, logBlocked, purgeLog, getMute, setMute, clearMute };
}

module.exports = { createGameChatRepository, CACHE_MS };
