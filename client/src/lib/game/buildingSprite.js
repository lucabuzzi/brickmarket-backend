// The buildings of "CardBrix the game", drawn in code like the bancarelle of the game video: wooden stall,
// striped awning in the pillar colour, hanging sign board, a counter with props that tell what is sold there
// (auction timer and gavel / glowing puzzle cubes / books), and a door in the middle. Annunci is a small stone
// castle instead (style 'castle'), whose gate leads to the market (its shops are artwork, see marketMap.js).
// The sign text and the auction timer digits are drawn live by the scene; this file only paints the pixels.
export const BUILDING_PAD = 3; // the awning overhangs the walls by 3px on each side
export const AUCTION_TIMER_BOX = { x: 58, y: 41, w: 26, h: 9 }; // coordinates inside the building box
// Room above the building box for the roof decoration (studs, flames, antenna, glass dome) and the sign icon:
// the canvas is this much taller and the scene draws it this much higher.
export const ROOF_EXTRA = 12;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return `#${((1 << 24) | (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1)}`;
}

/** Paints the roof decoration of `roofStyle` and the `signIcon` above a building box of width `w`. */
function paintRoof(px, { w, color, roofStyle, signIcon }) {
  const mid = Math.floor(w / 2);
  if (roofStyle === 'lego_studs') {
    for (let x = 2; x + 6 <= w; x += 10) {
      px(x, -4, 6, 4, shade(color, -0.35));
      px(x, -4, 6, 1, shade(color, 0.2));
      px(x + 1, -3, 4, 2, shade(color, -0.15));
    }
  } else if (roofStyle === 'fire') {
    // pixel flames along the roof
    for (let x = 1; x + 5 <= w; x += 9) {
      const tall = Math.floor(x / 9) % 2 === 0 ? 9 : 6;
      for (let k = 0; k < tall; k++) {
        const width = Math.max(1, 5 - Math.floor((k * 5) / tall));
        px(x + Math.floor((5 - width) / 2), -1 - k, width, 1, k < tall / 3 ? '#ff5a36' : k < (2 * tall) / 3 ? '#ff9f1c' : '#ffe14d');
      }
    }
  } else if (roofStyle === 'cyber_grid') {
    // neon grid on the roof beam and an antenna with a blinking tip
    px(-BUILDING_PAD, 3, w + 2 * BUILDING_PAD, 1, '#22d3ee');
    for (let x = 4; x < w; x += 8) px(x, 0, 1, 8, '#22d3ee');
    px(w - 12, -10, 1, 10, '#9ca3af');
    px(w - 14, -11, 5, 2, '#22d3ee');
    px(10, -6, 1, 6, '#9ca3af');
    px(9, -7, 3, 2, '#f472b6');
  } else if (roofStyle === 'crystal_dome') {
    // a glass dome (half ellipse) on the middle of the roof
    const rx = 20;
    const ry = 11;
    for (let y = 0; y < ry; y++) {
      const half = Math.floor(rx * Math.sqrt(1 - ((ry - y) * (ry - y)) / (ry * ry)));
      if (half > 0) {
        px(mid - half, y - ry, half * 2, 1, y < 2 ? '#1e3a8a' : '#93c5fd');
        px(mid - half, y - ry, 1, 1, '#1e3a8a');
        px(mid + half - 1, y - ry, 1, 1, '#1e3a8a');
      }
    }
    px(mid - 12, -7, 3, 4, '#e0f2fe'); // glass shine
    px(mid - rx, -1, rx * 2, 1, '#1e3a8a');
  }

  // the sign icon, centred above the roof
  const ix = mid - 4;
  if (signIcon === 'booster') { // holographic booster pack
    px(ix, -12, 8, 11, '#111111');
    px(ix + 1, -11, 6, 9, '#a855f7');
    px(ix + 1, -9, 6, 2, '#22d3ee');
    px(ix + 1, -5, 6, 1, '#f472b6');
    px(ix + 1, -11, 6, 1, '#e5e7eb');
  } else if (signIcon === 'gavel') { // auction gavel
    px(ix - 1, -11, 10, 4, '#111111');
    px(ix, -10, 8, 2, '#c08a3e');
    px(ix + 3, -7, 2, 6, '#8b5a2b');
  } else if (signIcon === 'puzzle') { // glowing puzzle piece
    px(ix, -9, 8, 8, '#111111');
    px(ix + 1, -8, 6, 6, '#c084fc');
    px(ix + 3, -11, 3, 3, '#c084fc');
    px(ix + 7, -6, 2, 2, '#c084fc');
    px(ix + 2, -7, 2, 1, '#f5d0fe');
  } else if (signIcon === 'slab') { // graded card slab
    px(ix, -12, 8, 11, '#111111');
    px(ix + 1, -11, 6, 9, '#e5e7eb');
    px(ix + 1, -11, 6, 2, '#ffd23f');
    px(ix + 2, -8, 4, 5, '#3b82f6');
  }
}

