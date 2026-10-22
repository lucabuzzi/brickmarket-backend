// Typed messages in the plaza chat (the server moderates them before anyone sees them: see
// src/services/gamePlazaSocket.js and src/services/chatModeration). Pure helpers for the chat panel and the bubbles,
// unit-tested in tests/game-chat-input.test.js.

/** Categories the server may give for a blocked message (keys of game.chat.refused.blocked.*). */
export const BLOCK_CATEGORIES = ['link', 'phone', 'email', 'banned_word', 'blasphemy', 'violence', 'insult', 'contact', 'sexual', 'custom_rule'];
export const REFUSAL_REASONS = ['disabled', 'hidden', 'cooldown', 'empty', 'too_long', 'muted', 'blocked', 'unavailable'];

/** Whether the text box may send `text`: something to say, within the length the server allows. */
export function canSend(text, chat) {
  const s = String(text ?? '').trim();
  return Boolean(chat?.freeText) && s.length > 0 && s.length <= (chat.maxLength || 0);
}

/**
 * The message shown (only to the sender) for a refused message: an i18n key and its values.
 * { t: 'chat_refused', reason, category?, until? } -> { key, vars }
 */
export function refusalMessage(msg, locale) {
  const reason = REFUSAL_REASONS.includes(msg?.reason) ? msg.reason : 'unavailable';
  if (reason === 'blocked') {
    const category = BLOCK_CATEGORIES.includes(msg.category) ? msg.category : 'insult';
    const key = `game.chat.refused.blocked.${category}`;
    return msg.until ? { key, vars: {}, muted: muteVars(msg.until, locale) } : { key, vars: {} };
  }
  if (reason === 'muted') return { key: 'game.chat.refused.muted', vars: muteVars(msg.until, locale) };
  return { key: `game.chat.refused.${reason}`, vars: {} };
}

/** "until 12:15" in the viewer's time and language. */
function muteVars(until, locale) {
  const d = new Date(until);
  if (Number.isNaN(d.getTime())) return { time: '' };
  return { time: d.toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' }) };
}

/**
 * A typed message as drawn in the speech bubble over a character: one short line, and no square brackets (the game
 * engine would read "[...]" as styling tags).
 */
export function bubbleText(text, max = 32) {
  const s = String(text ?? '').replace(/\[/g, '(').replace(/\]/g, ')').replace(/\s+/g, ' ').trim();
  const chars = Array.from(s); // emojis count as one
  return chars.length > max ? `${chars.slice(0, max - 1).join('').trimEnd()}…` : s;
}
