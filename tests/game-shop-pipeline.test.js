// The market shop artwork (scripts/build-game-shops.js): the magenta background goes, enclosed magenta pockets and
// pink fringes too, a piece of art poking into the next cell stays with its own shop, specks are dropped; and the
// generated images agree with shops.json.
const path = require('path');
const sharp = require('sharp');
const { backgroundMask, shopOwners, boundsOf, ARTS } = require('../scripts/build-game-shops');
const SHOP_ART = require('../client/src/assets/game/shops/shops.json');

const MAGENTA = [255, 0, 255];
const BROWN = [120, 80, 40];
const PINKISH = [200, 120, 190]; // anti-aliasing between the art and the background

/** An RGBA buffer `w` x `h` of `fill`, with `paint(x, y)` returning a colour for some pixels. */
function image(w, h, paint) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = paint(x, y) || MAGENTA;
      data.set([...c, 255], (y * w + x) * 4);
    }
  }
  return data;
}

describe('cutting the shops out of the sheet', () => {
  // two "shops" in a 2 x 1 grid of 40 x 20 cells: a ring with a magenta hole, and a block whose banner pokes
  // into the left cell; a 2 px speck in the left cell; pink fringe round the block
  const W = 80;
  const H = 20;
  const data = image(W, H, (x, y) => {
    if (x >= 5 && x < 25 && y >= 3 && y < 17) return x >= 12 && x < 18 && y >= 8 && y < 12 ? MAGENTA : BROWN; // ring
    if (x >= 46 && x < 70 && y >= 4 && y < 16) return BROWN; // block
    if (x >= 37 && x < 46 && y >= 6 && y < 9) return BROWN; // its banner, crossing into the left cell
    if (x === 45 && y >= 9 && y < 16) return PINKISH; // fringe on the block's left edge
    if (x >= 30 && x < 32 && y === 18) return BROWN; // speck
    return null;
  });
  const gone = backgroundMask(data, W, H);
  const owner = shopOwners(gone, W, H, 2, 1);

  test('the open background, the enclosed magenta hole and the pink fringe are background', () => {
    expect(gone[0]).toBe(1);
    expect(gone[10 * W + 15]).toBe(1); // inside the ring
    expect(gone[12 * W + 45]).toBe(1); // fringe
    expect(gone[10 * W + 10]).toBe(0); // the ring itself
  });

  test('each piece of art belongs to the shop holding its centre; specks belong to nobody', () => {
    expect(owner[10 * W + 10]).toBe(0);
    expect(owner[7 * W + 38]).toBe(1); // the banner, although it is in the left cell
    expect(owner[18 * W + 30]).toBe(-1);
    expect(boundsOf(owner, W, 0)).toEqual({ left: 5, top: 3, width: 20, height: 14 });
    expect(boundsOf(owner, W, 1)).toEqual({ left: 37, top: 4, width: 33, height: 12 });
    expect(boundsOf(owner, W, 5)).toBeNull();
  });
});

describe('generated artwork', () => {
  test('one image per art, sized as shops.json says, with a transparent background', async () => {
    expect(Object.keys(SHOP_ART.arts)).toEqual(ARTS);
    for (const art of ARTS) {
      const file = path.join(__dirname, '..', 'client', 'src', 'assets', 'game', 'shops', `${art}.png`);
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([art, Math.abs(info.width * SHOP_ART.texScale - SHOP_ART.arts[art].w) < 0.2]).toEqual([art, true]);
      expect([art, Math.abs(info.height * SHOP_ART.texScale - SHOP_ART.arts[art].h) < 0.2]).toEqual([art, true]);
      expect([art, data[3]]).toEqual([art, 0]); // top-left corner: background
      // no magenta left anywhere in the picture
      let pink = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128 && Math.min(data[i], data[i + 2]) - data[i + 1] > 150) pink++;
      expect([art, pink]).toEqual([art, 0]);
    }
  });
});
