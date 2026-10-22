/**
 * Moderation of the messages typed in the plaza chat of CardBrix the game. Every message is checked BEFORE anyone
 * sees it; a refused one reaches nobody and only its author is told why.
 *
 *   moderator.check(user, text) -> { ok: true, text }                     send `text` (cleaned) to the map
 *                                | { ok: false, reason, category?, mutedUntil? }
 *     reason: 'disabled'     typed chat is switched off (admin setting free_text_enabled)
 *             'empty' | 'too_long'
 *             'muted'        the player is muted until `mutedUntil`
 *             'blocked'      a rule or the AI refused it (`category`); may have just muted the player (`mutedUntil`)
 *             'unavailable'  the AI gave no verdict (outage, quota, daily limit): blocked, but not held against them
 *
 * Order: cheap checks first (length, mute, fixed rules: rules.js), the paid AI (aiModerator.js) last. Blocked messages
 * are logged for the admin; `strike_threshold` blocks within `strike_window_minutes` mute the player.
 */

const rules = require('./rules');
const { geminiModerator } = require('./aiModerator');

// control characters and the Unicode tricks that change how text is drawn (right-to-left overrides...)
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g;

/** Trimmed, one space between words, no invisible characters. */
const cleanMessage = (text) => String(text ?? '').replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();

function createChatModerator({ repo, moderate = geminiModerator(), now = () => Date.now(), log = console } = {}) {
  const strikes = new Map(); // userId -> timestamps of recent blocked messages (memory: a restart forgives)
  let aiDay = null;
  let aiCalls = 0;

  const dayOf = (t) => new Date(t).toISOString().slice(0, 10);
  let purgedDay = null;

  /** Counts a block; returns the end of the mute it triggers, or null. */
  async function strike(user, s) {
    const t = now();
    const windowMs = s.strike_window_minutes * 60 * 1000;
    const recent = (strikes.get(user.id) || []).filter((at) => t - at < windowMs);
    recent.push(t);
    if (recent.length < s.strike_threshold) {
      strikes.set(user.id, recent);
      return null;
    }
    strikes.delete(user.id);
    const until = new Date(t + s.mute_minutes * 60 * 1000);
    try {
      await repo.setMute(user.id, until, 'auto');
    } catch (err) {
      log.error('[game-chat] Saving an automatic mute failed:', err.message);
    }
    return until;
  }

  async function blocked(user, message, s, { category, source, detail }) {
    await repo.logBlocked({ userId: user.id, username: user.username, message, category, source, detail });
    // once a day, the log is cut to its retention
    const today = dayOf(now());
    if (purgedDay !== today) {
      purgedDay = today;
      repo.purgeLog(s.log_retention_days).catch((err) => log.error('[game-chat] Purging the log failed:', err.message));
    }
    const mutedUntil = await strike(user, s);
    return { ok: false, reason: 'blocked', category, ...(mutedUntil ? { mutedUntil } : {}) };
  }

  async function check(user, text) {
    const s = await repo.getSettings();
    if (!s.free_text_enabled) return { ok: false, reason: 'disabled' };
    const message = cleanMessage(text);
    if (!message) return { ok: false, reason: 'empty' };
    if (message.length > s.max_length) return { ok: false, reason: 'too_long' };

    const mutedUntil = await repo.getMute(user.id);
    if (mutedUntil) return { ok: false, reason: 'muted', mutedUntil };

    const hit = rules.check(message, { terms: await repo.getTerms() });
    if (hit) return blocked(user, message, s, { ...hit, source: 'rule' });

    if (!s.ai_enabled) return { ok: true, text: message };
    const today = dayOf(now());
    if (aiDay !== today) { aiDay = today; aiCalls = 0; }
    if (aiCalls >= s.ai_daily_limit) {
      log.warn(`[game-chat] AI daily limit (${s.ai_daily_limit}) reached: typed messages wait for tomorrow.`);
      return { ok: false, reason: 'unavailable' };
    }
    aiCalls += 1;
    let verdict;
    try {
      verdict = await moderate(message, { rules: s.custom_rules });
    } catch (err) {
      log.warn(`[game-chat] AI moderation unavailable (${err.code || err.message}): message blocked.`);
      return { ok: false, reason: 'unavailable' };
    }
    if (!verdict.allowed) {
      const detail = verdict.rule ? `regola ${verdict.rule}: ${s.custom_rules[verdict.rule - 1] || ''}` : null;
      return blocked(user, message, s, { category: verdict.category, source: 'ai', detail });
    }
    return { ok: true, text: message };
  }

  /** What the game needs to show the text box: { freeText, maxLength }. */
  async function config() {
    const s = await repo.getSettings();
    return { freeText: s.free_text_enabled, maxLength: s.max_length };
  }

  return { check, config, cleanMessage };
}

module.exports = { createChatModerator, cleanMessage };
