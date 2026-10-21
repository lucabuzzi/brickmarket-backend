// "CardBrix the game" characters (client/src/lib/game/skins.js): catalogue, palettes, the pure recolouring maths,
// agreement with the server validator, and the integrity of the generated sheets (client/src/assets/game/skins).
const CHARS = require('../client/src/config/gameCharacters.json');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const SPEC = require('../client/src/config/avatarSpec.json');
const {
  FRAME, COLS, ROWS, IDLE_COL, LOOKS, PALETTES, COLOR_PARTS, REGION_OF, defaultAvatar, sanitizeAvatar, randomAvatar, frameRect, recolorPixels,
} = require('../client/src/lib/game/skins');
const { normalizeAvatarConfig } = require('../src/services/avatarConfig');

const ASSETS = path.join(__dirname, '..', 'client', 'src', 'assets', 'game', 'skins');
const manifest = JSON.parse(fs.readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8'));

describe('catalogue and palettes match the shared spec', () => {
  test('looks come from the spec, all free for now', () => {
    expect(LOOKS.map((l) => l.id)).toEqual(SPEC.looks);
    expect(LOOKS.every((l) => l.access === 'free')).toBe(true);
  });

  test.each(COLOR_PARTS)('%s has exactly the number of options the server accepts, starting with "as drawn"', (part) => {
    expect(PALETTES[part]).toHaveLength(SPEC[part]);
    expect(PALETTES[part][0]).toBeNull();
    for (const hex of PALETTES[part].slice(1)) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('no outfit colour is the reserved gold', () => {
    expect(PALETTES.outfitColor.filter(Boolean).map((c) => c.toLowerCase())).not.toContain('#d4af37');
  });
});

describe('sanitizeAvatar / randomAvatar / defaultAvatar', () => {
  test('garbage and out-of-range values fall back, piece by piece', () => {
    expect(sanitizeAvatar(null)).toEqual(defaultAvatar());
    expect(sanitizeAvatar({ v: 2, look: 'nope', skin: 99, hairColor: -1 })).toEqual(defaultAvatar());
    expect(sanitizeAvatar({ ...defaultAvatar(), skin: 2 }).skin).toBe(2);
    expect(sanitizeAvatar({ ...defaultAvatar(), look: LOOKS[3].id }).look).toBe(LOOKS[3].id);
  });

  test('legacy avatars convert exactly like on the server', () => {
    const v1 = { skin: 4, hairStyle: 2, hairColor: 6, outfit: 1, outfitColor: 0, accessory: 5 };
    expect(sanitizeAvatar(v1)).toEqual(normalizeAvatarConfig(v1));
    expect(sanitizeAvatar({ skin: 1 })).toEqual(defaultAvatar()); // incomplete legacy -> default
  });

  test('random avatars are always accepted by the server validator and are deterministic with a fixed generator', () => {
    for (let i = 0; i < 300; i++) expect(normalizeAvatarConfig(randomAvatar())).not.toBeNull();
    const seq = () => { let n = 0; return () => ((n += 0.137) % 1); };
    expect(randomAvatar(seq())).toEqual(randomAvatar(seq()));
  });

  test('the default avatar is accepted by the server validator', () => {
    expect(normalizeAvatarConfig(defaultAvatar())).toEqual(defaultAvatar());
  });
});

describe('frames', () => {
  test('frameRect addresses the 4x4 grid', () => {
    expect(COLS).toBe(4);
    expect(ROWS).toEqual(['down', 'up', 'right', 'left']);
    expect(frameRect('down', 0)).toEqual({ x: 0, y: 0, w: FRAME.w, h: FRAME.h });
    expect(frameRect('left', 3)).toEqual({ x: 3 * FRAME.w, y: 3 * FRAME.h, w: FRAME.w, h: FRAME.h });
    for (const r of ROWS) expect(IDLE_COL[r]).toBeLessThan(COLS);
  });
});

describe('recolorPixels', () => {
  // 3 pixels: region 1 (skin) bright, region 1 shadow, region 3 (jacket); plus one transparent skin pixel
  const sheet = new Uint8ClampedArray([200, 150, 100, 255, 100, 75, 50, 255, 30, 60, 160, 255, 200, 150, 100, 0]);
  const mask = new Uint8Array([1, 1, 3, 1]);
  const stats = { 1: { sref: 0.5, vref: 0.78 }, 3: { sref: 0.8, vref: 0.63 } };

  test('with every part "as drawn" the sheet is untouched (and the input is never mutated)', () => {
    const before = Array.from(sheet);
    const out = recolorPixels(sheet, mask, stats, defaultAvatar());
    expect(Array.from(out)).toEqual(before);
    expect(out).not.toBe(sheet);
    expect(Array.from(sheet)).toEqual(before);
  });

  test('a recoloured region takes the new hue, keeps its relative shading, and leaves other regions alone', () => {
    const av = { ...defaultAvatar(), skin: PALETTES.skin.indexOf('#5c3a21') };
    const out = recolorPixels(sheet, mask, stats, av);
    expect(Array.from(out.slice(8, 12))).toEqual(Array.from(sheet.slice(8, 12))); // jacket untouched
    expect(Array.from(out.slice(12, 16))).toEqual(Array.from(sheet.slice(12, 16))); // transparent pixel untouched
    const lum = (i) => out[i] + out[i + 1] + out[i + 2];
    expect(lum(0)).toBeGreaterThan(lum(4)); // the lit pixel is still brighter than the shadow pixel
    expect(out[0]).not.toBe(sheet[0]);
    expect(out[3]).toBe(255);
  });

  test('every colour part drives its own region', () => {
    for (const part of COLOR_PARTS) {
      const region = REGION_OF[part];
      const m = new Uint8Array([region]);
      const s = new Uint8ClampedArray([120, 90, 60, 255]);
      const st = { [region]: { sref: 0.5, vref: 0.47 } };
      const out = recolorPixels(s, m, st, { ...defaultAvatar(), [part]: 1 });
      expect(Array.from(out)).not.toEqual(Array.from(s));
    }
  });

  test('grey / white targets (white hair) produce grey pixels', () => {
    const idx = PALETTES.hairColor.indexOf('#e8e8e8');
    const out = recolorPixels(new Uint8ClampedArray([120, 80, 40, 255]), new Uint8Array([2]), { 2: { sref: 0.6, vref: 0.47 } }, { ...defaultAvatar(), hairColor: idx });
    expect(Math.abs(out[0] - out[1])).toBeLessThan(8);
    expect(Math.abs(out[1] - out[2])).toBeLessThan(8);
  });
});

describe('generated sheets (node scripts/build-game-skins.js)', () => {
  test('the manifest matches the code', () => {
    expect(manifest.frame).toEqual(FRAME);
    expect(manifest.cols).toBe(COLS);
    expect(manifest.rows).toEqual(ROWS);
    expect(manifest.idle).toEqual(IDLE_COL);
    // every playable look is built (retired legacy looks may still be in the manifest, unused)
    for (const look of SPEC.looks) expect(manifest.looks[look]).toBeDefined();
  });

  test.each(SPEC.looks)('%s: sheet and mask have the right size, a sane mask, and stats for all five regions', async (look) => {
    const sheetFile = path.join(ASSETS, `${look}.png`);
    const maskFile = path.join(ASSETS, `${look}-mask.png`);
    const W = FRAME.w * COLS;
    const H = FRAME.h * ROWS.length;
    const sm = await sharp(sheetFile).metadata();
    expect([sm.width, sm.height]).toEqual([W, H]);
    const { data: mask, info } = await sharp(maskFile).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([W, H]);
    const { data: px } = await sharp(sheetFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels;
    let opaque = 0;
    for (let k = 0; k < W * H; k++) {
      const region = mask[k * ch];
      expect(region).toBeLessThanOrEqual(5);
      if (px[k * 4 + 3]) opaque++;
      else expect(region).toBe(0); // no region outside the character
    }
    expect(opaque).toBeGreaterThan(W * H * 0.08); // the characters are really there
    // every zone this look can recolour was found in the drawing (all five for the legacy looks)
    const character = CHARS.characters.find((c) => c.id === look);
    const PART_REGION = { skin: 1, hairColor: 2, outfitColor: 3, accentColor: 4, legsColor: 5 };
    const regions = character ? Object.keys(PART_REGION).filter((p) => character.regions[p]).map((p) => PART_REGION[p]) : [1, 2, 3, 4, 5];
    for (const r of regions) {
      expect(manifest.looks[look].regions[r].count).toBeGreaterThan(40);
      expect(manifest.looks[look].regions[r].vref).toBeGreaterThan(0);
    }
  });

  test('every frame has the character standing on the same baseline', async () => {
    const W = FRAME.w * COLS;
    const { data } = await sharp(path.join(ASSETS, 'uomo_base.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let row = 0; row < ROWS.length; row++) {
      for (let col = 0; col < COLS; col++) {
        let bottom = -1;
        for (let y = 0; y < FRAME.h; y++) for (let x = 0; x < FRAME.w; x++) if (data[(((row * FRAME.h + y) * W) + col * FRAME.w + x) * 4 + 3]) bottom = y;
        expect(bottom).toBe(FRAME.h - 3); // soles two pixels above the cell bottom
      }
    }
  });
});
