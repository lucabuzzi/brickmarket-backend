// Every fixed plaza phrase / emoji the server accepts must have a label in all five locales,
// and the joystick and inventory panel strings must exist too (otherwise the UI shows raw keys).
const PHRASES = require('../client/src/config/plazaPhrases.json');
const { PLAZA_PHRASES } = require('../src/services/gamePlaza');

const LOCALES = ['it', 'en', 'es', 'fr', 'de'];

describe('plaza chat i18n', () => {
  test('server and client share the same phrase list', () => {
    expect(PLAZA_PHRASES).toBe(PHRASES);
  });

  test.each(LOCALES)('%s has every phrase, emoji label, joystick and panel string', (lng) => {
    const game = require(`../client/src/locales/${lng}.json`).game;
    for (const k of PHRASES.phrases) expect(typeof game.chat.phrases[k]).toBe('string');
    for (const k of Object.keys(PHRASES.emojis)) expect(typeof game.chat.emoji[k]).toBe('string');
    for (const k of ['title', 'say', 'empty', 'hidden_note']) expect(game.chat[k]).toBeTruthy();
    expect(game.joystick.label).toBeTruthy();
    expect(game.inventory.panel_empty).toBeTruthy();
    expect(game.inventory.panel_full).toBeTruthy();
  });
});
