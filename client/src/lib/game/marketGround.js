// The ground of the market inside the castle: rounded cobblestones with moss and tufts of grass, warm brick ways
// with stone kerbs in front of the shops, the octagonal plaza of light slabs with a lime inlay, and the castle
// walls (stone blocks with moss, ivy and cracks, battlements, banners, torches, the open gate in the south wall).
// Painted once, pixel by pixel, at GROUND_SCALE texture pixels per world unit (the scene shows it scaled down, so
// its detail matches the shop art), deterministic like groundSprite.js (tests/game-market.test.js). The two gate
// towers are drawn by the scene instead, so characters can walk behind their roofs.
import {
  MARKET_WORLD, MARKET_WAYS, WAY_WIDTH, PLAZA, octagonPoints, EXIT_GATE, WALL_N, WALL_SIDE, WALL_S,
} from './marketMap';

export const GROUND_SCALE = 2;

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const shade = (c, f) => c.map((v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)))));
const COB = ['#958b7e', '#8b8175', '#a0968a', '#857b70', '#9b9083', '#8f8a80'].map(hex);
const COB_GAP = hex('#4f473f');
const MOSS = hex('#557a37');
const MOSS_L = hex('#78a24a');
const BRICK = ['#d6a86c', '#cf9f62', '#dcb27a', '#c99a5c', '#d2a46a'].map(hex);
const BRICK_GAP = hex('#9d7547');
const KERB = hex('#7d7266');
const KERB_L = hex('#b3a898');
const KERB_D = hex('#5a5149');
const SLAB = ['#ddd4c4', '#d2c8b6', '#e4ddcf', '#cbc1ae'].map(hex);
const SLAB_GAP = hex('#9b907e');
const INLAY = hex('#9fd13b');
const INLAY_D = hex('#6f9a22');
const STONE = ['#a3a9b4', '#99a0ac', '#aeb4be', '#949ba7', '#a7adb7'].map(hex);
// the light / dark / speckled versions of every stone, brick and slab, worked out once
const COB_HI = COB.map((c) => shade(c, 0.22));
const COB_LO = COB.map((c) => shade(c, -0.2));
const COB_SPECK = COB.map((c) => shade(c, -0.14));
const BRICK_HI = BRICK.map((c) => shade(c, 0.18));
const BRICK_LO = BRICK.map((c) => shade(c, -0.12));
const BRICK_SPECK = [...BRICK, ...BRICK_HI, ...BRICK_LO].map((c) => shade(c, -0.25));
const SLAB_HI = SLAB.map((c) => shade(c, 0.25));

/** Integer hash -> [0, 1): the random-looking but repeatable variety of stones, moss and flowers. */
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** A painter over an RGBA buffer of `w` x `h` texture pixels, with shapes given in world units. */
function canvasOf(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  const S = GROUND_SCALE;
  const set = (i, c, a = 1) => {
    const k = i * 4;
    if (a >= 1) { data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255; return; }
    data[k] += (c[0] - data[k]) * a; data[k + 1] += (c[1] - data[k + 1]) * a; data[k + 2] += (c[2] - data[k + 2]) * a; data[k + 3] = 255;
  };
  const parsed = new Map();
  const rgb = (color) => { if (typeof color !== 'string') return color; let c = parsed.get(color); if (!c) { c = hex(color); parsed.set(color, c); } return c; };
  const rect = (x, y, rw, rh, color, a = 1) => {
    const c = rgb(color);
    const x0 = Math.max(0, Math.round(x * S)); const x1 = Math.min(w, Math.round((x + rw) * S));
    const y0 = Math.max(0, Math.round(y * S)); const y1 = Math.min(h, Math.round((y + rh) * S));
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) set(py * w + px, c, a);
  };
  const ellipse = (cx, cy, rx, ry, color, a = 1) => {
    const c = rgb(color);
    for (let py = Math.max(0, Math.floor((cy - ry) * S)); py < Math.min(h, Math.ceil((cy + ry) * S)); py++) {
      for (let px = Math.max(0, Math.floor((cx - rx) * S)); px < Math.min(w, Math.ceil((cx + rx) * S)); px++) {
        const dx = (px / S - cx) / rx; const dy = (py / S - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(py * w + px, c, a);
      }
    }
  };
  return { data, w, h, set, rect, ellipse };
}

