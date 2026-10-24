// "CardBrix the game": walking around obstacles. Tapping an NPC or a building (or "take me there" in a dialogue)
// walks the character to its door along a path found on a coarse grid, then smoothed into a few straight legs.
// Pure, unit-tested in tests/game-pathfind.test.js; movement itself still goes through moveWithCollision.
import { isWalkable } from './gameMap';

const CELL = 4; // world px per grid cell
const MAX_CELLS = 60000; // the whole market (960 x 720) is 43200 cells

// Paths keep this much room from every obstacle: a leg running exactly along the edge of a box would leave the
// character, a rounding error later, with its feet a hair inside the box and stuck.
const MARGIN = 1;
const roomy = (p, blocked, world) => isWalkable(p, blocked, world)
  && isWalkable({ x: p.x - MARGIN, y: p.y }, blocked, world) && isWalkable({ x: p.x + MARGIN, y: p.y }, blocked, world)
  && isWalkable({ x: p.x, y: p.y - MARGIN }, blocked, world) && isWalkable({ x: p.x, y: p.y + MARGIN }, blocked, world);

const snap = (v) => Math.round(v / CELL) * CELL;

/** True when the straight segment a -> b can be walked with some room to spare (sampled every 2 px). */
export function clearLine(a, b, blocked, world) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(dist / 2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!roomy({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, blocked, world)) return false;
  }
  return true;
}

/** The walkable grid point closest to `p` (spiral search), or null. */
function nearestWalkable(p, blocked, world) {
  const sx = snap(p.x);
  const sy = snap(p.y);
  for (let r = 0; r <= 12; r++) {
    let best = null;
    let bestD = Infinity;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const q = { x: sx + dx * CELL, y: sy + dy * CELL };
        if (!roomy(q, blocked, world)) continue;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bestD) { bestD = d; best = q; }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * Waypoints from `from` to `to` (the last one is `to` itself, or the closest walkable spot to it), avoiding
 * `blocked` inside `world`. Returns [] when there is no way (the caller simply does not move).
 */
export function findPath(from, to, blocked, world) {
  if (clearLine(from, to, blocked, world)) return [{ x: to.x, y: to.y }];
  const start = nearestWalkable(from, blocked, world);
  const snapped = { x: snap(to.x), y: snap(to.y) };
  const goal = roomy(snapped, blocked, world) ? snapped : nearestWalkable(to, blocked, world);
  if (!start || !goal) return [];
  const key = (p) => `${p.x},${p.y}`;
  const prev = new Map([[key(start), null]]);
  const queue = [start];
  let head = 0;
  let found = null;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (head < queue.length && prev.size < MAX_CELLS) {
    const c = queue[head++];
    if (c.x === goal.x && c.y === goal.y) { found = c; break; }
    for (const [dx, dy] of dirs) {
      const n = { x: c.x + dx * CELL, y: c.y + dy * CELL };
      const k = key(n);
      if (prev.has(k) || !roomy(n, blocked, world)) continue;
      // no corner cutting: a diagonal step needs both straight neighbours free
      if (dx && dy && (!roomy({ x: c.x + dx * CELL, y: c.y }, blocked, world) || !roomy({ x: c.x, y: c.y + dy * CELL }, blocked, world))) continue;
      prev.set(k, c);
      queue.push(n);
    }
  }
  if (!found) return [];
  const cells = [];
  for (let c = found; c; c = prev.get(key(c))) cells.push(c);
  cells.reverse();
  const end = isWalkable(to, blocked, world) ? { x: to.x, y: to.y } : goal;
  cells.push(end);
  // string pulling: from each point jump to the farthest one still in a straight line
  const out = [];
  let at = from;
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !clearLine(at, cells[j], blocked, world)) j--;
    out.push(cells[j]);
    at = cells[j];
    i = j + 1;
  }
  return out;
}
