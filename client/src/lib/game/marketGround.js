// The ground of the market inside the castle: cobblestones, packed-earth market ways, the castle walls with
// battlements, banners and torches all around, and the gate back to the plaza in the south wall. Painted once
// into a canvas shown as a single sprite, deterministic like groundSprite.js (tests/game-market.test.js).
import { MARKET_WORLD, MARKET_PATHS, WALLS, EXIT_GATE } from './marketMap';

const STONES = ['#8b8478', '#958d80', '#7f786d', '#9a9285'];
const GAP = '#5b554c';
const WALL = '#9aa1ad';
const WALL_D = '#6b7280';
const WALL_L = '#cdd2da';
const LIME = '#c6ff3d';

function lcg(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Paints the whole market (MARKET_WORLD.w x MARKET_WORLD.h) into a 2D context at 1:1. */
export function paintMarketGround(ctx) {
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const { w: W, h: H } = MARKET_WORLD;
  const rand = lcg(1347);

  // cobblestones: staggered rows of stones of slightly different shades, dark gaps between them
  px(0, 0, W, H, GAP);
  for (let row = 0, y = 0; y < H; y += 7, row++) {
    for (let x = row % 2 ? -5 : 0; x < W; x += 10) {
      const x0 = Math.max(0, x + 1);
      const w = Math.min(x + 10, W) - x0;
      const h = Math.min(6, H - y);
      if (w <= 0 || h <= 0) continue;
      px(x0, y, w, h, STONES[Math.floor(rand() * STONES.length)]);
      px(x0, y, w, 1, 'rgba(255,255,255,0.12)');
    }
  }

  // packed-earth market ways
  for (const r of MARKET_PATHS) px(r.x - 1, r.y - 1, r.w + 2, r.h + 2, '#8a6a3c');
  for (const r of MARKET_PATHS) {
    px(r.x, r.y, r.w, r.h, '#c9a36b');
    for (let i = 0; i < (r.w * r.h) / 40; i++) {
      px(r.x + Math.floor(rand() * (r.w - 1)), r.y + Math.floor(rand() * (r.h - 1)), 1, 1, rand() > 0.5 ? '#a8824c' : '#e0c08a');
    }
  }

  // castle walls: stone blocks with mortar
  const stone = (r) => {
    px(r.x, r.y, r.w, r.h, WALL);
    for (let y = r.y + 5, row = 0; y < r.y + r.h; y += 6, row++) {
      px(r.x, y, r.w, 1, WALL_D);
      for (let x = r.x + (row % 2 ? 4 : 0) + 6; x < r.x + r.w; x += 9) px(x, y - 5, 1, 5, WALL_D);
    }
  };
  for (const r of WALLS) stone(r);
  const [north] = WALLS;
  // battlements along the north wall and its shadow on the square
  for (let x = 0; x + 6 <= W; x += 10) { px(x, 0, 6, 6, WALL_L); px(x + 5, 1, 1, 5, WALL_D); }
  px(16, north.h, W - 32, 3, 'rgba(0,0,0,0.25)');
  // banners in the Annunci colour and torches on the north wall
  for (let x = 30; x < W - 30; x += 60) {
    px(x, 10, 12, 1, '#3a2a18');
    px(x + 1, 11, 10, 22, LIME);
    px(x + 1, 33, 4, 3, LIME);
    px(x + 7, 33, 4, 3, LIME);
    px(x + 4, 17, 4, 4, '#14532d');
    px(x + 5, 18, 2, 2, '#fdfdf6');
  }
  for (let x = 60; x < W - 30; x += 60) {
    px(x - 3, 14, 7, 12, 'rgba(255,190,80,0.25)');
    px(x, 20, 2, 8, '#3a2a18');
    px(x - 1, 16, 4, 4, '#ff9f1c');
    px(x, 15, 2, 2, '#ffe14d');
  }
  // corner towers
  for (const tx of [0, W - 28]) {
    px(tx, 0, 28, 52, WALL_D);
    px(tx + 2, 2, 24, 48, WALL);
    px(tx + 2, 2, 24, 2, WALL_L);
    px(tx + 12, 20, 4, 10, '#1f2430');
  }

  // the gate in the south wall: two small towers and a dark passage with the portcullis pulled up
  const g = EXIT_GATE;
  px(g.x, g.y - 4, 14, g.h + 4, WALL_D);
  px(g.x + g.w - 14, g.y - 4, 14, g.h + 4, WALL_D);
  px(g.x + 1, g.y - 3, 12, g.h + 3, WALL);
  px(g.x + g.w - 13, g.y - 3, 12, g.h + 3, WALL);
  px(g.x + 1, g.y - 3, 12, 1, WALL_L);
  px(g.x + g.w - 13, g.y - 3, 12, 1, WALL_L);
  px(g.x + 14, g.y + 2, g.w - 28, g.h - 2, '#1b1208');
  px(g.x + 14, g.y + 2, g.w - 28, 4, '#111111');
  for (let x = g.x + 16; x < g.x + g.w - 14; x += 4) px(x, g.y + 2, 1, 4, '#3a2a18');
  // the green of the plaza seen through the gate
  px(g.x + 16, g.y + 14, g.w - 32, g.h - 14, '#52b441');
  px(g.x + 16, g.y + 14, g.w - 32, 1, '#7ad35f');
  // lime pennants on the gate towers
  for (const tx of [g.x + 6, g.x + g.w - 8]) { px(tx, g.y - 12, 1, 8, '#3a2a18'); px(tx + 1, g.y - 12, 5, 3, LIME); }
}

export function buildMarketGroundCanvas(createCanvas = () => document.createElement('canvas')) {
  const canvas = createCanvas();
  canvas.width = MARKET_WORLD.w;
  canvas.height = MARKET_WORLD.h;
  paintMarketGround(canvas.getContext('2d'));
  return canvas;
}
