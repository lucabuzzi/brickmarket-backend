// The CardBrix dragon (statue in the middle of the plaza, "VITTORIA!" screen): a blue dragon with orange wings,
// a golden belly and a pile of gold coins, like the one in the CardBrix game video. Drawn entirely in code on a
// small pixel grid (no image asset), then an automatic dark outline is added around every shape.
// Pure: paintDragonGrid() returns rows of palette characters (unit-tested), renderDragon() paints them.
export const DRAGON_W = 52;
export const DRAGON_H = 48;
const MID = DRAGON_W - 1; // x -> MID - x mirrors a point across the centre line

export const DRAGON_PALETTE = {
  K: '#0a1230', // outline
  B: '#2f6fe0', // blue body
  b: '#6aa6ff', // blue highlight
  d: '#1b3f9a', // blue shadow / wing bones
  G: '#ffd23f', // gold
  g: '#c99400', // gold shadow
  O: '#ff8a2a', // orange wing
  o: '#c4521a', // orange shadow
  R: '#f6ead0', // horns / claws
  Y: '#fff08a', // eyes / coin shine
};

function makeGrid() {
  return Array.from({ length: DRAGON_H }, () => Array(DRAGON_W).fill('.'));
}

function plot(g, x, y, ch) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi >= 0 && xi < DRAGON_W && yi >= 0 && yi < DRAGON_H) g[yi][xi] = ch;
}

function fillEllipse(g, cx, cy, rx, ry, ch) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) plot(g, x, y, ch);
    }
  }
}

/** Even-odd scanline fill, sampled at pixel centres. */
function fillPoly(g, pts, ch) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      const yc = y + 0.5;
      if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) plot(g, x, y, ch);
    }
  }
}

function line(g, x0, y0, x1, y1, ch) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) plot(g, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, ch);
}

const mirrorPts = (pts) => pts.map(([x, y]) => [DRAGON_W - x, y]); // continuous mirror for polygons

/** The dragon as DRAGON_H rows of DRAGON_W palette characters ('.' = transparent). */
export function paintDragonGrid() {
  const g = makeGrid();

  // tail curling out to the right
  [[33, 40, 3.6], [37, 42, 3.4], [41, 42, 3], [44, 40, 2.6], [46, 37, 2.2], [47, 34, 1.8], [46, 31, 1.4]]
    .forEach(([x, y, r]) => fillEllipse(g, x, y, r, r, 'B'));
  fillPoly(g, [[44, 31], [50, 28], [48, 35]], 'O');

  // wings (left, then mirrored): membrane, shadowed lower half, bones
  const wing = [[19, 20], [3, 4], [4, 13], [5, 22], [10, 28], [18, 31]];
  const wingLow = [[19, 25], [5, 22], [10, 28], [18, 31]];
  const bones = [[3, 4], [4, 13], [5, 22], [10, 28]];
  for (const pts of [wing, mirrorPts(wing)]) fillPoly(g, pts, 'O');
  for (const pts of [wingLow, mirrorPts(wingLow)]) fillPoly(g, pts, 'o');
  for (const [tx, ty] of bones) {
    line(g, 19, 21, tx, ty, 'd');
    line(g, MID - 19, 21, MID - tx, ty, 'd');
  }

  // body, belly, neck
  fillEllipse(g, 26, 29, 10, 12, 'd');
  fillEllipse(g, 25, 28, 9, 11, 'B');
  fillEllipse(g, 22, 24, 4, 6, 'b');
  fillEllipse(g, 26, 31, 5, 9, 'G');
  for (let y = 25; y <= 38; y += 3) for (let x = 22; x <= 30; x++) if (g[y][x] === 'G') plot(g, x, y, 'g');
  fillEllipse(g, 26, 18, 5, 7, 'B');

  // horns and ear fins
  const horn = [[19, 8], [14, 1], [18, 4], [21, 6]];
  const fin = [[18, 10], [12, 9], [18, 14]];
  for (const pts of [horn, mirrorPts(horn)]) fillPoly(g, pts, 'R');
  for (const pts of [fin, mirrorPts(fin)]) fillPoly(g, pts, 'O');
  fillPoly(g, [[24, 4], [26, 0], [28, 4]], 'G');

  // head, snout, face
  fillEllipse(g, 26, 11, 8, 6.5, 'B');
  fillEllipse(g, 24, 8, 4, 2.5, 'b');
  fillEllipse(g, 26, 15, 5, 3.5, 'b');
  plot(g, 24, 15, 'K'); plot(g, 28, 15, 'K');
  line(g, 23, 17, 29, 17, 'K');
  plot(g, 23, 17, 'R'); plot(g, 29, 17, 'R');
  for (const x of [20, 21, 22]) { plot(g, x, 9, 'Y'); plot(g, x, 10, 'Y'); plot(g, MID - x, 9, 'Y'); plot(g, MID - x, 10, 'Y'); }
  plot(g, 22, 10, 'K'); plot(g, MID - 22, 10, 'K');
  line(g, 19, 7, 23, 8, 'K'); line(g, MID - 19, 7, MID - 23, 8, 'K');

  // front legs and claws
  for (const cx of [17, 35]) {
    fillEllipse(g, cx, 38, 4, 4, 'B');
    fillEllipse(g, cx - 1, 36, 2, 2, 'b');
    [-3, 0, 3].forEach((dx) => fillPoly(g, [[cx + dx - 1, 41], [cx + dx + 1, 41], [cx + dx, 44]], 'R'));
  }

  // pile of gold coins
  fillEllipse(g, 26, 45, 18, 3.5, 'g');
  [[10, 44], [16, 46], [22, 45], [30, 46], [36, 45], [42, 44], [26, 43], [20, 43], [33, 43]].forEach(([x, y]) => {
    fillEllipse(g, x, y, 3, 1.7, 'G');
    plot(g, x - 1, y - 1, 'Y');
  });

  // dark outline around every shape
  const filled = g.map((row) => row.map((c) => c !== '.'));
  for (let y = 0; y < DRAGON_H; y++) {
    for (let x = 0; x < DRAGON_W; x++) {
      if (filled[y][x]) continue;
      const near = (filled[y - 1] && filled[y - 1][x]) || (filled[y + 1] && filled[y + 1][x]) || filled[y][x - 1] || filled[y][x + 1];
      if (near) g[y][x] = 'K';
    }
  }
  return g.map((row) => row.join(''));
}

/** Paints the dragon with its top-left corner at (ox, oy). */
export function renderDragon(ctx, ox = 0, oy = 0, rows = paintDragonGrid()) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = DRAGON_PALETTE[row[x]];
      if (c) { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, 1, 1); }
    }
  });
}

export function buildDragonCanvas(createCanvas = () => document.createElement('canvas')) {
  const canvas = createCanvas();
  canvas.width = DRAGON_W;
  canvas.height = DRAGON_H;
  renderDragon(canvas.getContext('2d'));
  return canvas;
}
