// The ground of "CardBrix the game": a bright LEGO-baseplate world (studded grass, brick-paved paths, a pond
// framed by bricks, loose bricks and flowers), painted once into a canvas that the Kaplay scene shows as a
// single sprite. Layout comes from gameMap.js; decorations are generated deterministically (no Math.random)
// so every client draws the same world. Pure painting code: unit-tested in tests/game-ground.test.js.
import { WORLD, PATHS, DECOR, BLOCKED, BUILDINGS, CREDITS_PLACE, overlaps } from './gameMap';

export const BRICK_COLORS = ['#e53935', '#ffd23f', '#2f6fe0', '#2fa84f'];
const GRASS_A = '#5cbf4a';
const GRASS_B = '#52b441';
const STUD = '#7ad35f';
const STUD_D = '#3f9a33';
const DIRT = '#e8c07a';
const DIRT_D = '#c9954d';
const DIRT_E = '#9a6a2e';
const TILE = 16;

const inflate = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return `#${((1 << 24) | (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1)}`;
}

// One painter per path style (gameMap.js PATHS[].style). Each paints only inside its rect `r`.
const PATH_PAINTERS = {
  // light grey baseplate with a stud every 8px
  lego_road_grey(px, r) {
    px(r.x, r.y, r.w, r.h, '#a9adb8');
    for (let y = r.y + 2; y + 4 <= r.y + r.h; y += 8) {
      for (let x = r.x + 2; x + 4 <= r.x + r.w; x += 8) {
        px(x, y, 4, 4, '#8a8e99');
        px(x, y, 3, 3, '#c8ccd6');
      }
    }
  },
  // a carpet in the shop's colour: darker body, light borders, chevrons pointing to the door
  pillar_carpet(px, r) {
    const tint = r.tint || '#c6ff3d';
    px(r.x, r.y, r.w, r.h, shade(tint, -0.45));
    px(r.x + 1, r.y, 2, r.h, shade(tint, -0.1));
    px(r.x + r.w - 3, r.y, 2, r.h, shade(tint, -0.1));
    const cx = r.x + Math.floor(r.w / 2);
    for (let y = r.y + 4; y + 4 <= r.y + r.h; y += 10) {
      for (let k = 0; k < 4; k++) {
        px(cx - 4 + k, y + k, 1, 1, tint);
        px(cx + 3 - k, y + k, 1, 1, tint);
      }
    }
  },
  // a tournament play mat with a faint grid; the summoning circle is added around the statue afterwards
  tcg_summon_plaza(px, r) {
    px(r.x, r.y, r.w, r.h, '#262b4a');
    for (let x = r.x + 7; x < r.x + r.w; x += 8) px(x, r.y, 1, r.h, '#2e355a');
    for (let y = r.y + 7; y < r.y + r.h; y += 8) px(r.x, y, r.w, 1, '#2e355a');
    px(r.x, r.y, r.w, 1, '#4b5594');
    px(r.x, r.y + r.h - 1, r.w, 1, '#4b5594');
  },
  // a mosaic of muted bricks in the four brick colours
  lego_plaza_mosaic(px, r) {
    px(r.x, r.y, r.w, r.h, DIRT_D);
    const tiles = ['#e8c07a', '#d9a75c', '#e8c07a', '#cfa065'];
    const accents = BRICK_COLORS.map((c) => shade(c, -0.15));
    for (let row = 0, y = r.y; y < r.y + r.h; y += 8, row++) {
      const h = Math.min(7, r.y + r.h - y);
      for (let col = 0, x = r.x - (row % 2 ? 6 : 0); x < r.x + r.w; x += 12, col++) {
        const x0 = Math.max(x, r.x);
        const w = Math.min(x + 11, r.x + r.w) - x0;
        if (w <= 0) continue;
        const accent = (row * 7 + col * 3) % 9 === 0;
        px(x0, y, w, h, accent ? accents[(row + col) % 4] : tiles[(row + col) % 4]);
      }
    }
  },
  // dark runway with neon arrows pointing up toward the plaza
  spawn_runway_neon(px, r) {
    px(r.x, r.y, r.w, r.h, '#1b1f33');
    px(r.x, r.y, 1, r.h, '#22d3ee');
    px(r.x + r.w - 1, r.y, 1, r.h, '#22d3ee');
    const cx = r.x + Math.floor(r.w / 2);
    for (let y = r.y + 3; y + 5 <= r.y + r.h; y += 9) {
      for (let k = 0; k < 5; k++) px(cx - k, y + k, 2 * k + 1, 1, k === 0 ? '#e0fbff' : '#22d3ee');
    }
  },
};