/** Paints building `b` ({ id, w, h, color, roofStyle, signIcon }) with its box's top-left corner at
 * (ox + PAD, oy + ROOF_EXTRA); the band above holds the roof decoration. */
export function paintBuilding(ctx, b, ox = 0, oy = 0) {
  const X = ox + BUILDING_PAD;
  const Y = oy + ROOF_EXTRA;
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(X + x, Y + y, w, h); };
  if (b.style === 'castle') { paintCastle(px, b); return; }
  const { w, h, color } = b;
  const awning = color;
  const dark = shade(awning, -0.45);

  // back wall: wooden planks
  px(0, 20, w, h - 20, '#8b5a2b');
  for (let x = 6; x < w; x += 6) px(x, 20, 1, h - 20, '#6d4421');
  px(0, 20, w, 2, '#a8702f');
  // side posts
  px(0, 8, 4, h - 8, '#5e3a18');
  px(w - 4, 8, 4, h - 8, '#5e3a18');
  px(3, 8, 1, h - 8, '#7a4e22');
  px(w - 4, 8, 1, h - 8, '#7a4e22');

  // roof beam + striped scalloped awning
  px(-BUILDING_PAD, 0, w + 2 * BUILDING_PAD, 8, dark);
  px(-BUILDING_PAD, 0, w + 2 * BUILDING_PAD, 2, shade(awning, -0.15));
  px(-BUILDING_PAD, 7, w + 2 * BUILDING_PAD, 1, 'rgba(0,0,0,0.35)');
  const stripes = 8;
  const sw = (w + 2 * BUILDING_PAD) / stripes;
  for (let i = 0; i < stripes; i++) {
    const x = -BUILDING_PAD + Math.round(i * sw);
    const next = -BUILDING_PAD + Math.round((i + 1) * sw);
    const c = i % 2 ? '#fdfdf6' : awning;
    px(x, 8, next - x, 12, c);
    for (let k = 0; k < 4; k++) px(x + k, 20 + k, next - x - 2 * k, 1, c); // round the bottom edge
    px(x, 8, next - x, 1, 'rgba(255,255,255,0.35)');
  }
  px(-BUILDING_PAD, 19, w + 2 * BUILDING_PAD, 1, 'rgba(0,0,0,0.2)');

  // hanging sign board (the scene writes the name on it)
  px(6, 28, w - 12, 12, '#2a1a0e');
  px(6, 28, w - 12, 1, '#c08a3e');
  px(6, 39, w - 12, 1, '#c08a3e');
  px(6, 28, 1, 12, '#c08a3e');
  px(w - 7, 28, 1, 12, '#c08a3e');
  px(12, 26, 1, 2, '#5e3a18');
  px(w - 13, 26, 1, 2, '#5e3a18');

  // lanterns
  for (const lx of [4, w - 8]) {
    px(lx, 21, 1, 3, '#3a2a18');
    px(lx - 1, 24, 4, 5, '#ffe08a');
    px(lx - 1, 24, 4, 1, '#fff6c9');
    px(lx - 2, 23, 6, 7, 'rgba(255,224,138,0.22)');
  }

  // door (middle): dark frame, pillar-coloured inside
  px(33, h - 24, 22, 24, '#1b1208');
  px(35, h - 22, 18, 22, shade(awning, -0.55));
  px(35, h - 22, 18, 2, shade(awning, -0.35));
  px(49, h - 11, 2, 2, color);

  // counter on both sides of the door
  for (const [cx, cw] of [[4, 28], [56, 28]]) {
    px(cx, 52, cw, 12, '#a8702f');
    px(cx, 52, cw, 2, '#d19a52');
    px(cx, 63, cw, 1, '#5e3a18');
    for (let x = cx + 6; x < cx + cw; x += 6) px(x, 54, 1, 9, '#8b5a2b');
  }

  // props
  if (b.id === 'auctions') {
    px(8, 49, 10, 3, '#5e3a18'); // gavel block
    px(10, 43, 8, 4, '#c08a3e'); px(10, 43, 8, 1, '#e3b565'); // gavel head
    px(13, 46, 2, 6, '#8b5a2b'); // handle
    px(22, 46, 8, 6, '#d9b36a'); px(24, 44, 4, 3, '#d9b36a'); px(24, 49, 4, 1, '#8b5a2b'); // money sack
    px(AUCTION_TIMER_BOX.x - 1, AUCTION_TIMER_BOX.y - 1, AUCTION_TIMER_BOX.w + 2, AUCTION_TIMER_BOX.h + 2, '#c08a3e');
    px(AUCTION_TIMER_BOX.x, AUCTION_TIMER_BOX.y, AUCTION_TIMER_BOX.w, AUCTION_TIMER_BOX.h, '#07130b');
  } else if (b.id === 'arena') {
    [[8, '#a78bfa'], [16, '#8b5cf6'], [24, '#22d3ee']].forEach(([x, c]) => {
      px(x, 44, 7, 7, shade(c, -0.35));
      px(x + 1, 45, 5, 5, c);
      px(x + 1, 45, 5, 1, shade(c, 0.5));
      px(x + 1, 45, 1, 5, shade(c, 0.35));
    });
    px(60, 45, 2, 2, '#ffffff'); px(66, 43, 1, 1, '#ffffff'); px(72, 46, 2, 2, '#ffffff'); px(78, 44, 1, 1, '#ffffff');
    px(62, 48, 14, 4, '#4c1d95'); px(63, 47, 12, 1, '#8b5cf6');
  } else if (b.id === 'catalog') {
    // bookshelf on the wall, both sides of the door
    const books = ['#e53935', '#ffd23f', '#2f6fe0', '#2fa84f', '#8b5cf6', '#ff8a2a'];
    for (const sx of [8, 58]) {
      for (const sy of [42, 50]) {
        px(sx, sy + 7, 22, 1, '#3a2a18');
        for (let i = 0; i < 6; i++) px(sx + 1 + i * 3, sy + (i % 3 === 0 ? 1 : 2), 2, i % 3 === 0 ? 6 : 5, books[(i + sx + sy) % books.length]);
      }
    }
  }

  paintRoof(px, b);
}

