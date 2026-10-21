// First-visit explanations of the game (client/src/lib/game/firstVisit.js) and who tells the tour
// (client/src/lib/game/tutorial.js speakers): shown once per account, harmless when storage is blocked, and every
// text exists in all five languages.
const { MAP_INTROS, hasSeen, markSeen, clearSeen } = require('../client/src/lib/game/firstVisit');
const { TUTORIAL_STEPS } = require('../client/src/lib/game/tutorial');
const { NPCS, npcById, npcForPlace } = require('../client/src/lib/game/npcs');
const { MAP_IDS } = require('../client/src/lib/game/maps');

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };

test('an area is explained once per account', () => {
  const s = memoryStorage();
  expect(hasSeen(s, 7, 'map:market')).toBe(false);
  markSeen(s, 7, 'map:market');
  markSeen(s, 7, 'map:market');
  expect(hasSeen(s, 7, 'map:market')).toBe(true);
  expect(JSON.parse(s.getItem('cardbrix_game_seen:7'))).toEqual(['map:market']);
  expect(hasSeen(s, 8, 'map:market')).toBe(false); // another account on the same browser
  expect(hasSeen(s, null, 'map:market')).toBe(false);
  clearSeen(s, 7);
  expect(hasSeen(s, 7, 'map:market')).toBe(false);
});

test('blocked or corrupted storage never throws', () => {
  expect(hasSeen(blocked, 1, 'x')).toBe(false);
  expect(() => markSeen(blocked, 1, 'x')).not.toThrow();
  expect(() => clearSeen(blocked, 1)).not.toThrow();
  const s = memoryStorage();
  s.setItem('cardbrix_game_seen:1', '{oops');
  expect(hasSeen(s, 1, 'x')).toBe(false);
  s.setItem('cardbrix_game_seen:1', '{"a":1}');
  markSeen(s, 1, 'x');
  expect(hasSeen(s, 1, 'x')).toBe(true);
});

test('the list stays bounded', () => {
  const s = memoryStorage();
  for (let i = 0; i < 150; i++) markSeen(s, 1, `a${i}`);
  expect(JSON.parse(s.getItem('cardbrix_game_seen:1'))).toHaveLength(100);
  expect(hasSeen(s, 1, 'a149')).toBe(true);
});

test('map intros exist only for real maps (the plaza has the guided tour)', () => {
  for (const id of MAP_INTROS) expect(MAP_IDS).toContain(id);
  expect(MAP_INTROS).not.toContain('plaza');
});

test('every tour step is told by an NPC; a stop is told by whoever keeps it (the guide for the castle)', () => {
  for (const s of TUTORIAL_STEPS) {
    expect(npcById(s.speaker)).not.toBeNull();
    if (s.place) {
      const keeper = npcForPlace('plaza', s.place);
      expect(s.speaker).toBe(keeper ? keeper.id : 'guide');
    }
  }
});

describe.each(['it', 'en', 'es', 'fr', 'de'])('texts (%s)', (lang) => {
  const game = require(`../client/src/locales/${lang}.json`).game;
  test('every drawn NPC has a short greeting; every map intro has a title, a body and the button', () => {
    for (const n of NPCS.filter((x) => x.avatar)) {
      expect(typeof game.npcs[n.id].greet).toBe('string');
      expect(game.npcs[n.id].greet.length).toBeLessThanOrEqual(34); // it is a speech bubble over a head
    }
    for (const id of MAP_INTROS) {
      expect(game.intro[id].title.length).toBeGreaterThan(3);
      expect(game.intro[id].body.length).toBeGreaterThan(20);
    }
    expect(typeof game.intro.ok).toBe('string');
  });
});
