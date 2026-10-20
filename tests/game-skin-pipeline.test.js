// scripts/lib/skinPipeline.js: the pure image helpers behind scripts/build-game-skins.js (background removal that
// keeps white details inside the character, JPEG halo removal, bounds/anchor maths and the colour regions the
// creator recolours). Synthetic pixel buffers only: no image files, no sharp.
const {
  REGION, rgbToHsv, removeBackground, defringe, opaqueBounds, torsoCentre, classifyPixel, regionStats,
} = require('../scripts/lib/skinPipeline');

function image(w, h, fill = [255, 255, 255]) {
  const data = new Uint8Array(w * h * 4);
  for (let k = 0; k < w * h; k++) { data[k * 4] = fill[0]; data[k * 4 + 1] = fill[1]; data[k * 4 + 2] = fill[2]; data[k * 4 + 3] = 255; }
  return data;
}
const setPx = (data, w, x, y, [r, g, b]) => { const i = (y * w + x) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; };
const alphaAt = (data, w, x, y) => data[(y * w + x) * 4 + 3];
function rect(data, w, x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setPx(data, w, x, y, c); }

describe('rgbToHsv', () => {
  test('primary colours and greys', () => {
    expect(rgbToHsv(255, 0, 0)).toEqual([0, 1, 1]);
    expect(rgbToHsv(0, 255, 0)[0]).toBe(120);
    expect(rgbToHsv(0, 0, 255)[0]).toBe(240);
    expect(rgbToHsv(128, 128, 128)).toEqual([0, 0, 128 / 255]);
    expect(rgbToHsv(0, 0, 0)).toEqual([0, 0, 0]);
  });
});

describe('removeBackground', () => {
  const W = 40;
  const H = 40;

  test('clears the white background but keeps the character', () => {
    const d = image(W, H);
    rect(d, W, 10, 10, 29, 29, [40, 80, 160]);
    removeBackground(d, W, H);
    expect(alphaAt(d, W, 0, 0)).toBe(0);
    expect(alphaAt(d, W, 5, 20)).toBe(0);
    expect(alphaAt(d, W, 15, 15)).toBe(255);
  });

  test('clears an enclosed pocket of pure white (gap between arm and body) but not a tiny highlight', () => {
    const d = image(W, H);
    rect(d, W, 5, 5, 34, 34, [120, 60, 30]);
    rect(d, W, 10, 10, 14, 14, [255, 255, 255]); // 25 px pocket
    setPx(d, W, 25, 25, [255, 255, 255]); // lone white pixel (a shine)
    removeBackground(d, W, H);
    expect(alphaAt(d, W, 12, 12)).toBe(0);
    expect(alphaAt(d, W, 25, 25)).toBe(255);
  });

  test('keeps light-grey details inside the character (white socks are not pure white)', () => {
    const d = image(W, H);
    rect(d, W, 5, 5, 34, 34, [120, 60, 30]);
    rect(d, W, 15, 15, 24, 24, [205, 205, 210]); // sock
    removeBackground(d, W, H);
    expect(alphaAt(d, W, 20, 20)).toBe(255);
  });
});

describe('defringe', () => {
  test('removes a light desaturated halo on the edge only', () => {
    const W = 12;
    const d = image(W, 12, [255, 255, 255]);
    rect(d, W, 3, 3, 8, 8, [40, 80, 160]);
    rect(d, W, 3, 3, 8, 3, [240, 240, 245]); // halo row on the top edge
    removeBackground(d, W, 12, { border: 250 }); // strict so the halo is kept as "opaque" first
    expect(alphaAt(d, W, 5, 3)).toBe(255);
    defringe(d, W, 12, 1);
    expect(alphaAt(d, W, 5, 3)).toBe(0);
    expect(alphaAt(d, W, 5, 6)).toBe(255); // inside stays
  });
});

describe('bounds and anchor', () => {
  test('opaqueBounds and torsoCentre', () => {
    const W = 30;
    const d = new Uint8Array(W * 30 * 4);
    rect(d, W, 10, 4, 19, 25, [10, 10, 10]); // body, centred on x = 14.5
    rect(d, W, 20, 22, 26, 24, [10, 10, 10]); // a leg swinging out low: must not move the anchor
    expect(opaqueBounds(d, W, 30)).toEqual({ left: 10, top: 4, right: 26, bottom: 25 });
    expect(torsoCentre(d, W, opaqueBounds(d, W, 30))).toBeCloseTo(14.5, 1);
    expect(opaqueBounds(new Uint8Array(16 * 4), 4, 4)).toBeNull();
  });
});

describe('classifyPixel', () => {
  const hsv = (hex) => rgbToHsv(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
  const cls = (look, hex, ry) => classifyPixel(look, ...hsv(hex), ry);

  test('base look: jacket, details, skin, hair, shorts, shoes', () => {
    expect(cls('uomo_base', '#2f62b0', 0.4)).toBe(REGION.outfit);
    expect(cls('uomo_base', '#ff9a1f', 0.4)).toBe(REGION.accent);
    expect(cls('uomo_base', '#e0a878', 0.2)).toBe(REGION.skin);
    expect(cls('uomo_base', '#6b3f22', 0.1)).toBe(REGION.hair);
    expect(cls('uomo_base', '#6b3f22', 0.62)).toBe(REGION.legs);
    expect(cls('uomo_base', '#2c3f66', 0.92)).toBe(REGION.none); // dark shoes stay as drawn
    expect(cls('uomo_base', '#101010', 0.5)).toBe(REGION.none); // outlines
  });

  test('cyber look: glow is the accent, navy splits into jacket and trousers by height, orange trim stays', () => {
    expect(cls('donna_cyber', '#22d3ee', 0.2)).toBe(REGION.accent);
    expect(cls('donna_cyber', '#1b2a44', 0.35)).toBe(REGION.outfit);
    expect(cls('donna_cyber', '#1b2a44', 0.7)).toBe(REGION.legs);
    expect(cls('donna_cyber', '#ff9a1f', 0.4)).toBe(REGION.none);
  });
});

describe('regionStats', () => {
  test('reference saturation and value per region, ignoring outline-dark pixels', () => {
    const data = new Uint8Array([200, 100, 50, 255, 200, 100, 50, 255, 10, 5, 2, 255]);
    const mask = new Uint8Array([1, 1, 1]);
    const out = regionStats([{ data, mask }]);
    expect(out[1].count).toBe(2);
    expect(out[1].vref).toBeCloseTo(200 / 255, 3);
    expect(out[1].sref).toBeCloseTo(0.75, 3);
  });
});
