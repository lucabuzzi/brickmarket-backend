// Phase B of the /sell redesign: shot lists, drawings, photo reordering, copy consistency across the five
// languages, and the soft photo-quality hints. Pure logic only (client/src/lib/sell/*): no React, no network.
const form = require('../client/src/lib/sell/form.js');
const { SHOT_LISTS, ALL_SHOT_IDS, GUIDE_TIP_IDS, shotListKey, shotListFor } = require('../client/src/lib/sell/shots.js');
const { GLYPHS } = require('../client/src/lib/sell/glyphs.js');
const { movePhoto } = require('../client/src/lib/sell/photos.js');
const { QUALITY, toGrayscale, laplacianVariance, assessQuality } = require('../client/src/lib/sell/quality.js');

const { INITIAL_FORM, MAX_PHOTOS } = form;
const F = (over = {}) => ({ ...INITIAL_FORM, shippingOptions: {}, ...over });

describe('shot lists', () => {
  test('every list suggests exactly one shot per photo slot, without repeating a shot', () => {
    for (const [key, list] of Object.entries(SHOT_LISTS)) {
      expect([key, list.length]).toEqual([key, MAX_PHOTOS]);
      expect([key, new Set(list).size]).toEqual([key, MAX_PHOTOS]);
    }
  });

  test('the list follows what is being sold: LEGO sets have a box, MOCs and minifigures do not, cards and Funko have their own', () => {
    expect(shotListKey(F())).toBe('lego_set'); // nothing chosen yet
    expect(shotListKey(F({ mainCategory: 'sets' }))).toBe('lego_set');
    expect(shotListKey(F({ mainCategory: 'mocs' }))).toBe('lego_loose');
    expect(shotListKey(F({ mainCategory: 'minifigures' }))).toBe('lego_loose');
    expect(shotListKey(F({ productType: 'tcg', mainCategory: 'mocs' }))).toBe('tcg'); // product type wins
    expect(shotListKey(F({ productType: 'funko' }))).toBe('funko');
    expect(shotListFor(F({ productType: 'tcg' }))[0]).toBe('card_front');
    expect(shotListFor(F())[0]).toBe('box_front');
    expect(shotListFor(F({ mainCategory: 'mocs' }))[0]).toBe('overview'); // the cover is always the whole piece
  });

  test('every shot has a drawing made only of known shapes and harmless attributes, and no drawing is orphaned', () => {
    expect(ALL_SHOT_IDS.length).toBe(16);
    for (const id of ALL_SHOT_IDS) {
      const parts = GLYPHS[id];
      expect([id, Array.isArray(parts) && parts.length > 0]).toEqual([id, true]);
      const walk = (part) => {
        const [tag, attrs, child] = part;
        expect(['rect', 'path', 'circle', 'g']).toContain(tag);
        for (const [k, v] of Object.entries(attrs)) {
          expect(/^[A-Za-z]+$/.test(k)).toBe(true);
          expect(['string', 'number']).toContain(typeof v);
          if (tag === 'path' && k === 'd') expect(/^[MmLlHhVvCcSsAaZz0-9 .,-]+$/.test(v)).toBe(true); // path data only
        }
        if (child) walk(child);
      };
      parts.forEach(walk);
    }
    expect(Object.keys(GLYPHS).sort()).toEqual([...ALL_SHOT_IDS].sort());
  });
});