/** Annunci: a small stone castle with two crenellated towers, banners in the pillar colour and a gate with a
 * portcullis in the middle (where the door zone is). The scene writes the name on the board above the gate. */
function paintCastle(px, { w, h, color }) {
  const STONE = '#9aa1ad';
  const STONE_D = '#6b7280';
  const STONE_L = '#cdd2da';
  const stoneBlock = (x, y, bw, bh) => {
    px(x, y, bw, bh, STONE);
    for (let yy = y + 5; yy < y + bh; yy += 6) px(x, yy, bw, 1, STONE_D); // mortar rows
    for (let yy = y, row = 0; yy < y + bh; yy += 6, row++) {
      for (let xx = x + (row % 2 ? 3 : 0) + 6; xx < x + bw; xx += 8) px(xx, yy, 1, Math.min(5, y + bh - yy), STONE_D);
    }
    px(x, y, bw, 1, STONE_L);
  };
  const merlons = (x, y, bw) => {
    for (let xx = x; xx + 4 <= x + bw; xx += 7) {
      px(xx, y, 4, 5, STONE);
      px(xx, y, 4, 1, STONE_L);
      px(xx + 3, y + 1, 1, 4, STONE_D);
    }
  };

  // curtain wall between the towers, with battlements
  stoneBlock(18, 14, w - 36, h - 14);
  merlons(19, 9, w - 38);

  // the two towers, taller than the wall
  for (const tx of [0, w - 22]) {
    stoneBlock(tx, -2, 22, h + 2);
    merlons(tx, -8, 22);
    px(tx + 9, 14, 3, 8, '#1f2430'); // arrow slits
    px(tx + 9, 36, 3, 8, '#1f2430');
    // banner hanging from the tower
    px(tx + 6, 2, 10, 1, '#3a2a18');
    px(tx + 7, 3, 8, 9, color);
    px(tx + 7, 12, 3, 2, color);
    px(tx + 12, 12, 3, 2, color);
    px(tx + 10, 6, 2, 2, '#fdfdf6');
    // pennant on a pole
    px(tx + 10, -12, 1, 4, '#3a2a18');
    px(tx + 11, -12, 5, 2, color);
  }

  // name board above the gate
  px(20, 28, w - 40, 12, '#2a1a0e');
  px(20, 28, w - 40, 1, '#c08a3e');
  px(20, 39, w - 40, 1, '#c08a3e');
  px(20, 28, 1, 12, '#c08a3e');
  px(w - 21, 28, 1, 12, '#c08a3e');

  // the gate: stone arch, wooden doors behind a portcullis
  px(28, 42, 32, h - 42, STONE_D);
  px(30, 44, 28, h - 44, '#1b1208');
  px(32, 46, 24, h - 46, '#5e3a18');
  px(43, 46, 2, h - 46, '#3a2a18');
  for (let x = 33; x < 56; x += 4) px(x, 46, 1, 14, '#111111');
  for (let y = 48; y < 60; y += 4) px(32, y, 24, 1, '#111111');
  px(30, 44, 3, 1, STONE_D); px(30, 45, 1, 1, STONE_D); // rounded arch corners
  px(55, 44, 3, 1, STONE_D); px(57, 45, 1, 1, STONE_D);
  px(42, 43, 4, 2, color); // keystone gem in the pillar colour

  // torches on both sides of the gate
  for (const lx of [22, 64]) {
    px(lx - 2, 39, 6, 9, 'rgba(255,190,80,0.22)');
    px(lx, 46, 2, 6, '#3a2a18');
    px(lx - 1, 42, 4, 4, '#ff9f1c');
    px(lx, 41, 2, 2, '#ffe14d');
  }
}

export function buildBuildingCanvas(b, createCanvas = () => document.createElement('canvas')) {
  const canvas = createCanvas();
  canvas.width = b.w + 2 * BUILDING_PAD;
  canvas.height = b.h + ROOF_EXTRA;
  paintBuilding(canvas.getContext('2d'), b, 0, 0);
  return canvas;
}
