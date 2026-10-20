// "CardBrix the game" tutorial state machine (client/src/lib/game/tutorial.js): order of the tour,
// that standing at the wrong door does nothing, skip/finish, and the first-visit storage flag.
const {
  TUTORIAL_STEPS, PLACE_STEP_COUNT, startTutorial, currentStep, guideTarget, progress, tutorialReducer,
  shouldAutoStart, markDone, clearDone,
} = require('../client/src/lib/game/tutorial');
const { PLACES } = require('../client/src/lib/game/gameMap');

const run = (state, ...actions) => actions.reduce(tutorialReducer, state);

describe('tour definition', () => {
  test('every place step points at a real place on the map', () => {
    const ids = PLACES.map((p) => p.id);
    for (const s of TUTORIAL_STEPS.filter((x) => x.place)) expect(ids).toContain(s.place);
  });

  test('visits the four shops and the credits fountain, between a welcome and a closing card', () => {
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual(['welcome', 'listings', 'auctions', 'arena', 'catalog', 'credits', 'finish']);
    expect(PLACE_STEP_COUNT).toBe(5);
  });
});

describe('tutorialReducer', () => {
  test('starts on the welcome card, with no guide arrow', () => {
    const s = startTutorial();
    expect(currentStep(s).id).toBe('welcome');
    expect(guideTarget(s)).toBeNull();
  });

  test('"next" on the welcome card sends the player to the first shop', () => {
    const s = run(startTutorial(), { type: 'next' });
    expect(currentStep(s).id).toBe('listings');
    expect(s.phase).toBe('walk');
    expect(guideTarget(s)).toBe('listings');
  });

  test('arriving at the wrong place does nothing; at the right one opens the explanation', () => {
    const walking = run(startTutorial(), { type: 'next' });
    expect(tutorialReducer(walking, { type: 'arrive', placeId: 'arena' })).toBe(walking);
    const there = tutorialReducer(walking, { type: 'arrive', placeId: 'listings' });
    expect(there.phase).toBe('explain');
    expect(guideTarget(there)).toBeNull();
  });

  test('"next" while still walking is ignored (cannot skip a stop without reaching it)', () => {
    const walking = run(startTutorial(), { type: 'next' });
    expect(tutorialReducer(walking, { type: 'next' })).toBe(walking);
  });

  test('a full run goes through every stop in order and finishes', () => {
    let s = startTutorial();
    s = run(s, { type: 'next' });
    const seen = [];
    for (const id of ['listings', 'auctions', 'arena', 'catalog', 'credits']) {
      expect(guideTarget(s)).toBe(id);
      s = run(s, { type: 'arrive', placeId: id });
      seen.push(currentStep(s).id);
      s = run(s, { type: 'next' });
    }
    expect(seen).toEqual(['listings', 'auctions', 'arena', 'catalog', 'credits']);
    expect(currentStep(s).id).toBe('finish');
    s = run(s, { type: 'next' });
    expect(s.active).toBe(false);
    expect(s.finished).toBe(true);
    expect(currentStep(s)).toBeNull();
  });

  test('skip ends the tour without marking it finished; restart begins again', () => {
    const skipped = run(startTutorial(), { type: 'next' }, { type: 'skip' });
    expect(skipped.active).toBe(false);
    expect(skipped.finished).toBe(false);
    expect(guideTarget(skipped)).toBeNull();
    expect(run(skipped, { type: 'restart' })).toEqual(startTutorial());
  });

  test('unknown actions leave the state untouched', () => {
    const s = startTutorial();
    expect(tutorialReducer(s, { type: 'bogus' })).toBe(s);
  });
});

describe('progress', () => {
  test('counts completed place steps out of five', () => {
    let s = startTutorial();
    expect(progress(s)).toEqual({ done: 0, total: 5 });
    s = run(s, { type: 'next' }, { type: 'arrive', placeId: 'listings' });
    expect(progress(s)).toEqual({ done: 1, total: 5 });
    s = run(s, { type: 'next' });
    expect(progress(s)).toEqual({ done: 1, total: 5 });
  });
});

describe('first-visit flag', () => {
  function fakeStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  }

  test('auto-starts until marked done, per account', () => {
    const st = fakeStorage();
    expect(shouldAutoStart(st, 'u1')).toBe(true);
    markDone(st, 'u1');
    expect(shouldAutoStart(st, 'u1')).toBe(false);
    expect(shouldAutoStart(st, 'u2')).toBe(true);
    clearDone(st, 'u1');
    expect(shouldAutoStart(st, 'u1')).toBe(true);
  });

  test('never throws when storage is blocked', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
    expect(() => markDone(broken, 'u1')).not.toThrow();
    expect(shouldAutoStart(broken, 'u1')).toBe(true);
    expect(() => clearDone(broken, 'u1')).not.toThrow();
  });
});
