// "CardBrix the game": map layout and movement rules, kept free of any rendering/engine code so they are
// unit-testable (tests/game-map.test.js). gameScene.js draws this layout with Kaplay.
export const WORLD = { w: 480, h: 320 };
export const FOOT = { w: 8, h: 4 }; // the character's collision box, bottom-centred on its position
export const SPAWN = { x: 240, y: 262 };
export const WALK_SPEED = 62; // world px per second

// Pillar colours (src/config/pillars.js): Annunci lime, Aste orange, Puzzle Arena violet, Catalogo blue.
// `path` is the real page of the site the building stands for.
export const BUILDINGS = [
  { id: 'listings', x: 28, y: 22, w: 88, h: 66, color: '#c6ff3d', path: '/annunci' },
  { id: 'auctions', x: 140, y: 22, w: 88, h: 66, color: '#ff5a36', path: '/aste' },
  { id: 'arena', x: 252, y: 22, w: 88, h: 66, color: '#8b5cf6', path: '/skill-zone' },
  { id: 'catalog', x: 364, y: 22, w: 88, h: 66, color: '#3b82f6', path: '/catalog' },
].map((b) => ({ ...b, door: { x: b.x + 28, y: b.y + b.h, w: 32, h: 14 } }));

// The dragon statue in the middle of the plaza (base = its pile of coins; the sprite rises above it).
export const STATUE_SCALE = 1.5; // the 52x48 dragon sprite is shown 1.5x bigger
const STATUE = { x: 214, y: 168, w: 52, h: 16 };
const POND = { x: 24, y: 214, w: 76, h: 52 };

// The dragon statue: where the tutorial explains credits. Not a building, but it has a "door" zone like one,
// so the same enter/explain logic applies.
export const CREDITS_PLACE = {
  id: 'credits', ...STATUE, color: '#22d3ee', path: '/crediti',
  door: { x: STATUE.x, y: STATUE.y + STATUE.h, w: STATUE.w, h: 12 },
};

// Walkable paved areas (drawn as brick paving): the main road, a lane from every door, the plaza and the way
// south to the spawn point. Purely visual - collisions come from BLOCKED only.
export const PATHS = [
  { x: 60, y: 128, w: 360, h: 16 },
  ...BUILDINGS.map((b) => ({ x: b.door.x + b.door.w / 2 - 9, y: b.y + b.h, w: 18, h: 128 - (b.y + b.h) + 1 })),
  { x: 184, y: 144, w: 112, h: 66 },
  { x: 184, y: 208, w: 112, h: 56 },
  { x: 228, y: 262, w: 24, h: 40 },
];

export const PLACES = [...BUILDINGS, CREDITS_PLACE];

// Deterministic tree line (trunk collision boxes) along the borders; no randomness so every client agrees.
export const TREES = [
  ...[0, 1, 2, 3, 4].map((i) => ({ x: 18 + i * 14, y: 292 })),
  ...[0, 1, 2, 3, 4].map((i) => ({ x: 392 + i * 14, y: 292 })),
  { x: 14, y: 110 }, { x: 14, y: 150 }, { x: 466, y: 120 }, { x: 466, y: 168 },
  { x: 120, y: 190 }, { x: 360, y: 190 }, { x: 150, y: 236 }, { x: 330, y: 236 },
].map((t) => ({ ...t, box: { x: t.x - 3, y: t.y - 4, w: 6, h: 4 } }));

export const BLOCKED = [
  ...BUILDINGS.map(({ x, y, w, h }) => ({ x, y, w, h })),
  STATUE,
  POND,
  ...TREES.map((t) => t.box),
];
export const DECOR = { statue: STATUE, pond: POND };

const BOUNDS = { minX: 8, maxX: WORLD.w - 8, minY: 14, maxY: WORLD.h - 4 };

export function footRect(pos) {
  return { x: pos.x - FOOT.w / 2, y: pos.y - FOOT.h, w: FOOT.w, h: FOOT.h };
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function blockedAt(pos, blocked) {
  const f = footRect(pos);
  return blocked.some((r) => overlaps(f, r));
}

function clampPos(pos) {
  return {
    x: Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, pos.x)),
    y: Math.min(BOUNDS.maxY, Math.max(BOUNDS.minY, pos.y)),
  };
}

/** Moves by (dx, dy), sliding along obstacles: each axis is tried on its own. Returns the new position. */
export function moveWithCollision(pos, dx, dy, blocked = BLOCKED) {
  let next = { ...pos };
  const tryX = clampPos({ x: pos.x + dx, y: pos.y });
  if (!blockedAt(tryX, blocked)) next = tryX;
  const tryY = clampPos({ x: next.x, y: pos.y + dy });
  if (!blockedAt(tryY, blocked)) next = tryY;
  return next;
}

/** The place (building or fountain) whose door zone the character stands in, or null. */
export function doorAt(pos, places = PLACES) {
  const f = footRect(pos);
  return places.find((b) => overlaps(f, b.door)) || null;
}

/** Centre of a place's door zone: where the guide arrow points. */
export function doorCentre(place) {
  return { x: place.door.x + place.door.w / 2, y: place.door.y + place.door.h / 2 };
}

/** 'down' | 'up' | 'side' + whether to mirror the side sprite (walking left). */
export function facingFor(dx, dy, previous = { dir: 'down', flip: false }) {
  if (dx === 0 && dy === 0) return previous;
  if (Math.abs(dx) > Math.abs(dy)) return { dir: 'side', flip: dx < 0 };
  return { dir: dy < 0 ? 'up' : 'down', flip: false };
}

/** One tick of walking toward `target`: the (dx, dy) to apply, or zeros once within `stopAt` px. */
export function stepToward(pos, target, speed, dt, stopAt = 1.5) {
  const vx = target.x - pos.x;
  const vy = target.y - pos.y;
  const dist = Math.hypot(vx, vy);
  if (dist <= stopAt) return { dx: 0, dy: 0, arrived: true };
  const step = Math.min(dist, speed * dt);
  return { dx: (vx / dist) * step, dy: (vy / dist) * step, arrived: false };
}

/** Keyboard direction vector (-1..1 per axis, diagonal normalised). */
export function keyVector({ left, right, up, down }) {
  const dx = (right ? 1 : 0) - (left ? 1 : 0);
  const dy = (down ? 1 : 0) - (up ? 1 : 0);
  if (dx !== 0 && dy !== 0) return { dx: dx * Math.SQRT1_2, dy: dy * Math.SQRT1_2 };
  return { dx, dy };
}
