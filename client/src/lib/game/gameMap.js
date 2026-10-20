// "CardBrix the game": map layout and movement rules, kept free of any rendering/engine code so they are
// unit-testable (tests/game-map.test.js). gameScene.js draws this layout with Kaplay. Every text shown to the
// player (titles, flavour lines, easter eggs) lives in the i18n files under game.places_info / game.easter_eggs;
// this file only holds ids, positions and visual styles.
import WORLD_CONFIG from '../../config/gameWorld.json';

export const WORLD = { w: WORLD_CONFIG.w, h: WORLD_CONFIG.h };
export const FOOT = { w: 8, h: 4 }; // the character's collision box, bottom-centred on its position
export const SPAWN = { ...WORLD_CONFIG.spawn };
export const WALK_SPEED = WORLD_CONFIG.walkSpeed; // world px per second

// ============================================================================
// The 4 shops of collecting (one per pillar)
// ============================================================================
// Pillar colours (src/config/pillars.js): Annunci lime, Aste orange, Puzzle Arena violet, Catalogo blue.
// `path` is the real page of the site the building stands for. roofStyle / signIcon pick the roof decoration
// drawn by buildingSprite.js; auraColor is the soft glow in front of the door.
export const BUILDINGS = [
  { id: 'listings', x: 28, y: 22, w: 88, h: 66, color: '#c6ff3d', path: '/annunci', roofStyle: 'lego_studs', signIcon: 'booster', auraColor: '#a3e635' },
  { id: 'auctions', x: 140, y: 22, w: 88, h: 66, color: '#ff5a36', path: '/aste', roofStyle: 'fire', signIcon: 'gavel', auraColor: '#fb923c' },
  { id: 'arena', x: 252, y: 22, w: 88, h: 66, color: '#8b5cf6', path: '/skill-zone', roofStyle: 'cyber_grid', signIcon: 'puzzle', auraColor: '#c084fc' },
  { id: 'catalog', x: 364, y: 22, w: 88, h: 66, color: '#3b82f6', path: '/catalog', roofStyle: 'crystal_dome', signIcon: 'slab', auraColor: '#60a5fa' },
].map((b) => ({ ...b, door: { x: b.x + 28, y: b.y + b.h, w: 32, h: 14 } }));

// ============================================================================
// The dragon statue and the pond
// ============================================================================
// The dragon statue in the middle of the plaza (base = its pile of coins; the sprite rises above it).
export const STATUE_SCALE = 1.5; // the 52x48 dragon sprite is shown 1.5x bigger
const STATUE = { x: 214, y: 168, w: 52, h: 16 };
const POND = { x: 24, y: 214, w: 76, h: 52 };

// The dragon statue: where the tutorial explains credits. Not a building, but it has a "door" zone like one,
// so the same enter/explain logic applies.
export const CREDITS_PLACE = {
  id: 'credits', ...STATUE, color: '#22d3ee', path: '/crediti', auraColor: '#22d3ee',
  door: { x: STATUE.x, y: STATUE.y + STATUE.h, w: STATUE.w, h: 12 },
};

// ============================================================================
// Paving: LEGO baseplates and play mats
// ============================================================================
// Walkable paved areas: the main road, a lane from every door, the plaza and the way south to the spawn point.
// Purely visual - collisions come from BLOCKED only. `style` picks how groundSprite.js paints each one.
export const PATHS = [
  // main road: light grey baseplate with studs
  { x: 60, y: 128, w: 360, h: 16, style: 'lego_road_grey' },
  // the lane in front of each shop: a carpet in the shop's pillar colour
  ...BUILDINGS.map((b) => ({
    x: b.door.x + b.door.w / 2 - 9,
    y: b.y + b.h,
    w: 18,
    h: 128 - (b.y + b.h) + 1,
    style: 'pillar_carpet',
    tint: b.color,
  })),
  // north plaza: a tournament play mat with a summoning circle around the statue
  { x: 184, y: 144, w: 112, h: 66, style: 'tcg_summon_plaza' },
  // south plaza: brick mosaic
  { x: 184, y: 208, w: 112, h: 56, style: 'lego_plaza_mosaic' },
  // the way to the spawn point, with arcade-style neon arrows
  { x: 228, y: 262, w: 24, h: 40, style: 'spawn_runway_neon' },
];

export const PLACES = [...BUILDINGS, CREDITS_PLACE];