/** Texture pixels within `radius` world units of the polylines (round joins and ends). */
function lineMask(lines, radius, w, h) {
  const S = GROUND_SCALE;
  const out = new Uint8Array(w * h);
  for (const line of lines) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i]; const [bx, by] = line[i + 1];
      const dx = bx - ax; const dy = by - ay; const len2 = dx * dx + dy * dy || 1;
      const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - radius) * S)); const x1 = Math.min(w, Math.ceil((Math.max(ax, bx) + radius) * S));
      const y0 = Math.max(0, Math.floor((Math.min(ay, by) - radius) * S)); const y1 = Math.min(h, Math.ceil((Math.max(ay, by) + radius) * S));
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const ux = (px + 0.5) / S; const uy = (py + 0.5) / S;
          const t = Math.max(0, Math.min(1, ((ux - ax) * dx + (uy - ay) * dy) / len2));
          const ex = ux - (ax + t * dx); const ey = uy - (ay + t * dy);
          if (ex * ex + ey * ey <= radius * radius) out[py * w + px] = 1;
        }
      }
    }
  }
  return out;
}

/** Texture pixels inside a convex polygon (world units). */
function polygonMask(points, w, h) {
  const S = GROUND_SCALE;
  const out = new Uint8Array(w * h);
  const xs = points.map((p) => p[0]); const ys = points.map((p) => p[1]);
  const edges = points.map(([ax, ay], i) => { const [bx, by] = points[(i + 1) % points.length]; return { ax, ay, dx: bx - ax, dy: by - ay }; });
  for (let py = Math.max(0, Math.floor(Math.min(...ys) * S)); py < Math.min(h, Math.ceil(Math.max(...ys) * S)); py++) {
    for (let px = Math.max(0, Math.floor(Math.min(...xs) * S)); px < Math.min(w, Math.ceil(Math.max(...xs) * S)); px++) {
      const ux = (px + 0.5) / S; const uy = (py + 0.5) / S;
      let inside = true;
      for (let i = 0; i < edges.length && inside; i++) {
        const e = edges[i];
        if (e.dx * (uy - e.ay) - e.dy * (ux - e.ax) < 0) inside = false;
      }
      if (inside) out[py * w + px] = 1;
    }
  }
  return out;
}

function paintFloor(cv) {
  const { w, h, data } = cv;
  const S = GROUND_SCALE;
  const wayOut = lineMask(MARKET_WAYS, WAY_WIDTH / 2 + 2, w, h);
  const wayIn = lineMask(MARKET_WAYS, WAY_WIDTH / 2, w, h);
  const plazaOut = polygonMask(octagonPoints(PLAZA, 4), w, h);
  const plazaIn = polygonMask(octagonPoints(PLAZA, 0), w, h);
  // a table of repeatable noise for the speckles, cheaper than hashing every pixel
  const NOISE = new Float32Array(4096);
  for (let i = 0; i < NOISE.length; i++) NOISE[i] = hash(i, 17, 5);
  const noise = (x, y) => NOISE[(x * 73 + y * 1031) & 4095];
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / 10); const off = (row & 1) * 7; const ly = y % 10;
    const brow = y >> 2; const bly = y & 3; const boff = (brow & 1) * 4;
    let cellX = -1; let v = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let c;
      if (plazaOut[i]) {
        if (!plazaIn[i]) c = ((x >> 3) + (y >> 3)) & 1 ? KERB_L : KERB;
        else {
          // rings of slabs round the well, a lime inlay on the fifth ring
          const dx = (x / S - PLAZA.x) / PLAZA.rx; const dy = (y / S - PLAZA.y) / PLAZA.ry;
          const rr = Math.hypot(dx, dy) * 7;
          const ring = Math.floor(rr); const seg = 6 + ring * 5;
          const a = ((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * seg; const si = Math.floor(a);
          const fr = rr - ring; const fa = ((a - si) * ((rr / 7) * 2 * Math.PI * PLAZA.rx * S)) / seg;
          if (ring === 4 && fr > 0.25 && fr < 0.75) c = fr < 0.35 || fr > 0.65 ? INLAY_D : INLAY;
          else if (fr < 0.07 || fa < 1.2) c = SLAB_GAP;
          else { const n = Math.floor(hash(ring, si, 3) * SLAB.length); c = fr < 0.16 ? SLAB_HI[n] : SLAB[n]; }
        }
      } else if (wayOut[i]) {
        if (!wayIn[i]) { const e = (x + y) % 6; c = e === 0 ? KERB_D : (e < 3 ? KERB_L : KERB); }
        else {
          // bricks in staggered rows, a light top edge on each
          const lx = (x + boff) & 7;
          if (lx === 0 || bly === 0) c = BRICK_GAP;
          else {
            const n = Math.floor(hash((x + boff) >> 3, brow, 7) * BRICK.length);
            const tone = bly === 1 ? 1 : (bly === 3 && lx === 7 ? 2 : 0);
            c = noise(x, y) > 0.992 ? BRICK_SPECK[tone * BRICK.length + n] : [BRICK, BRICK_HI, BRICK_LO][tone][n];
          }
        }
      } else {
        // rounded cobblestones in staggered rows; moss in a few joints, now and then a tuft of grass
        const cx = Math.floor((x + off) / 14); const lx = (x + off) % 14;
        if (cx !== cellX) { cellX = cx; v = hash(cx, row, 1); }
        const cornerPx = (lx < 2 || lx > 11) && (ly < 2 || ly > 7);
        if (lx === 0 || ly === 0 || cornerPx) c = v > 0.95 && ly === 0 ? ((x & 2) ? MOSS : MOSS_L) : COB_GAP;
        else if (v > 0.965 && ly > 3 && ly < 8 && lx > 4 && lx < 10) c = (lx + ly) & 1 ? MOSS_L : MOSS;
        else {
          const n = Math.floor(v * COB.length);
          if (ly === 1 || lx === 1) c = COB_HI[n];
          else if (ly === 9 || lx === 13) c = COB_LO[n];
          else c = noise(x, y) > 0.97 ? COB_SPECK[n] : COB[n];
        }
      }
      const k = i * 4;
      data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255;
    }
  }
}

