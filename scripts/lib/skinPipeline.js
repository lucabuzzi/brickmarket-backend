// Pure image helpers for scripts/build-game-skins.js (no sharp, no file access, so they are unit-tested in
// tests/game-skin-pipeline.test.js). Everything works on raw RGBA buffers (Uint8Array / Buffer / Uint8ClampedArray).

/** [hue 0..360, saturation 0..1, value 0..1] */
function rgbToHsv(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const mx = Math.max(rr, gg, bb);
  const mn = Math.min(rr, gg, bb);
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === rr) h = ((gg - bb) / d) % 6;
    else if (mx === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}

const isWhite = (data, i, t) => data[i] >= t && data[i + 1] >= t && data[i + 2] >= t;

/**
 * Makes the background transparent. Flood-fills from the image border over near-white pixels (so white socks
 * or highlights INSIDE the character survive), then also clears small enclosed pockets of pure white (the gap
 * between an arm and the body). Mutates `data` (alpha = 0) and returns the number of cleared pixels.
 */
function removeBackground(data, w, h, { border = 228, pocket = 246, minPocket = 6 } = {}) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = y * w + x;
    if (seen[k] || !isWhite(data, k * 4, border)) return;
    seen[k] = 1;
    stack.push(k);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const k = stack.pop();
    const x = k % w;
    const y = (k / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  // enclosed pockets: connected groups of PURE white that the border fill could not reach
  const mark = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || mark[start] || !isWhite(data, start * 4, pocket)) continue;
    const group = [];
    const st = [start];
    mark[start] = 1;
    while (st.length) {
      const k = st.pop();
      group.push(k);
      const x = k % w;
      const y = (k / w) | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx;
        if (!seen[nk] && !mark[nk] && isWhite(data, nk * 4, pocket)) { mark[nk] = 1; st.push(nk); }
      }
    }
    if (group.length >= minPocket) for (const k of group) seen[k] = 1;
  }

  let cleared = 0;
  for (let k = 0; k < w * h; k++) if (seen[k]) { data[k * 4 + 3] = 0; cleared++; }
  return cleared;
}

/** Removes the light, desaturated JPEG halo left on pixels that touch the (now transparent) background. */
function defringe(data, w, h, passes = 2) {
  for (let p = 0; p < passes; p++) {
    const kill = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!data[i + 3]) continue;
        const edge = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([nx, ny]) => nx < 0 || ny < 0 || nx >= w || ny >= h || !data[(ny * w + nx) * 4 + 3]);
        if (!edge) continue;
        const [, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
        if (v > 0.8 && s < 0.22) kill.push(i);
      }
    }
    for (const i of kill) data[i + 3] = 0;
  }
}

/** { left, top, right, bottom } of the opaque pixels (inclusive), or null when the frame is empty. */
function opaqueBounds(data, w, h) {
  let left = w; let top = h; let right = -1; let bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

/** Horizontal centre of mass of the upper body (rows 15%..55% of the height): a stable anchor while limbs swing. */
function torsoCentre(data, w, bounds) {
  const hgt = bounds.bottom - bounds.top + 1;
  const y0 = bounds.top + Math.floor(hgt * 0.15);
  const y1 = bounds.top + Math.floor(hgt * 0.55);
  let sum = 0;
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = bounds.left; x <= bounds.right; x++) {
      if (data[(y * w + x) * 4 + 3]) { sum += x; n++; }
    }
  }
  return n ? sum / n : (bounds.left + bounds.right) / 2;
}

// ── colour regions ─────────────────────────────────────────────────────────────────────────────
// What the player can recolour. 0 = left as drawn (outlines, eyes, shoes, glass...).
const REGION = { none: 0, skin: 1, hair: 2, outfit: 3, accent: 4, legs: 5 };

const between = (x, a, b) => x >= a && x <= b;

/**
 * Which colour region a pixel belongs to. `ry` is the pixel's height inside the character (0 = top of the
 * hair, 1 = soles). The artwork is flat pixel art, so hue / saturation / brightness plus the height are
 * enough to tell hair from shorts (both brown) or jacket from trousers (both navy).
 */
