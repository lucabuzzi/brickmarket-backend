// "CardBrix the game": what the player has already been told. A short explanation shows the first time an area is
// visited (a map, a keeper's greeting) and never again for that account on this browser. Storage is injected and
// may throw (private mode, blocked site data): then nothing is remembered, and nothing breaks.
// Pure, unit-tested in tests/game-first-visit.test.js.

const KEY_PREFIX = 'cardbrix_game_seen:';
const MAX_ENTRIES = 100;

/** The map intros that exist (the plaza has the guided tour instead). */
export const MAP_INTROS = ['market'];

function read(storage, userId) {
  try {
    const list = JSON.parse(storage.getItem(KEY_PREFIX + (userId || 'anon')) || '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** True when `area` (e.g. 'map:market', 'greet:auctioneer') was already explained to this account. */
export function hasSeen(storage, userId, area) {
  return read(storage, userId).includes(area);
}

/** Remembers that `area` was explained. */
export function markSeen(storage, userId, area) {
  const list = read(storage, userId);
  if (list.includes(area)) return;
  try {
    storage.setItem(KEY_PREFIX + (userId || 'anon'), JSON.stringify([...list, area].slice(-MAX_ENTRIES)));
  } catch { /* blocked: the explanation may show again, which is harmless */ }
}

/** Forgets every explanation (used by "restart the tutorial", so the whole tour of the world starts over). */
export function clearSeen(storage, userId) {
  try { storage.removeItem(KEY_PREFIX + (userId || 'anon')); } catch { /* blocked */ }
}
