// CardBrix the game: movement/collision rules (client/src/lib/game/gameMap.js), engine-free.
const {
  WORLD, FOOT, SPAWN, BUILDINGS, PLACES, CREDITS_PLACE, BLOCKED, doorCentre, TREES, WALK_SPEED, footRect, overlaps, moveWithCollision, doorAt,
  facingFor, stepToward, keyVector,
} = require('../client/src/lib/game/gameMap');

describe('map layout', () => {
  test('the spawn point is free and not in front of a door', () => {
    expect(BLOCKED.some((r) => overlaps(footRect(SPAWN), r))).toBe(false);
    expect(doorAt(SPAWN)).toBeNull();
  });

  test('four buildings, one per pillar, each linking to a real section', () => {
    expect(BUILDINGS.map((b) => b.id)).toEqual(['listings', 'auctions', 'arena', 'catalog']);
    expect(BUILDINGS.map((b) => b.path)).toEqual(['/annunci', '/aste', '/skill-zone', '/catalog']);
    expect(BUILDINGS.map((b) => b.color)).toEqual(['#c6ff3d', '#ff5a36', '#8b5cf6', '#3b82f6']);
  });

  test('the credits fountain is a place too, with its own reachable door zone', () => {
    expect(PLACES).toHaveLength(5);
    expect(PLACES[4]).toBe(CREDITS_PLACE);
    const c = doorCentre(CREDITS_PLACE);
    expect(BLOCKED.some((r) => overlaps(footRect({ x: c.x, y: c.y + 2 }), r))).toBe(false);
    expect(doorAt({ x: c.x, y: c.y + 2 })).toBe(CREDITS_PLACE);
  });

  test('every door zone is reachable: free of obstacles and inside the world', () => {
    for (const b of PLACES) {
      const centre = { x: b.door.x + b.door.w / 2, y: b.door.y + b.door.h };
      expect(BLOCKED.some((r) => overlaps(footRect(centre), r))).toBe(false);
      expect(centre.y).toBeLessThanOrEqual(WORLD.h);
    }
  });

  test('buildings fit in the world and do not overlap each other', () => {
    for (const b of BUILDINGS) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(WORLD.w);
    }
    expect(overlaps(BUILDINGS[0], BUILDINGS[1])).toBe(false);
    expect(overlaps(BUILDINGS[1], BUILDINGS[2])).toBe(false);
    expect(overlaps(BUILDINGS[2], BUILDINGS[3])).toBe(false);
  });

  test('trees are inside the world', () => {
    expect(TREES.length).toBeGreaterThan(5);
    for (const t of TREES) {
      expect(t.x).toBeGreaterThan(0);
      expect(t.x).toBeLessThan(WORLD.w);
      expect(t.y).toBeGreaterThan(0);
      expect(t.y).toBeLessThanOrEqual(WORLD.h);
    }
  });
});

describe('moveWithCollision', () => {
  test('moves freely in open ground', () => {
    expect(moveWithCollision({ x: 240, y: 250 }, 3, -2)).toEqual({ x: 243, y: 248 });
  });

  test('cannot walk into a building', () => {
    const b = BUILDINGS[0];
    const below = { x: b.x + 4, y: b.y + b.h + FOOT.h };
    const next = moveWithCollision(below, 0, -10);
    expect(next.y).toBeGreaterThanOrEqual(b.y + b.h + FOOT.h);
  });

  test('slides along a wall instead of stopping dead', () => {
    const b = BUILDINGS[0];
    const below = { x: b.x + 10, y: b.y + b.h + FOOT.h };
    const next = moveWithCollision(below, 5, -5);
    expect(next.x).toBe(below.x + 5); // x still advances
    expect(next.y).toBe(below.y); // y blocked by the wall
  });

  test('is kept inside the world bounds', () => {
    expect(moveWithCollision({ x: 9, y: 200 }, -50, 0).x).toBeGreaterThanOrEqual(8);
    expect(moveWithCollision({ x: 300, y: WORLD.h - 5 }, 0, 50).y).toBeLessThanOrEqual(WORLD.h);
  });
});

describe('doorAt', () => {
  test('detects each door and nothing elsewhere', () => {
    for (const b of PLACES) {
      const p = { x: b.door.x + b.door.w / 2, y: b.door.y + b.door.h };
      expect(doorAt(p)).toBe(b);
    }
    expect(doorAt({ x: 5, y: 300 })).toBeNull();
  });
});

describe('facingFor / keyVector / stepToward', () => {
  test('picks the dominant axis and mirrors left', () => {
    expect(facingFor(5, 1)).toEqual({ dir: 'side', flip: false });
    expect(facingFor(-5, 1)).toEqual({ dir: 'side', flip: true });
    expect(facingFor(0, -3)).toEqual({ dir: 'up', flip: false });
    expect(facingFor(0, 3)).toEqual({ dir: 'down', flip: false });
  });

  test('keeps the previous facing when standing still', () => {
    const prev = { dir: 'side', flip: true };
    expect(facingFor(0, 0, prev)).toBe(prev);
  });

  test('diagonal key input is normalised to unit length', () => {
    const v = keyVector({ right: true, down: true });
    expect(Math.hypot(v.dx, v.dy)).toBeCloseTo(1, 5);
    expect(keyVector({ left: true, right: true })).toEqual({ dx: 0, dy: 0 });
  });

  test('walking toward a target never overshoots and arrives', () => {
    let pos = { x: 0, y: 0 };
    const target = { x: 30, y: 40 };
    let arrived = false;
    for (let i = 0; i < 400 && !arrived; i++) {
      const s = stepToward(pos, target, WALK_SPEED, 1 / 60);
      pos = { x: pos.x + s.dx, y: pos.y + s.dy };
      arrived = s.arrived;
    }
    expect(arrived).toBe(true);
    expect(Math.hypot(pos.x - target.x, pos.y - target.y)).toBeLessThan(2);
  });
});
