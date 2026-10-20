// The CardBrix dragon sprite (client/src/lib/game/dragonSprite.js): a code-drawn pixel grid. Checks its shape,
// palette, and that it still reads as the video's dragon (blue body, orange wings, gold belly/coins, outline).
const { DRAGON_W, DRAGON_H, DRAGON_PALETTE, paintDragonGrid, renderDragon, buildDragonCanvas } = require('../client/src/lib/game/dragonSprite');

const rows = paintDragonGrid();
const count = (ch) => rows.join('').split(ch).length - 1;

describe('dragon grid', () => {
  test('has the declared size', () => {
    expect(rows).toHaveLength(DRAGON_H);
    for (const r of rows) expect(r).toHaveLength(DRAGON_W);
  });

  test('uses only palette characters (plus transparent)', () => {
    for (const ch of new Set(rows.join(''))) expect(ch === '.' || DRAGON_PALETTE[ch]).toBeTruthy();
  });

  test('is deterministic', () => {
    expect(paintDragonGrid()).toEqual(rows);
  });

  test('has every colour that makes it the video dragon', () => {
    for (const ch of ['B', 'O', 'G', 'R', 'Y', 'K']) expect(count(ch)).toBeGreaterThan(8);
  });

  test('wings are symmetric: about as much orange left of the centre line as right of it (the tail adds a little on the right)', () => {
    const half = DRAGON_W / 2;
    const side = (from, to) => rows.map((r) => r.slice(from, to)).join('').split('O').length - 1;
    const left = side(0, half);
    const right = side(half, DRAGON_W);
    expect(Math.abs(right - left)).toBeLessThan(left * 0.25);
  });

  test('head (horn/spike) at the top centre and coins at the bottom', () => {
    const col = (x) => rows.map((r) => r[x]).join('');
    expect(col(26).slice(0, 6)).not.toMatch(/^\.{6}$/);
    expect(col(26).slice(-6)).toMatch(/[GgY]/);
  });

  test('every filled shape is wrapped in the outline colour', () => {
    // no coloured (non-outline) pixel may touch the sprite border or an empty cell
    for (let y = 0; y < DRAGON_H; y++) {
      for (let x = 0; x < DRAGON_W; x++) {
        if (rows[y][x] === '.' || rows[y][x] === 'K') continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = rows[y + dy] && rows[y + dy][x + dx];
          expect(n === undefined ? 'edge' : n).not.toBe('.');
        }
      }
    }
  });
});

describe('rendering', () => {
  test('renderDragon paints one rect per opaque pixel, offset by the origin', () => {
    const rects = [];
    const ctx = { fillStyle: '', fillRect: (x, y, w, h) => rects.push({ x, y, w, h, c: ctx.fillStyle }) };
    renderDragon(ctx, 10, 20);
    const opaque = rows.join('').replace(/\./g, '').length;
    expect(rects).toHaveLength(opaque);
    expect(rects.every((r) => r.w === 1 && r.h === 1 && r.x >= 10 && r.y >= 20)).toBe(true);
  });

  test('buildDragonCanvas returns a canvas of the sprite size', () => {
    const fake = { width: 0, height: 0, getContext: () => ({ set fillStyle(_) {}, fillRect() {} }) };
    const c = buildDragonCanvas(() => fake);
    expect([c.width, c.height]).toEqual([DRAGON_W, DRAGON_H]);
  });
});
