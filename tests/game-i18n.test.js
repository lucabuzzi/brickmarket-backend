// Every text the game world shows for a place must exist in all five languages (the map file only holds ids),
// so no player ever sees a raw key like "game.places_info.listings.title".
const { ALL_PLACES: PLACES } = require('../client/src/lib/game/maps');

const LANGS = ['it', 'en', 'es', 'fr', 'de'];
const locales = Object.fromEntries(LANGS.map((l) => [l, require(`../client/src/locales/${l}.json`)]));

describe.each(LANGS)('%s', (lang) => {
  const game = locales[lang].game;

  test('every place has a title, a subtitle and a flavour line', () => {
    // NPCs standing alone are places too: their name / role / lines are checked in game-npcs.test.js
    for (const p of PLACES.filter((x) => x.kind !== 'npc')) {
      for (const field of ['title', 'subtitle', 'flavour']) {
        expect(typeof game.places_info[p.id][field]).toBe('string');
        expect(game.places_info[p.id][field].trim().length).toBeGreaterThan(2);
      }
    }
  });

  test('the auction text states the real anti-sniping rule (2 minutes) and the puzzle text the real size (16)', () => {
    expect(game.places_info.auctions.subtitle).toMatch(/2/);
    expect(game.places_info.arena.subtitle).toMatch(/16/);
  });
});