/** Castle stone in staggered blocks, each with a light top edge, a dark bottom one, some moss and cracks. */
function blocks(cv, x0, y0, bw0, bh0, bw = 12, bh = 6, seed = 0) {
  const { rect } = cv;
  rect(x0, y0, bw0, bh0, '#5d6470');
  for (let y = y0, row = 0; y < y0 + bh0; y += bh, row++) {
    for (let x = x0 - (row & 1) * (bw / 2); x < x0 + bw0; x += bw) {
      const a = Math.max(x0, x); const b = Math.min(x0 + bw0, x + bw); const hh = Math.min(bh, y0 + bh0 - y);
      if (b - a <= 0.5) continue;
      const v = hash(Math.round(x * 2), Math.round(y * 2), seed);
      rect(a + 0.5, y + 0.5, b - a - 1, hh - 1, STONE[Math.floor(v * STONE.length)]);
      rect(a + 0.5, y + 0.5, b - a - 1, 0.5, '#d3d8df');
      rect(a + 0.5, y + hh - 1, b - a - 1, 0.5, '#7b828e');
      if (v > 0.9) { rect(a + 2, y + hh - 1.5, 3, 1, '#5f8a3c'); rect(a + 2.5, y + hh - 0.5, 1, 1.5, '#4f7a32'); }
      if (v < 0.06) { rect(a + 3, y + 1.5, 0.5, 2, '#6b727e'); rect(a + 3.5, y + 3, 0.5, 1.5, '#6b727e'); }
    }
  }
}

function ivy(cv, x, y, len) {
  for (let i = 0; i < len; i += 1.5) {
    const sx = x + Math.sin(i * 0.7) * 1.5;
    cv.rect(sx, y + i, 0.5, 1.5, '#3f6b2a');
    if (hash(Math.round(x), Math.round(i * 2), 9) > 0.45) { cv.rect(sx - 1.5, y + i, 1.5, 1, '#5fa040'); cv.rect(sx + 0.5, y + i + 0.5, 1.5, 1, '#78b84f'); }
  }
}

function banner(cv, x, y, main, emblem) {
  const { rect } = cv;
  rect(x - 1, y - 1, 14, 1.5, '#3a2a18'); rect(x - 1.5, y - 1.5, 1, 2.5, '#c08a3e'); rect(x + 12.5, y - 1.5, 1, 2.5, '#c08a3e');
  rect(x, y, 12, 24, main); rect(x, y, 12, 1, '#ffffff', 0.35); rect(x + 11, y, 1, 24, '#000000', 0.25);
  rect(x, y + 24, 5, 4, main); rect(x + 7, y + 24, 5, 4, main);
  rect(x + 1, y + 2, 10, 0.5, '#e8c45a'); rect(x + 1, y + 21, 10, 0.5, '#e8c45a');
  rect(x + 3.5, y + 7, 5, 7, emblem); rect(x + 4.5, y + 8, 3, 5, '#fdfdf6'); rect(x + 5.5, y + 9, 1, 3, emblem);
}

function wallTorch(cv, x, y) {
  const { rect } = cv;
  cv.ellipse(x + 1, y + 2, 9, 7, '#ffb347', 0.18);
  rect(x - 0.5, y + 5, 3, 1, '#2b2b2b'); rect(x, y + 3, 2, 6, '#3a2a18'); rect(x - 1, y + 2, 4, 1.5, '#4b5563');
  rect(x - 0.5, y - 2, 3, 4, '#ff9f1c'); rect(x, y - 3.5, 2, 3, '#ffe14d'); rect(x + 0.5, y - 4.5, 1, 1, '#fff7d6');
}

const BANNERS = [['#1e3a8a', '#c6ff3d'], ['#7f1d1d', '#ffd23f'], ['#14532d', '#c6ff3d'], ['#4c1d95', '#22d3ee']];

