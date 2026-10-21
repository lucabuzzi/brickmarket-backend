// Walking to a place around obstacles (client/src/lib/game/pathfind.js): from every spawn of every map, the path
// to every door, followed with the same movement rules as the scene, really ends in that door zone.
const { findPath, clearLine } = require('../client/src/lib/game/pathfind');
const { moveWithCollision, doorAt, doorCentre, WALK_SPEED } = require('../client/src/lib/game/gameMap');
const { MAPS, MAP_IDS } = require('../client/src/lib/game/maps');

/** Follows `path` like the scene does (stepToward at walking speed, sliding collisions); returns the end point. */
function walk(map, from, path) {
  let pos = { ...from };
  for (const wp of path) {
    for (let i = 0; i < 2000; i++) {
      const vx = wp.x - pos.x;
      const vy = wp.y - pos.y;
      const d = Math.hypot(vx, vy);
      if (d <= 1.5) break;
      const step = Math.min(d, WALK_SPEED / 60);
      const next = moveWithCollision(pos, (vx / d) * step, (vy / d) * step, map.blocked, map.world);
      if (next.x === pos.x && next.y === pos.y) return pos; // stuck
      pos = next;
    }
  }
  return pos;
}

describe.each(MAP_IDS)('%s', (id) => {
  const map = MAPS[id];
  test.each(Object.keys(map.spawns))('from spawn %s every door is reached', (spawn) => {
    const from = map.spawns[spawn];
    for (const place of map.places) {
      const path = findPath(from, doorCentre(place), map.blocked, map.world);
      if (!path.length) throw new Error(`no path ${spawn} -> ${place.id}`);
      const end = walk(map, from, path);
      const door = doorAt(end, map.places);
      if (!door || door.id !== place.id) throw new Error(`${spawn} -> ${place.id} ended at ${JSON.stringify(end)} (${door && door.id})`);
    }
  });
});

test('a straight, free line is a single leg; an unreachable target gives no path', () => {
  const map = MAPS.plaza;
  expect(findPath({ x: 240, y: 262 }, { x: 240, y: 280 }, map.blocked, map.world)).toEqual([{ x: 240, y: 280 }]);
  const walled = [{ x: 100, y: 100, w: 60, h: 4 }, { x: 100, y: 140, w: 60, h: 4 }, { x: 100, y: 100, w: 4, h: 44 }, { x: 156, y: 100, w: 4, h: 44 }];
  expect(findPath({ x: 40, y: 40 }, { x: 130, y: 125 }, walled, map.world)).toEqual([]);
  expect(clearLine({ x: 40, y: 40 }, { x: 200, y: 40 }, walled, map.world)).toBe(true);
  expect(clearLine({ x: 130, y: 60 }, { x: 130, y: 125 }, walled, map.world)).toBe(false);
});
