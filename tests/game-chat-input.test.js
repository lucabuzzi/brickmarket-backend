// Typed messages in the plaza chat, client side (client/src/lib/game/chatInput.js): when the box may send, which
// message a refusal shows (in every locale), and how a typed text fits a speech bubble. Pure: no React, no socket.
const { canSend, refusalMessage, bubbleText, BLOCK_CATEGORIES, REFUSAL_REASONS } = require('../client/src/lib/game/chatInput.js');
const { CATEGORIES } = require('../src/services/chatModeration/aiModerator');

const LOCALES = ['it', 'en', 'es', 'fr', 'de'];
const ON = { freeText: true, maxLength: 140 };

describe('sending', () => {
  test('only with typing switched on, something to say, within the length', () => {
    expect(canSend('ciao', ON)).toBe(true);
    expect(canSend('   ', ON)).toBe(false);
    expect(canSend('x'.repeat(141), ON)).toBe(false);
    expect(canSend(` ${'x'.repeat(140)} `, ON)).toBe(true);
    expect(canSend('ciao', { freeText: false, maxLength: 140 })).toBe(false);
    expect(canSend('ciao', null)).toBe(false);
  });
});

describe('refusals', () => {
  test('a block names its category; one that also muted says until when', () => {
    expect(refusalMessage({ reason: 'blocked', category: 'phone' })).toEqual({ key: 'game.chat.refused.blocked.phone', vars: {} });
    const r = refusalMessage({ reason: 'blocked', category: 'insult', until: '2026-10-22T12:15:00.000Z' }, 'it');
    expect(r.key).toBe('game.chat.refused.blocked.insult');
    expect(r.muted.time).toMatch(/\d{2}[:.]15/);
  });
  test('muted, and the other reasons', () => {
    expect(refusalMessage({ reason: 'muted', until: '2026-10-22T12:15:00.000Z' }, 'en').key).toBe('game.chat.refused.muted');
    for (const reason of ['disabled', 'hidden', 'cooldown', 'empty', 'too_long', 'unavailable']) {
      expect(refusalMessage({ reason })).toEqual({ key: `game.chat.refused.${reason}`, vars: {} });
    }
  });
  test('anything unknown falls back to a message that exists', () => {
    expect(refusalMessage({ reason: 'weird' }).key).toBe('game.chat.refused.unavailable');
    expect(refusalMessage({ reason: 'blocked', category: 'weird' }).key).toBe('game.chat.refused.blocked.insult');
    expect(refusalMessage(null).key).toBe('game.chat.refused.unavailable');
  });
  test('the client knows every category the server can send', () => {
    const server = [...CATEGORIES.filter((c) => c !== 'ok'), 'link', 'phone', 'email', 'banned_word'];
    expect([...BLOCK_CATEGORIES].sort()).toEqual([...new Set(server)].sort());
  });
});

describe('speech bubbles', () => {
  test('short texts as they are, long ones cut with an ellipsis, emojis count as one', () => {
    expect(bubbleText('ciao a tutti')).toBe('ciao a tutti');
    expect(bubbleText('a'.repeat(40))).toBe(`${'a'.repeat(31)}…`);
    expect(Array.from(bubbleText('🔥'.repeat(40))).length).toBe(32);
  });
  test('square brackets cannot become styling tags of the game engine', () => {
    expect(bubbleText('[red]ciao[/red]')).toBe('(red)ciao(/red)');
  });
});

describe('strings', () => {
  test.each(LOCALES)('%s has the typed-chat strings', (lng) => {
    const chat = require(`../client/src/locales/${lng}.json`).game.chat;
    for (const k of ['placeholder', 'send', 'show_phrases', 'show_keyboard', 'empty_typed']) expect(chat[k]).toBeTruthy();
    for (const r of REFUSAL_REASONS.filter((x) => x !== 'blocked')) expect(chat.refused[r]).toBeTruthy();
    for (const c of BLOCK_CATEGORIES) expect(chat.refused.blocked[c]).toBeTruthy();
    expect(chat.refused.muted).toContain('{{time}}');
    expect(chat.refused.now_muted).toContain('{{time}}');
    expect(chat.empty_typed).toContain('Gemini');
  });

  test.each(LOCALES)('%s privacy policy covers the typed chat: Gemini, legal basis, retention of blocked messages', (lng) => {
    const p = require(`../client/src/locales/${lng}.json`).privacy;
    expect(p.s4_body).toMatch(/Gemini/);
    expect(p.s5_body).toMatch(/6\.1\.f|6 Abs\. 1 lit\. f/);
    expect(p.s7_body.split('\n').find((l) => l.includes('Gemini'))).toMatch(/chat/i);
    expect(p.s9_body).toMatch(/30/);
  });
});
