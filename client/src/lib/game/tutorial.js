// "CardBrix the game" tutorial: a short guided tour of what the site offers. Pure state machine + storage
// helpers (storage is injected) so it is unit-testable (tests/game-tutorial.test.js); the React layer only
// renders what this says. The tour never grants anything (no credits, no rewards).
//
// Flow: a welcome card -> for each place: the guide arrow points at it ('walk'), and when the character
// reaches its door the explanation card opens ('explain') -> a closing card.

// `speaker` is the NPC (config/gameNpcs.json) who tells that step: the guide opens and closes the tour, every
// stop is explained by whoever keeps the place.
export const TUTORIAL_STEPS = [
  { id: 'welcome', place: null, speaker: 'guide' },
  { id: 'listings', place: 'listings', speaker: 'guide' },
  { id: 'auctions', place: 'auctions', speaker: 'auctioneer' },
  { id: 'arena', place: 'arena', speaker: 'referee' },
  { id: 'catalog', place: 'catalog', speaker: 'archivist' },
  { id: 'credits', place: 'credits', speaker: 'dragon' },
  { id: 'finish', place: null, speaker: 'guide' },
];

export const PLACE_STEP_COUNT = TUTORIAL_STEPS.filter((s) => s.place).length;

export function startTutorial() {
  return { active: true, finished: false, index: 0, phase: 'explain' };
}

export function currentStep(state) {
  return state.active ? TUTORIAL_STEPS[state.index] : null;
}

/** The place the guide arrow should point at right now, or null. */
export function guideTarget(state) {
  const step = currentStep(state);
  return step && step.place && state.phase === 'walk' ? step.place : null;
}

/** { done, total } over the place steps, for a "2 / 5" indicator. */
export function progress(state) {
  const placeSteps = TUTORIAL_STEPS.slice(0, state.index + (state.phase === 'explain' ? 1 : 0)).filter((s) => s.place);
  return { done: Math.min(placeSteps.length, PLACE_STEP_COUNT), total: PLACE_STEP_COUNT };
}

/**
 * actions: { type: 'arrive', placeId } | { type: 'next' } | { type: 'skip' } | { type: 'restart' }
 * Unknown / out-of-order actions leave the state untouched (e.g. standing at the wrong door).
 */
export function tutorialReducer(state, action) {
  switch (action.type) {
    case 'restart':
      return startTutorial();
    case 'skip':
      return state.active ? { ...state, active: false } : state;
    case 'arrive': {
      const step = currentStep(state);
      if (!step || state.phase !== 'walk' || step.place !== action.placeId) return state;
      return { ...state, phase: 'explain' };
    }
    case 'next': {
      if (!state.active || state.phase !== 'explain') return state;
      const nextIndex = state.index + 1;
      if (nextIndex >= TUTORIAL_STEPS.length) return { ...state, active: false, finished: true };
      return { ...state, index: nextIndex, phase: TUTORIAL_STEPS[nextIndex].place ? 'walk' : 'explain' };
    }
    default:
      return state;
  }
}

const KEY_PREFIX = 'cardbrix_game_tutorial_done:';

/** Storage can throw (private mode, blocked site data): every access is wrapped. */
function safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

/** First visit of this account (or of an anonymous browser) -> the tour starts by itself. */
export function shouldAutoStart(storage, userId) {
  return !safe(() => storage.getItem(KEY_PREFIX + (userId || 'anon')), null);
}

export function markDone(storage, userId) {
  safe(() => storage.setItem(KEY_PREFIX + (userId || 'anon'), '1'), null);
}

export function clearDone(storage, userId) {
  safe(() => storage.removeItem(KEY_PREFIX + (userId || 'anon')), null);
}