// ============================================================================
// Trees: LEGO pines, pixel-art cherry bonsai, glowing "mana" trees
// ============================================================================
// Deterministic tree line (trunk collision boxes) along the borders; no randomness so every client agrees.
export const TREE_VARIANTS = ['bonsai_pink', 'lego_pine', 'bonsai_gold', 'mana_tree_cyan', 'mana_tree_purple'];
export const TREES = [
  ...[0, 1, 2, 3, 4].map((i) => ({ x: 18 + i * 14, y: 292, variant: i % 2 === 0 ? 'bonsai_pink' : 'lego_pine' })),
  ...[0, 1, 2, 3, 4].map((i) => ({ x: 392 + i * 14, y: 292, variant: i % 2 === 0 ? 'lego_pine' : 'bonsai_pink' })),
  { x: 14, y: 110, variant: 'bonsai_gold' }, { x: 14, y: 150, variant: 'lego_pine' },
  { x: 466, y: 120, variant: 'bonsai_gold' }, { x: 466, y: 168, variant: 'lego_pine' },
  { x: 120, y: 190, variant: 'bonsai_pink' }, { x: 360, y: 190, variant: 'bonsai_pink' },
  { x: 150, y: 236, variant: 'mana_tree_cyan' }, { x: 330, y: 236, variant: 'mana_tree_purple' },
].map((t) => ({ ...t, box: { x: t.x - 3, y: t.y - 4, w: 6, h: 4 } }));

// ============================================================================
// Collector props around the plaza
// ============================================================================
// (x, y) is the bottom-centre point of each prop (what it stands on, also its draw order); w/h its drawn size.
// Upright props block only a thin strip at their base (you can walk "behind" them), flat ones their whole
// surface; the spawn pad is just painted on the floor.
export const PROPS = [
  // graded card slabs on pedestals at the sides of the plaza
  { id: 'slab_left', type: 'graded_slab', x: 166, y: 166, w: 12, h: 22, color: '#ffd23f', cardColor: '#ef4444', solid: 'base' },
  { id: 'slab_right', type: 'graded_slab', x: 314, y: 166, w: 12, h: 22, color: '#ffd23f', cardColor: '#3b82f6', solid: 'base' },
  // card duel tables with two facing play mats
  { id: 'duel_table_west', type: 'tcg_table', x: 122, y: 174, w: 28, h: 18, p1Color: '#c6ff3d', p2Color: '#8b5cf6', solid: 'full' },
  { id: 'duel_table_east', type: 'tcg_table', x: 358, y: 174, w: 28, h: 18, p1Color: '#ff5a36', p2Color: '#3b82f6', solid: 'full' },
  // booster pack vending machines between the shops
  { id: 'vending_1', type: 'booster_vending', x: 128, y: 74, w: 14, h: 22, color: '#f43f5e', solid: 'base' },
  { id: 'vending_2', type: 'booster_vending', x: 352, y: 74, w: 14, h: 22, color: '#10b981', solid: 'base' },
  // giant 2x4 bricks used as benches on the south plaza
  { id: 'brick_bench_1', type: 'giant_lego_brick', x: 200, y: 250, w: 16, h: 8, color: '#eab308', solid: 'full' },
  { id: 'brick_bench_2', type: 'giant_lego_brick', x: 280, y: 250, w: 16, h: 8, color: '#ec4899', solid: 'full' },
  // glowing welcome pad at the spawn point
  { id: 'spawn_pad', type: 'teleport_pad', x: 240, y: 286, w: 28, h: 10, color: '#22d3ee', solid: 'none' },
];

/** The collision box of a prop, or null when it can be walked over. */
export function propBox(p) {
  if (p.solid === 'full') return { x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h };
  if (p.solid === 'base') return { x: p.x - p.w / 2, y: p.y - 4, w: p.w, h: 4 };
  return null;
}

// Little lore messages that pop up when the character walks near them (texts: game.easter_eggs.<id>).
export const EASTER_EGG_ZONES = [
  { id: 'pond_secret', x: 104, y: 238, r: 18 },
  { id: 'slab_left_lore', x: 166, y: 172, r: 14 },
  { id: 'slab_right_lore', x: 314, y: 172, r: 14 },
  { id: 'duel_west_lore', x: 122, y: 180, r: 14 },
];

export const BLOCKED = [
  ...BUILDINGS.map(({ x, y, w, h }) => ({ x, y, w, h })),
  STATUE,
  POND,
  ...TREES.map((t) => t.box),
  ...PROPS.map(propBox).filter(Boolean),
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

/** True when the character could stand at `pos` (inside the world, not on an obstacle). */
export function isWalkable(pos, blocked = BLOCKED) {
  return pos.x >= BOUNDS.minX && pos.x <= BOUNDS.maxX && pos.y >= BOUNDS.minY && pos.y <= BOUNDS.maxY && !blockedAt(pos, blocked);
}

/** The place (building or statue) whose door zone the character stands in, or null. */
export function doorAt(pos, places = PLACES) {
  const f = footRect(pos);
  return places.find((b) => overlaps(f, b.door)) || null;
}

/** The easter egg zone the character is standing in, or null. */
export function easterEggAt(pos, zones = EASTER_EGG_ZONES) {
  return zones.find((z) => Math.hypot(pos.x - z.x, pos.y - z.y) <= z.r) || null;
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
