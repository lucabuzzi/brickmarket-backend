// "CardBrix the game" stall painter (client/src/lib/game/buildingSprite.js): every stall fits its canvas, uses its
// own pillar colour, and the four are visibly different from each other.
const { BUILDINGS } = require('../client/src/lib/game/gameMap');
const { BUILDING_PAD, AUCTION_TIMER_BOX, paintBuilding, buildBuildingCanvas } = require('../client/src/lib/game/buildingSprite');

function record() {
  const rects = [];
  return { rects, fillStyle: '', fillRect(x, y, w, h) { rects.push({ x, y, w, h, c: this.fillStyle }); } };
}

describe.each(BUILDINGS)('stall $id', (b) => {
  const ctx = record();
  paintBuilding(ctx, b, 0, 0);

  test('paints inside its canvas (box + awning overhang)', () => {
    expect(ctx.rects.length).toBeGreaterThan(40);
    for (const r of ctx.rects) {
      if (r.w <= 0 || r.h <= 0) throw new Error(`empty rect ${JSON.stringify(r)}`);
      if (!(r.x >= 0 && r.y >= 0 && r.x + r.w <= b.w + 2 * BUILDING_PAD && r.y + r.h <= b.h)) throw new Error(`outside the canvas: ${JSON.stringify(r)}`);
    }
  });

  test('uses the pillar colour for its awning', () => {
    expect(ctx.rects.some((r) => r.c === b.color)).toBe(true);
  });

  test('is deterministic', () => {
    const again = record();
    paintBuilding(again, b, 0, 0);
    expect(again.rects).toEqual(ctx.rects);
  });
});

describe('stalls differ', () => {
  test('the four stalls produce four different drawings', () => {
    const sigs = BUILDINGS.map((b) => { const c = record(); paintBuilding(c, b); return JSON.stringify(c.rects); });
    expect(new Set(sigs).size).toBe(4);
  });

  test('the auction stall has a timer panel that fits inside it', () => {
    const t = AUCTION_TIMER_BOX;
    const auctions = BUILDINGS.find((b) => b.id === 'auctions');
    expect(t.x + t.w).toBeLessThanOrEqual(auctions.w);
    expect(t.y + t.h).toBeLessThan(auctions.h);
  });

  test('buildBuildingCanvas is the box plus the awning overhang wide', () => {
    const fake = { width: 0, height: 0, getContext: () => ({ set fillStyle(_) {}, fillRect() {} }) };
    const c = buildBuildingCanvas(BUILDINGS[0], () => fake);
    expect([c.width, c.height]).toEqual([BUILDINGS[0].w + 2 * BUILDING_PAD, BUILDINGS[0].h]);
  });
});