function paintWalls(cv) {
  const { rect } = cv;
  const { w: W, h: H } = MARKET_WORLD;
  // north wall: face of stone blocks, walkway and capped merlons on top, its shadow on the courtyard
  blocks(cv, 0, 10, W, WALL_N - 10, 12, 6, 1);
  rect(0, 8, W, 3, '#6b7280');
  for (let x = 0; x < W; x += 14) { blocks(cv, x, 0, 9, 10, 9, 5, 2); rect(x, 0, 9, 1, '#e3e7ec'); rect(x + 8.5, 1, 0.5, 9, '#5d6470'); }
  rect(0, WALL_N - 3, W, 3, '#4b525d');
  rect(WALL_SIDE, WALL_N, W - 2 * WALL_SIDE, 5, '#000000', 0.22);
  rect(WALL_SIDE, WALL_N + 5, W - 2 * WALL_SIDE, 3, '#000000', 0.1);
  for (let x = 72; x < W - 60; x += 120) { rect(x, 18, 3, 12, '#1f2430'); rect(x - 1, 23, 5, 2, '#1f2430'); }
  for (const x of [40, 210, 395, 560, 745, 905]) ivy(cv, x, 11, 22 + hash(x, 1) * 14);
  [120, 300, 450, 498, 650, 830].forEach((x, i) => banner(cv, x, 12, ...BANNERS[i % BANNERS.length]));
  for (const x of [180, 365, 590, 775]) wallTorch(cv, x, 22);

  // side walls seen from above: merlons on the outer edge, a dark inner edge and its shadow
  const bottom = H - WALL_S;
  for (const x of [0, W - WALL_SIDE]) {
    blocks(cv, x, WALL_N, WALL_SIDE, bottom - WALL_N, 8, 6, x ? 5 : 4);
    rect(x ? x : x + WALL_SIDE - 2, WALL_N, 2, bottom - WALL_N, '#4b525d');
    for (let y = WALL_N + 4; y < bottom; y += 12) rect(x ? x + 10 : x + 1, y, 5, 7, '#b8bec7');
  }
  rect(WALL_SIDE, WALL_N, 4, bottom - WALL_N, '#000000', 0.18);

  // south wall with the gate: the dark passage with the plaza's green beyond, the portcullis pulled up and the
  // two wooden doors open against the sides
  const g = EXIT_GATE;
  blocks(cv, 0, bottom, g.x, WALL_S, 12, 6, 6);
  blocks(cv, g.x + g.w, bottom, W - g.x - g.w, WALL_S, 12, 6, 7);
  rect(0, bottom, W, 1, '#e3e7ec');
  for (let x = 4; x < W; x += 14) if (x + 9 < g.x - 14 || x > g.x + g.w + 14) rect(x, H - 5, 9, 5, '#b8bec7');
  rect(g.x + 10, g.y - 4, g.w - 20, g.h + 4, '#3a2a18');
  rect(g.x + 12, g.y + 4, g.w - 24, g.h - 4, '#52b441'); rect(g.x + 12, g.y + 4, g.w - 24, 1, '#7ad35f');
  for (let i = 0; i < 6; i++) rect(g.x + 14 + hash(i, 3) * (g.w - 30), g.y + 8 + hash(i, 4) * 16, 1, 1, '#ffe14d');
  for (let x = g.x + 13; x < g.x + g.w - 12; x += 3) rect(x, g.y - 2, 1, 5, '#2b2b2b');
  rect(g.x + 10, g.y - 4, g.w - 20, 2, '#1b1208');
  for (const [dx, hinge] of [[g.x + 10, 0], [g.x + g.w - 16, 5]]) {
    rect(dx, g.y + 2, 6, g.h - 2, '#7a4a22'); rect(dx + hinge, g.y + 2, 1, g.h - 2, '#3a2a18');
    for (let y = g.y + 6; y < g.y + g.h; y += 8) { rect(dx, y, 6, 1, '#2b2b2b'); rect(dx + 1, y - 0.5, 1, 1, '#9ca3af'); rect(dx + 4, y - 0.5, 1, 1, '#9ca3af'); }
  }
}

/**
 * Paints the whole market (MARKET_WORLD at GROUND_SCALE): returns { width, height, data } with `data` an RGBA
 * buffer, every pixel opaque.
 */
export function paintMarketGround() {
  const cv = canvasOf(MARKET_WORLD.w * GROUND_SCALE, MARKET_WORLD.h * GROUND_SCALE);
  paintFloor(cv);
  paintWalls(cv);
  return { width: cv.w, height: cv.h, data: cv.data };
}

export function buildMarketGroundCanvas(createCanvas = () => document.createElement('canvas')) {
  const { width, height, data } = paintMarketGround();
  const canvas = createCanvas();
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  return canvas;
}
