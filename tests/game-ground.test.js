// "CardBrix the game" ground painter (client/src/lib/game/groundSprite.js): deterministic decorations that stay
// off the paths/obstacles/stalls, and a paint pass that never draws outside the world.
const { WORLD, PATHS, BLOCKED, BUILDINGS, PLACES, overlaps } = require('../client/src/lib/game/gameMap');
const { brickDecor, flowers, paintGround, buildGroundCanvas, BRICK_COLORS } = require('../client/src/lib/game/groundSprite');

const inside = (x, y) => PATHS.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);

describe('paths', () => {
  test('every place door is on a paved path', () => {
    for (const place of PLACES) {
      expect(inside(place.door.x + place.door.w / 2, place.door.y + place.door.h / 2)).toBe(true);
    }
  });

  test('the spawn lane reaches the plaza (paths form one connected network)', () => {
    // flood over rects that touch/overlap, starting from the first path
    const seen = new Set([0]);
    let grew = true;
    const touch = (a, b) => a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
    while (grew) {
      grew = false;
      PATHS.forEach((p, i) => {
        if (!seen.has(i) && [...seen].some((j) => touch(p, PATHS[j]))) { seen.add(i); grew = true; }
      });
    }
    expect(seen.size).toBe(PATHS.length);
  });
});

describe('decorations', () => {
  test('are deterministic', () => {
    expect(brickDecor()).toEqual(brickDecor());
    expect(flowers()).toEqual(flowers());
  });

  test('there are plenty of loose bricks, in the four brick colours, inside the world', () => {
    const bricks = brickDecor();
    expect(bricks.length).toBeGreaterThanOrEqual(18);
    for (const b of bricks) {
      expect(BRICK_COLORS).toContain(b.color);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(WORLD.w);
      expect(b.y + b.h).toBeLessThanOrEqual(WORLD.h);
    }
  });

  test('bricks and flowers never lie on paths, obstacles or stalls, nor on each other', () => {
    const bricks = brickDecor();
    for (const b of bricks) {
      for (const r of [...PATHS, ...BLOCKED, ...BUILDINGS]) expect(overlaps(b, r)).toBe(false);
    }
    for (let i = 0; i < bricks.length; i++) for (let j = i + 1; j < bricks.length; j++) expect(overlaps(bricks[i], bricks[j])).toBe(false);
    for (const f of flowers()) {
      expect(inside(f.x, f.y)).toBe(false);
      for (const r of BLOCKED) expect(overlaps({ x: f.x, y: f.y, w: 1, h: 1 }, r)).toBe(false);
    }
  });
});

describe('paintGround', () => {
  function record() {
    const rects = [];
    return { rects, fillStyle: '', fillRect(x, y, w, h) { rects.push({ x, y, w, h, c: this.fillStyle }); } };
  }

  test('only draws inside the world', () => {
    const ctx = record();
    paintGround(ctx);
    expect(ctx.rects.length).toBeGreaterThan(1000);
    for (const r of ctx.rects) {
      if (r.w <= 0 || r.h <= 0) throw new Error(`empty rect ${JSON.stringify(r)}`);
      // the pond frame / path edges may poke 1-6px past nothing: they stay inside the world too
      if (!(r.x >= 0 && r.y >= 0 && r.x + r.w <= WORLD.w && r.y + r.h <= WORLD.h)) throw new Error(`outside the world: ${JSON.stringify(r)}`);
    }
  });

  test('is deterministic', () => {
    const a = record();
    const b = record();
    paintGround(a);
    paintGround(b);
    expect(a.rects).toEqual(b.rects);
  });

  test('buildGroundCanvas has the world size', () => {
    const fake = { width: 0, height: 0, getContext: () => ({ set fillStyle(_) {}, fillRect() {} }) };
    const c = buildGroundCanvas(() => fake);
    expect([c.width, c.height]).toEqual([WORLD.w, WORLD.h]);
  });
});