/** Tiny deterministic generator (same sequence on every machine). */
function lcg(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Areas decorations must keep clear of: paths, obstacles, the stalls (with their awnings) and the statue.
function keepClear() {
  return [
    ...PATHS.map((p) => inflate(p, 5)),
    ...BLOCKED.map((b) => inflate(b, 8)),
    ...BUILDINGS.map((b) => inflate({ x: b.x - 3, y: b.y, w: b.w + 6, h: b.h + 16 }, 6)),
    inflate({ x: CREDITS_PLACE.x - 14, y: CREDITS_PLACE.y - 64, w: CREDITS_PLACE.w + 28, h: CREDITS_PLACE.h + 84 }, 4),
    // the border where the world ends
    { x: -20, y: -20, w: WORLD.w + 40, h: 22 }, { x: -20, y: WORLD.h - 4, w: WORLD.w + 40, h: 30 },
    { x: -20, y: -20, w: 24, h: WORLD.h + 40 }, { x: WORLD.w - 4, y: -20, w: 30, h: WORLD.h + 40 },
  ];
}

/** Loose bricks lying on the grass: [{ x, y, w, h, color }] (never on paths, obstacles or stalls). */
export function brickDecor(count = 28) {
  const rand = lcg(20241019);
  const clear = keepClear();
  const out = [];
  for (let attempt = 0; attempt < 4000 && out.length < count; attempt++) {
    const w = [8, 16, 24][Math.floor(rand() * 3)];
    const brick = { x: Math.floor(rand() * (WORLD.w - 40)) + 8, y: Math.floor(rand() * (WORLD.h - 30)) + 8, w, h: 8, color: BRICK_COLORS[Math.floor(rand() * 4)] };
    if (clear.some((r) => overlaps(brick, r))) continue;
    if (out.some((o) => overlaps(inflate(brick, 4), o))) continue;
    out.push(brick);
  }
  return out;
}

/** Small flowers: [{ x, y, color }]. */
export function flowers(count = 70) {
  const rand = lcg(77);
  const clear = [...keepClear(), ...brickDecor().map((b) => inflate(b, 3))];
  const colors = ['#ffffff', '#ff7eb6', '#ffd23f', '#9ad1ff'];
  const out = [];
  for (let attempt = 0; attempt < 4000 && out.length < count; attempt++) {
    const f = { x: Math.floor(rand() * (WORLD.w - 16)) + 8, y: Math.floor(rand() * (WORLD.h - 16)) + 8, color: colors[Math.floor(rand() * colors.length)] };
    if (clear.some((r) => overlaps({ x: f.x - 1, y: f.y - 1, w: 3, h: 3 }, r))) continue;
    out.push(f);
  }
  return out;
}

export const PATH_STYLES = Object.keys(PATH_PAINTERS);

/** Paints the whole ground (WORLD.w x WORLD.h) into a 2D context at 1:1. */
export function paintGround(ctx) {
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  // studded grass: a checker of two greens with a stud in every tile, like a baseplate
  for (let ty = 0; ty < WORLD.h / TILE; ty++) {
    for (let tx = 0; tx < WORLD.w / TILE; tx++) {
      const x = tx * TILE;
      const y = ty * TILE;
      px(x, y, TILE, TILE, (tx + ty) % 2 ? GRASS_A : GRASS_B);
      px(x + 5, y + 5, 6, 6, STUD_D);
      px(x + 5, y + 5, 5, 5, STUD);
      px(x + 6, y + 6, 2, 1, '#bff3a2');
    }
  }

  // pond framed by bricks
  const p = DECOR.pond;
  px(p.x - 6, p.y - 6, p.w + 12, p.h + 12, '#6b4a22');
  for (let x = p.x - 6, i = 0; x < p.x + p.w + 6; x += 8, i++) {
    px(x, p.y - 6, 8, 6, BRICK_COLORS[i % 4]);
    px(x, p.y + p.h, 8, 6, BRICK_COLORS[(i + 2) % 4]);
  }
  for (let y = p.y, i = 0; y < p.y + p.h; y += 8, i++) {
    px(p.x - 6, y, 6, 8, BRICK_COLORS[(i + 1) % 4]);
    px(p.x + p.w, y, 6, 8, BRICK_COLORS[(i + 3) % 4]);
  }
  px(p.x, p.y, p.w, p.h, '#2d7be0');
  px(p.x, p.y + p.h / 2, p.w, p.h / 2, '#2468c4');
  px(p.x + 6, p.y + 6, 22, 2, '#9fd0ff');
  px(p.x + 36, p.y + 24, 26, 2, '#9fd0ff');
  px(p.x + 12, p.y + 38, 16, 2, '#9fd0ff');

  // paved paths: dark edge first (union of all paths), then each path in its own style (brick paving when the
  // style is unknown)
  for (const r of PATHS) px(r.x - 1, r.y - 1, r.w + 2, r.h + 2, DIRT_E);
  for (const r of PATHS) {
    const painter = PATH_PAINTERS[r.style];
    if (painter) { painter(px, r); continue; }
    px(r.x, r.y, r.w, r.h, DIRT);
    for (let row = 0, y = r.y; y < r.y + r.h; y += 8, row++) {
      const h = Math.min(8, r.y + r.h - y);
      px(r.x, y + h - 1, r.w, 1, DIRT_D); // mortar between rows
      for (let x = r.x - (row % 2 ? 8 : 0); x < r.x + r.w; x += 16) {
        const cx = Math.max(x, r.x);
        if (cx > r.x || x === r.x) px(cx, y, 1, h, DIRT_D); // mortar between bricks
        px(Math.max(x + 1, r.x), y, Math.min(14, r.x + r.w - Math.max(x + 1, r.x)), 1, '#f6dca3'); // light top edge
      }
    }
  }

  // plaza emblem under the dragon statue, inside a cyan summoning circle
  const cx = CREDITS_PLACE.x + CREDITS_PLACE.w / 2;
  const cy = CREDITS_PLACE.y + CREDITS_PLACE.h;
  const ring = (rx, ry, c) => {
    for (let y = -ry; y <= ry; y++) {
      const half = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
      if (half > 0) px(cx - half, cy + y, half * 2, 1, c);
    }
  };
  ring(56, 25, '#22d3ee');
  ring(55, 24, '#262b4a');
  for (let a = 0; a < 16; a++) { // rune dots on the circle
    const t = (a / 16) * Math.PI * 2;
    px(Math.round(cx + Math.cos(t) * 55) - 1, Math.round(cy + Math.sin(t) * 24) - 1, 2, 2, '#a5f3fc');
  }
  ring(54, 22, '#b9894a');
  ring(51, 20, '#f2c14e');
  ring(47, 18, '#d8a85c');
  ring(43, 16, '#e8c07a');

  // loose bricks (top view: body, border, two studs) and flowers
  for (const b of brickDecor()) {
    px(b.x + 1, b.y + 2, b.w, b.h, 'rgba(0,0,0,0.25)'); // soft shadow
    px(b.x, b.y, b.w, b.h, '#101010');
    px(b.x + 1, b.y + 1, b.w - 2, b.h - 2, b.color);
    px(b.x + 1, b.y + 1, b.w - 2, 1, 'rgba(255,255,255,0.35)');
    for (let sx = b.x + 4; sx < b.x + b.w - 2; sx += 8) {
      px(sx - 1, b.y + 2, 4, 4, 'rgba(0,0,0,0.3)');
      px(sx - 1, b.y + 2, 3, 3, 'rgba(255,255,255,0.45)');
    }
  }
  for (const f of flowers()) {
    px(f.x, f.y, 1, 1, '#ffb703');
    px(f.x - 1, f.y, 1, 1, f.color);
    px(f.x + 1, f.y, 1, 1, f.color);
    px(f.x, f.y - 1, 1, 1, f.color);
    px(f.x, f.y + 1, 1, 1, f.color);
  }
}

export function buildGroundCanvas(createCanvas = () => document.createElement('canvas')) {
  const canvas = createCanvas();
  canvas.width = WORLD.w;
  canvas.height = WORLD.h;
  paintGround(canvas.getContext('2d'));
  return canvas;
}