function classifyPixel(lookId, h, s, v, ry) {
  const cyber = lookId.endsWith('cyber');
  if (cyber) {
    if (between(h, 165, 200) && s > 0.45 && v > 0.55) return REGION.accent; // cyan glow (visor, tips, gloves, boots)
    if (between(h, 18, 42) && s > 0.75 && v > 0.75) return REGION.none; // orange trim stays as drawn
    if (between(h, 195, 245) && s > 0.2 && v < 0.62 && v > 0.08) return ry < 0.52 ? REGION.outfit : REGION.legs;
    if (between(h, 12, 42) && between(s, 0.2, 0.7) && v > 0.58) return REGION.skin;
    if (between(h, 8, 40) && s > 0.3 && v < 0.72 && ry < 0.36) return REGION.hair;
    return REGION.none;
  }
  if (between(h, 195, 250) && s > 0.3 && v > 0.25 && ry < 0.74) return REGION.outfit; // blue jacket (not the dark shoes)
  if (between(h, 18, 42) && s > 0.75 && v > 0.8) return REGION.accent; // orange hood / stripes
  if (between(h, 12, 42) && between(s, 0.2, 0.65) && v > 0.62) return REGION.skin;
  if (between(h, 8, 42) && s > 0.35 && v < 0.78) {
    if (ry < 0.36) return REGION.hair;
    if (ry > 0.42 && ry < 0.82) return REGION.legs; // brown shorts / skirt
  }
  return REGION.none;
}

/** Mean saturation and value of every region over all frames (the reference the recolouring is relative to). */
function regionStats(frames) {
  const acc = {};
  for (const { data, mask } of frames) {
    for (let k = 0; k < mask.length; k++) {
      const r = mask[k];
      if (!r) continue;
      const i = k * 4;
      const [, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
      if (v < 0.12) continue; // outlines inside a region would drag the reference down
      const a = acc[r] || (acc[r] = { n: 0, s: 0, v: 0 });
      a.n++; a.s += s; a.v += v;
    }
  }
  const out = {};
  for (const [r, a] of Object.entries(acc)) out[r] = { count: a.n, sref: +(a.s / a.n).toFixed(4), vref: +(a.v / a.n).toFixed(4) };
  return out;
}

// ── magenta sheets (the characters of gameCharacters.json) ─────────────────────────────────────

const hexToRgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/**
 * Makes a flat chroma-key background transparent: every pixel within `tolerance` (per channel) of `rgb`, then,
 * on the character's edge, the magenta-tinted pixels left by anti-aliasing / JPEG ("spill"). The prompt forbids
 * magenta in the characters themselves, so the key colour is cleared everywhere (also between an arm and the body).
 * Mutates `data`; returns the number of cleared pixels.
 */
function removeChromaKey(data, w, h, { rgb = [255, 0, 255], tolerance = 35, spillPasses = 2 } = {}) {
  let cleared = 0;
  for (let k = 0; k < w * h; k++) {
    const i = k * 4;
    if (!data[i + 3]) continue;
    const near = Math.abs(data[i] - rgb[0]) <= tolerance && Math.abs(data[i + 1] - rgb[1]) <= tolerance && Math.abs(data[i + 2] - rgb[2]) <= tolerance;
    // JPEG darkens the key in enclosed pockets (between an arm and the body): strongly magenta pixels go too.
    // Purple robes (red barely above green) and pinks (blue barely above green) are far from this.
    const g = data[i + 1];
    const strong = data[i] > g + 90 && data[i + 2] > g + 90 && Math.abs(data[i] - data[i + 2]) < 60;
    if (near || strong) {
      data[i + 3] = 0;
      cleared++;
    }
  }
  for (let p = 0; p < spillPasses; p++) {
    const kill = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!data[i + 3]) continue;
        const edge = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([nx, ny]) => nx < 0 || ny < 0 || nx >= w || ny >= h || !data[(ny * w + nx) * 4 + 3]);
        if (!edge) continue;
        const [hh, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
        if (hh >= 285 && hh <= 330 && s > 0.45 && v > 0.45) kill.push(i);
      }
    }
    for (const i of kill) { data[i + 3] = 0; cleared++; }
  }
  despill(data, w, h, 5);
  return cleared;
}