describe('reordering photos', () => {
  test('moving a photo earlier or later keeps the others in order; out-of-range moves do nothing; the input is never mutated', () => {
    const l = ['a', 'b', 'c', 'd'];
    expect(movePhoto(l, 2, 0)).toEqual(['c', 'a', 'b', 'd']); // "make it the cover"
    expect(movePhoto(l, 0, 1)).toEqual(['b', 'a', 'c', 'd']);
    expect(movePhoto(l, 3, 2)).toEqual(['a', 'b', 'd', 'c']);
    expect(movePhoto(l, 1, 1)).toBe(l);
    for (const [from, to] of [[-1, 0], [0, -1], [4, 0], [0, 4]]) expect(movePhoto(l, from, to)).toBe(l);
    expect(l).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('texts exist in all five languages and say the same thing', () => {
  const langs = Object.fromEntries(['it', 'en', 'es', 'fr', 'de'].map((l) => [l, require(`../client/src/locales/${l}.json`).sell.ui]));
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const flatIt = Object.fromEntries(flat(langs.it));
  const placeholders = (s) => (s.match(/\{\{\s*\w+\s*\}\}/g) || []).map((p) => p.replace(/\s/g, '')).sort().join(',');

  test('sell.ui has the same keys in every language, none of them empty', () => {
    for (const [lang, ui] of Object.entries(langs)) {
      const f = Object.fromEntries(flat(ui));
      expect([lang, Object.keys(f).sort()]).toEqual([lang, Object.keys(flatIt).sort()]);
      for (const [k, v] of Object.entries(f)) expect([lang, k, typeof v === 'string' && v.trim().length > 0]).toEqual([lang, k, true]);
    }
  });

  test('interpolation placeholders ({{n}}, {{shot}}, {{count}}, {{max}}) match across languages', () => {
    for (const [lang, ui] of Object.entries(langs)) {
      const f = Object.fromEntries(flat(ui));
      for (const k of Object.keys(flatIt)) expect([lang, k, placeholders(f[k])]).toEqual([lang, k, placeholders(flatIt[k])]);
    }
  });

  test('every shot and guide tip has its text, short enough for a small tile and a bottom sheet', () => {
    for (const [lang, ui] of Object.entries(langs)) {
      for (const id of ALL_SHOT_IDS) {
        const s = ui.shots[id];
        expect([lang, id, Boolean(s && s.label && s.tip)]).toEqual([lang, id, true]);
        expect([lang, id, s.label.length <= 32]).toEqual([lang, id, true]);
        expect([lang, id, s.tip.length <= 100]).toEqual([lang, id, true]);
      }
      for (const id of GUIDE_TIP_IDS) {
        const g = ui.guide.tips[id];
        expect([lang, id, Boolean(g && g.title && g.text)]).toEqual([lang, id, true]);
        expect([lang, id, g.text.length <= 130]).toEqual([lang, id, true]);
      }
    }
  });

  test('the guide makes no claim about sales and says nothing about credits', () => {
    const banned = /credit|crediti|crédit|créditos|punti|%|vendi\w* (?:di )?più|sell faster|more sales|vendent plus/i;
    for (const [lang, ui] of Object.entries(langs)) {
      for (const [k, v] of flat({ guide: ui.guide, shots: ui.shots })) expect([lang, k, banned.test(v)]).toEqual([lang, k, false]);
    }
  });
});

describe('photo quality hints (soft, never blocking)', () => {
  // synthetic grayscale images: a fine checkerboard is "sharp", repeated box blurring makes it "soft"
  const W = 64;
  const board = () => Float32Array.from({ length: W * W }, (_, i) => ((Math.floor((i % W) / 4) + Math.floor(i / W / 4)) % 2 ? 230 : 25));
  const boxBlur = (src, passes) => {
    let cur = src;
    for (let p = 0; p < passes; p += 1) {
      const next = new Float32Array(cur.length);
      for (let y = 0; y < W; y += 1) {
        for (let x = 0; x < W; x += 1) {
          let s = 0;
          let n = 0;
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              const yy = y + dy;
              const xx = x + dx;
              if (yy >= 0 && yy < W && xx >= 0 && xx < W) { s += cur[yy * W + xx]; n += 1; }
            }
          }
          next[y * W + x] = s / n;
        }
      }
      cur = next;
    }
    return cur;
  };

  test('RGBA to luma uses the usual weights', () => {
    const g = toGrayscale(Uint8ClampedArray.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]), 4, 1);
    expect([...g].map((v) => Math.round(v))).toEqual([76, 150, 29, 255]);
  });

  test('a flat image has zero sharpness; a sharp one is far above the threshold; blurring lowers it step by step', () => {
    expect(laplacianVariance(new Float32Array(W * W).fill(128), W, W)).toBe(0);
    const sharp = laplacianVariance(board(), W, W);
    const soft1 = laplacianVariance(boxBlur(board(), 1), W, W);
    const soft3 = laplacianVariance(boxBlur(board(), 3), W, W);
    expect(sharp).toBeGreaterThan(1000);
    expect(soft1).toBeLessThan(sharp);
    expect(soft3).toBeLessThan(soft1);
  });

  test('degenerate sizes do not throw', () => {
    expect(laplacianVariance(new Float32Array(4), 2, 2)).toBe(0);
    expect(laplacianVariance(new Float32Array(0), 0, 0)).toBe(0);
  });

  test('assessQuality: small = long side under 800px; blurry = sharpness under the calibrated 60; unknown is never flagged', () => {
    expect(QUALITY).toMatchObject({ blurThreshold: 60, minLongSide: 800, analysisWidth: 640 });
    expect(assessQuality({ width: 4000, height: 3000, sharpness: 900 })).toEqual({ small: false, blurry: false });
    expect(assessQuality({ width: 799, height: 600, sharpness: 900 }).small).toBe(true);
    expect(assessQuality({ width: 600, height: 800, sharpness: 900 }).small).toBe(false); // the long side counts
    expect(assessQuality({ width: 4000, height: 3000, sharpness: 59.9 }).blurry).toBe(true);
    expect(assessQuality({ width: 4000, height: 3000, sharpness: 60 }).blurry).toBe(false);
    expect(assessQuality({ width: 0, height: 0, sharpness: null })).toEqual({ small: false, blurry: false });
    expect(assessQuality({ width: 1000, height: 1000, sharpness: NaN }).blurry).toBe(false);
  });

  test('on the same scale the threshold was calibrated on, sharp is far above it and heavy blur is far below', () => {
    // calibration on real photos: sharp 196-3233, softened to 1/3 resolution 21-61
    expect(laplacianVariance(board(), W, W)).toBeGreaterThan(QUALITY.blurThreshold * 10);
    expect(laplacianVariance(boxBlur(board(), 6), W, W)).toBeLessThan(laplacianVariance(board(), W, W) / 5);
  });
});