/**
 * Takes the magenta tint out of the outer `depth` pixels of the character (JPEG sheets blend the key colour into the
 * outline and edges): red and blue are pulled down to green by the amount they both exceed it. Only magenta-ish
 * hues (275..345) are touched, so purple robes or pink details further inside keep their colour.
 */
function despill(data, w, h, depth = 2) {
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3];
  const ring = new Uint8Array(w * h); // n = n pixels in from the background (0 = deeper or transparent)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (opaque(x, y) && [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([nx, ny]) => !opaque(nx, ny))) ring[y * w + x] = 1;
    }
  }
  for (let d = 2; d <= depth; d++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = y * w + x;
        if (!ring[k] && opaque(x, y) && [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h && ring[ny * w + nx] === d - 1)) ring[k] = d;
      }
    }
  }
  for (let k = 0; k < w * h; k++) {
    if (!ring[k]) continue;
    const i = k * 4;
    const [hh, s] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
    if (hh < 275 || hh > 345 || s < 0.2) continue;
    const excess = Math.min(data[i], data[i + 2]) - data[i + 1];
    if (excess <= 0) continue;
    data[i] -= excess;
    data[i + 2] -= excess;
  }
}

/** Perceptual-ish distance between two RGB colours ("redmean"), 0..~765. */
function colorDistance(a, b) {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

const PART_REGION = { skin: REGION.skin, hairColor: REGION.hair, outfitColor: REGION.outfit, accentColor: REGION.accent, legsColor: REGION.legs };

/**
 * gameCharacters.json `regions` -> [{ region, refs: [{ rgb, band }] }] for classifyByRefs. A reference is a hex
 * colour (valid in the zone's `band`) or { hex, band } when one zone has colours at different heights (a navy
 * cap at the top and a brown satchel at the waist, both "details").
 */
function prepareRefs(regions) {
  return Object.entries(regions || {})
    .filter(([part, r]) => r && PART_REGION[part])
    .map(([part, r]) => ({
      region: PART_REGION[part],
      refs: r.ref.map((ref) => (typeof ref === 'string'
        ? { rgb: hexToRgb(ref), band: r.band || [0, 1] }
        : { rgb: hexToRgb(ref.hex), band: ref.band || r.band || [0, 1] })),
    }));
}

/**
 * Colour region of a pixel of a gameCharacters.json character: the zone whose reference colour is closest,
 * among the zones allowed at this height (`ry`, 0 = top, 1 = soles), if close enough; 0 (as drawn) otherwise.
 * Outlines (near black, also when tinted by the background in JPEG sheets) always stay as drawn.
 */
function classifyByRefs(rgb, ry, prepared, maxDistance = 110) {
  const [r, g, b] = rgb;
  if (Math.max(r, g, b) < 26) return REGION.none;
  // dark outline pixels blended with the magenta background (JPEG sheets): red and blue well above green
  if (Math.max(r, g, b) < 110 && r > g + 18 && b > g + 18 && Math.abs(r - b) < 40) return REGION.none;
  let best = REGION.none;
  let bestD = maxDistance;
  for (const z of prepared) {
    for (const ref of z.refs) {
      if (ry < ref.band[0] || ry > ref.band[1]) continue;
      const d = colorDistance(rgb, ref.rgb);
      if (d <= bestD) { bestD = d; best = z.region; }
    }
  }
  return best;
}

module.exports = {
  REGION, rgbToHsv, removeBackground, defringe, opaqueBounds, torsoCentre, classifyPixel, regionStats,
  hexToRgb, removeChromaKey, despill, colorDistance, prepareRefs, classifyByRefs,
};
