// "CardBrix the game": the Kaplay scene. Layout, collisions and movement rules come from gameMap.js (pure and
// unit-tested); the static art (ground, stalls, dragon, character) is painted in code by groundSprite.js,
// buildingSprite.js, dragonSprite.js and the character sheets (skins.js) and shown here as sprites. This file adds the live
// parts (floating coins, blue flames, cloud shadows, door hints, tutorial guide arrow) and wires input.
// Kaplay is imported dynamically so the engine stays out of the main marketplace bundle - it is downloaded
// only when someone opens /game.
import { FRAME, COLS, ROWS, IDLE_COL } from './skins';
import { buildGroundCanvas } from './groundSprite';
import { buildBuildingCanvas, BUILDING_PAD, ROOF_EXTRA, AUCTION_TIMER_BOX } from './buildingSprite';
import { buildDragonCanvas, DRAGON_H } from './dragonSprite';
import {
  WORLD, SPAWN, BUILDINGS, PLACES, TREES, PROPS, CREDITS_PLACE, STATUE_SCALE, WALK_SPEED, moveWithCollision, doorAt, doorCentre,
  easterEggAt, facingFor, stepToward, keyVector,
} from './gameMap';
import { approach } from './plazaState';

const VIEW_W = 320;
const VIEW_H = 240;
// The character sheet cells are 48x56 pixels of detail; shown at this scale they are ~26 world units tall,
// the same size as the door of a stall.
const CHAR_SCALE = 0.55;

// Kaplay caches its text glyph atlases in a module-level object keyed by font name, so a second scene in the same
// page (creator -> world, edit character) would reuse an atlas whose WebGL texture was destroyed with the first
// one and draw no text at all. A font name that is unique per scene sidesteps the stale cache (the extra family
// is just ignored by the browser, text still renders in the system monospace font).
let sceneCounter = 0;

// Gold coins hovering above the roads and around the dragon (decor only, deterministic).
const COINS = [
  [96, 118], [140, 120], [190, 122], [290, 122], [340, 120], [384, 118], [206, 150], [274, 150], [196, 196],
  [284, 196], [150, 134], [330, 134], [240, 120], [222, 240], [260, 240], [180, 170], [300, 170],
];
// Small cards floating near the plaza, in the pillar colours.
const CARDS = [
  { x: 172, y: 160, c: '#c6ff3d' }, { x: 308, y: 164, c: '#ff5a36' }, { x: 164, y: 214, c: '#8b5cf6' }, { x: 316, y: 218, c: '#3b82f6' },
];
const CLOUDS = [{ x: 60, y: 90, rx: 60, ry: 18, sp: 5 }, { x: 300, y: 200, rx: 80, ry: 22, sp: 3 }, { x: 180, y: 40, rx: 50, ry: 14, sp: 7 }];

/**
 * Starts the game world on `canvas`. Returns { destroy, enter, setGuide, setFrozen } once assets are ready.
 * - sheet: the player's recoloured character sheet (canvas, see game/skinLoader.js)
 * - labels: { listings, auctions, arena, catalog, credits } place names (already translated)
 * - onDoorChange(id | null): fired when the character steps in/out of a place's door zone
 * - onEnterRequest(id): fired when the player presses Enter/Space on a door
 * - onLocalMove({ x, y, d, m }): every frame, our own position (the plaza client throttles what it sends)
 * - onPlayerTap(id): another player's character was tapped/clicked
 * - onEasterEgg(id | null): the character stepped into / out of an easter egg zone
 * The returned handle also manages the OTHER players of the plaza: addRemote / moveRemote / removeRemote,
 * and setPosition (server correction).
 */
export async function startGame({
  canvas, sheet, username, labels, onDoorChange, onEnterRequest, onLocalMove = () => {}, onPlayerTap = () => {},
  onEasterEgg = () => {},
}) {
  const { default: kaplay } = await import('kaplay');
  const k = kaplay({
    canvas,
    width: VIEW_W,
    height: VIEW_H,
    stretch: true,
    letterbox: true,
    background: '#0b1a12',
    global: false,
    crisp: true,
    touchToMouse: true,
    debug: false,
    pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
  });
  const FONT = `monospace, "cbg-${++sceneCounter}"`;
  const col = (hex) => k.Color.fromHex(hex);
  const rect = (x, y, w, h, hex, opacity = 1) => k.drawRect({ pos: k.vec2(x, y), width: w, height: h, color: col(hex), opacity });

  // ── sprites: character sheet, ground, dragon, one per stall ──────────────────
  const anims = {};
  ROWS.forEach((dir, row) => {
    anims[`${dir}-idle`] = { from: row * COLS + IDLE_COL[dir], to: row * COLS + IDLE_COL[dir] };
    anims[`${dir}-walk`] = { from: row * COLS, to: row * COLS + COLS - 1, loop: true, speed: 7 };
  });
  await Promise.all([
    k.loadSprite('me', sheet.toDataURL(), { sliceX: COLS, sliceY: ROWS.length, anims }),
    k.loadSprite('ground', buildGroundCanvas().toDataURL()),
    k.loadSprite('dragon', buildDragonCanvas().toDataURL()),
    ...BUILDINGS.map((b) => k.loadSprite(`b-${b.id}`, buildBuildingCanvas(b).toDataURL())),
  ]);

  const state = { activeDoor: null, guide: null, frozen: false, egg: null };
  // on-screen D-pad (touch): held directions, merged with the keyboard every frame
  const virtualKeys = { up: false, down: false, left: false, right: false };
  // speech bubbles over the heads: id ('me' or a player id) -> { text, until }
  const bubbles = new Map();
  const BUBBLE_MS = 4000;
  const placeById = (id) => PLACES.find((p) => p.id === id) || null;

  // ground + a soft pulsing golden glow under the statue
  k.add([k.sprite('ground'), k.pos(0, 0), k.z(0)]);
  const statueX = CREDITS_PLACE.x + CREDITS_PLACE.w / 2;
  const statueBottom = CREDITS_PLACE.y + CREDITS_PLACE.h;
  k.add([k.pos(0, 0), k.z(1), {
    draw() {
      const pulse = 0.5 + 0.5 * Math.sin(k.time() * 2.2);
      k.drawEllipse({ pos: k.vec2(statueX, statueBottom), radiusX: 58, radiusY: 24, color: col('#ffd23f'), opacity: 0.1 + 0.08 * pulse });
    },
  }]);

  // a pulsing highlight on the door zone + a bouncing arrow over a place the tutorial points at
  const drawDoorHints = (place, ox, oy) => {
    const pulse = 0.5 + 0.5 * Math.sin(k.time() * 6);
    if (state.activeDoor === place.id) {
      k.drawRect({
        pos: k.vec2(place.door.x - ox, place.door.y - oy), width: place.door.w, height: place.door.h,
        color: col(place.color), opacity: 0.2 + 0.22 * pulse, outline: { width: 1, color: col(place.color) },
      });
    }
    if (state.guide === place.id) {
      const bob = Math.sin(k.time() * 5) * 3;
      const cx = place.door.x + place.door.w / 2 - ox;
      const ty = place.door.y + place.door.h - oy + 6 + bob;
      const tri = { p1: k.vec2(cx - 6, ty + 10), p2: k.vec2(cx + 6, ty + 10), p3: k.vec2(cx, ty) };
      k.drawTriangle({ ...tri, color: col('#000000'), opacity: 0.5, pos: k.vec2(1, 1) });
      k.drawTriangle({ ...tri, color: col(place.color) });
      k.drawRect({ pos: k.vec2(cx - 2, ty + 10), width: 4, height: 6, color: col(place.color) });
    }
  };

  // ── the dragon statue (credits) ──────────────────────────────────────────────
  k.add([k.sprite('dragon'), k.pos(statueX, statueBottom), k.anchor('bot'), k.scale(STATUE_SCALE), k.z(statueBottom)]);
  k.add([k.pos(0, 0), k.z(statueBottom + 1), {
    draw() {
      // blue flames licking up on both sides of the statue
      const t = k.time();
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const bx = statueX + side * (31 + i * 4);
          const flick = Math.sin(t * 9 + i * 1.7 + side) * 2.5;
          const hgt = 13 + i * 2 + flick * 1.4;
          const half = 4.2 - i * 0.6;
          const y0 = statueBottom - 3;
          k.drawTriangle({ p1: k.vec2(bx - half, y0), p2: k.vec2(bx + half, y0), p3: k.vec2(bx + flick * 0.3, y0 - hgt), color: col('#3b82f6') });
          k.drawTriangle({ p1: k.vec2(bx - half * 0.6, y0), p2: k.vec2(bx + half * 0.6, y0), p3: k.vec2(bx + flick * 0.2, y0 - hgt * 0.7), color: col('#93c5fd') });
          k.drawTriangle({ p1: k.vec2(bx - half * 0.3, y0), p2: k.vec2(bx + half * 0.3, y0), p3: k.vec2(bx, y0 - hgt * 0.4), color: col('#ffffff') });
        }
      }
      // twinkling sparkles around the statue
      [[-44, -60], [44, -66], [-14, -78], [20, -76], [-54, -24], [56, -18]].forEach(([dx, dy], i) => {
        const a = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.3);
        if (a > 0.55) {
          rect(statueX + dx - 1, statueBottom + dy, 3, 1, '#fff7c2', a);
          rect(statueX + dx, statueBottom + dy - 1, 1, 3, '#fff7c2', a);
        }
      });
      const creditsText = String(labels.credits || '').toUpperCase();
      const lw = k.formatText({ font: FONT, text: creditsText, size: 8 }).width + 8;
      const ly = statueBottom - DRAGON_H * STATUE_SCALE - 12;
      k.drawRect({ pos: k.vec2(statueX - lw / 2, ly - 7), width: lw, height: 14, color: col('#07130b'), opacity: 0.75, radius: 2 });
      k.drawText({ font: FONT, text: creditsText, size: 8, pos: k.vec2(statueX, ly), anchor: 'center', color: col(CREDITS_PLACE.color) });
      drawDoorHints(CREDITS_PLACE, 0, 0);
    },
  }]);

  // ── trees: LEGO pines, cherry / gold bonsai, glowing mana trees ───────────────
  const blossom = (base, light, shine) => {
    rect(-2, -9, 4, 9, '#5b3a1e');
    rect(1, -12, 5, 2, '#5b3a1e'); // a bonsai branch
    k.drawCircle({ pos: k.vec2(-2, -17), radius: 8, color: col(base) });
    k.drawCircle({ pos: k.vec2(6, -14), radius: 5, color: col(base) });
    k.drawCircle({ pos: k.vec2(-4, -20), radius: 5, color: col(light) });
    k.drawCircle({ pos: k.vec2(-6, -22), radius: 2, color: col(shine) });
  };
  const TREE_DRAW = {
    bonsai_pink: () => blossom('#ec4899', '#f9a8d4', '#fde7f3'),
    bonsai_gold: () => blossom('#ca8a04', '#facc15', '#fef9c3'),
    lego_pine: () => {
      rect(-2, -6, 4, 6, '#5b3a1e');
      rect(-10, -11, 20, 5, '#14532d'); rect(-10, -11, 20, 1, '#22c55e');
      rect(-7, -17, 14, 6, '#166534'); rect(-7, -17, 14, 1, '#4ade80');
      rect(-4, -23, 8, 6, '#15803d'); rect(-4, -23, 8, 1, '#86efac');
      for (const sx of [-7, -1, 5]) rect(sx, -13, 2, 2, '#4ade80');
      rect(-2, -25, 4, 2, '#86efac');
    },
    mana_tree_cyan: () => mana('#0e7490', '#22d3ee', '#cffafe'),
    mana_tree_purple: () => mana('#6b21a8', '#a855f7', '#f3e8ff'),
  };
  function mana(base, glow, shine) {
    const pulse = 0.5 + 0.5 * Math.sin(k.time() * 2.5);
    k.drawEllipse({ pos: k.vec2(0, -17), radiusX: 15, radiusY: 13, color: col(glow), opacity: 0.12 + 0.12 * pulse });
    rect(-2, -9, 4, 9, '#3f2a1a');
    k.drawCircle({ pos: k.vec2(0, -17), radius: 10, color: col(base) });
    k.drawCircle({ pos: k.vec2(-2, -19), radius: 6, color: col(glow) });
    if (pulse > 0.6) rect(5, -24, 2, 2, shine);
    if (pulse < 0.4) rect(-8, -14, 2, 2, shine);
  }
  for (const tr of TREES) {
    const drawTree = TREE_DRAW[tr.variant];
    k.add([k.pos(tr.x, tr.y), k.z(tr.y), {
      draw() {
        k.drawEllipse({ pos: k.vec2(0, 0), radiusX: 9, radiusY: 3, color: col('#000000'), opacity: 0.25 });
        if (drawTree) { drawTree(); return; }
        rect(-2, -9, 4, 9, '#7a4a22');
        k.drawCircle({ pos: k.vec2(0, -17), radius: 10, color: col('#2e9a4a') });
        k.drawCircle({ pos: k.vec2(-3, -20), radius: 6, color: col('#4fc36a') });
      },
    }]);
  }

  // ── collector props: graded slabs, duel tables, booster machines, giant bricks, spawn pad ──
  const PROP_DRAW = {
    graded_slab(p) {
      rect(-7, -4, 14, 4, '#4b5563'); rect(-7, -4, 14, 1, '#9ca3af'); // pedestal
      rect(-6, -24, 12, 20, '#111111');
      rect(-5, -23, 10, 18, '#e5e7eb');
      rect(-5, -23, 10, 4, p.color); // grade label
      rect(-4, -18, 8, 11, p.cardColor); // the card
      rect(-3, -17, 6, 4, '#fef3c7');
      k.drawText({ font: FONT, text: '10', size: 4, pos: k.vec2(0, -21), anchor: 'center', color: col('#111111') });
      const glint = ((k.time() * 0.6) % 2) * 14 - 7; // a shine sweeping across the case
      if (glint > -5 && glint < 5) rect(glint, -23, 1, 18, '#ffffff', 0.7);
    },
    tcg_table(p) {
      const w = p.w;
      const h = p.h;
      rect(-w / 2 + 2, -2, 2, 2, '#3a2a18'); rect(w / 2 - 4, -2, 2, 2, '#3a2a18'); // legs
      rect(-w / 2, -h, w, h - 2, '#8b5a2b');
      rect(-w / 2, -4, w, 2, '#5e3a18');
      rect(-w / 2 + 2, -h + 2, w / 2 - 3, h - 8, p.p1Color, 0.85); // two facing play mats
      rect(1, -h + 2, w / 2 - 3, h - 8, p.p2Color, 0.85);
      for (const cx of [-w / 2 + 4, -w / 2 + 8, 4, 8]) rect(cx, -h + 4, 3, 4, '#fdfdf6');
    },
    booster_vending(p) {
      const pulse = 0.5 + 0.5 * Math.sin(k.time() * 3);
      k.drawEllipse({ pos: k.vec2(0, -11), radiusX: 11, radiusY: 13, color: col(p.color), opacity: 0.1 + 0.1 * pulse });
      rect(-7, -22, 14, 22, '#111111');
      rect(-6, -21, 12, 20, p.color);
      rect(-6, -21, 12, 2, '#ffffff', 0.8);
      rect(-5, -17, 10, 9, '#0b1220'); // glass
      for (const [x, y, c] of [[-4, -16, '#a855f7'], [-1, -16, '#22d3ee'], [2, -16, '#f472b6'], [-4, -12, '#ffd23f'], [-1, -12, '#c6ff3d'], [2, -12, '#ff5a36']]) rect(x, y, 2, 3, c);
      rect(-2, -6, 4, 2, '#111111'); // the slot
      rect(3, -6, 2, 2, pulse > 0.5 ? '#c6ff3d' : '#14532d'); // blinking light
    },
    giant_lego_brick(p) {
      rect(-p.w / 2, -p.h, p.w, p.h, '#111111');
      rect(-p.w / 2 + 1, -p.h + 1, p.w - 2, p.h - 2, p.color);
      rect(-p.w / 2 + 1, -3, p.w - 2, 2, '#000000', 0.25);
      for (const sx of [-p.w / 2 + 2, -p.w / 2 + 6, p.w / 2 - 9, p.w / 2 - 5]) rect(sx, -p.h + 2, 3, 2, '#ffffff', 0.45);
    },
    teleport_pad(p) {
      const t = k.time();
      k.drawEllipse({ pos: k.vec2(0, -p.h / 2), radiusX: p.w / 2, radiusY: p.h / 2, color: col('#0b1220'), opacity: 0.6 });
      for (let i = 0; i < 2; i++) {
        const s = ((t * 0.7 + i * 0.5) % 1);
        k.drawEllipse({ pos: k.vec2(0, -p.h / 2), radiusX: (p.w / 2) * s, radiusY: (p.h / 2) * s, color: col(p.color), opacity: 0.6 * (1 - s) });
      }
    },
  };
  for (const p of PROPS) {
    const drawProp = PROP_DRAW[p.type];
    if (!drawProp) continue;
    k.add([k.pos(p.x, p.y), k.z(p.type === 'teleport_pad' ? 2 : p.y), { draw() { drawProp(p); } }]);
  }

  // a soft glow in front of each shop, in its aura colour
  k.add([k.pos(0, 0), k.z(1), {
    draw() {
      const pulse = 0.5 + 0.5 * Math.sin(k.time() * 2);
      for (const b of BUILDINGS) {
        const c = doorCentre(b);
        k.drawEllipse({ pos: k.vec2(c.x, c.y), radiusX: 18, radiusY: 7, color: col(b.auraColor || b.color), opacity: 0.1 + 0.12 * pulse });
      }
    },
  }]);

  // ── stalls (one per pillar) ──────────────────────────────────────────────────
  for (const b of BUILDINGS) {
    const label = String(labels[b.id] || b.id).toUpperCase();
    k.add([k.sprite(`b-${b.id}`), k.pos(b.x - BUILDING_PAD, b.y - ROOF_EXTRA), k.z(b.y + b.h)]);
    k.add([k.pos(b.x, b.y), k.z(b.y + b.h + 1), {
      draw() {
        k.drawText({ font: FONT, text: label, size: 8, pos: k.vec2(b.w / 2, 34.5), anchor: 'center', color: col(b.color) });
        if (b.id === 'auctions') {
          // decorative countdown (not a real auction)
          const total = 6000 - (Math.floor(k.time()) % 6000);
          const hh = String(Math.floor(total / 3600)).padStart(2, '0');
          const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
          const ss = String(total % 60).padStart(2, '0');
          k.drawText({ font: FONT, text: `${hh}:${mm}:${ss}`, size: 6, pos: k.vec2(AUCTION_TIMER_BOX.x + AUCTION_TIMER_BOX.w / 2, AUCTION_TIMER_BOX.y + AUCTION_TIMER_BOX.h / 2), anchor: 'center', color: col('#7dffa0') });
        }
        drawDoorHints(b, b.x, b.y);
      },
    }]);
  }

  // ── floating coins, cards and cloud shadows (decor) ──────────────────────────
  k.add([k.pos(0, 0), k.z(5000), {
    draw() {
      const t = k.time();
      COINS.forEach(([x, y], i) => {
        const bob = Math.sin(t * 2.4 + i) * 2.5;
        const spin = Math.abs(Math.cos(t * 2 + i * 0.9));
        const rx = Math.max(1, 4 * spin);
        k.drawEllipse({ pos: k.vec2(x, y + bob + 3), radiusX: rx + 1, radiusY: 5, color: col('#000000'), opacity: 0.18 });
        k.drawEllipse({ pos: k.vec2(x, y + bob), radiusX: rx + 1, radiusY: 5, color: col('#7a5200') });
        k.drawEllipse({ pos: k.vec2(x, y + bob), radiusX: rx, radiusY: 4, color: col('#ffd23f') });
        if (rx > 2.5) rect(x - rx * 0.5, y + bob - 2, 1, 3, '#fff08a');
      });
      CARDS.forEach((c, i) => {
        const bob = Math.sin(t * 1.8 + i * 2) * 3;
        rect(c.x - 1, c.y + bob - 1, 12, 15, '#101010');
        rect(c.x, c.y + bob, 10, 13, '#fdfdf6');
        rect(c.x + 1, c.y + bob + 1, 8, 7, c.c);
        rect(c.x + 2, c.y + bob + 9, 6, 1, '#9a9a9a');
      });
    },
  }]);
  k.add([k.pos(0, 0), k.z(9000), {
    draw() {
      const t = k.time();
      for (const c of CLOUDS) {
        const x = ((c.x + t * c.sp) % (WORLD.w + 160)) - 80;
        k.drawEllipse({ pos: k.vec2(x, c.y), radiusX: c.rx, radiusY: c.ry, color: col('#0b2a14'), opacity: 0.06 });
      }
    },
  }]);

  // ── player ───────────────────────────────────────────────────────────────────
  let pos = { ...SPAWN };
  let facing = { dir: 'down', flip: false };
  let currentAnim = 'down-idle';
  let target = null;
  const player = k.add([k.sprite('me', { anim: currentAnim }), k.pos(pos.x, pos.y), k.anchor('bot'), k.scale(CHAR_SCALE), k.z(pos.y)]);

  // ── other players (the plaza) ────────────────────────────────────────────────
  let alive = true;
  const remotes = new Map(); // id -> { obj, avatarKey, username, x, y, tx, ty, d, m, anim }
  const remoteSprites = new Map(); // avatar key -> Promise<sprite name>: players with the same look share it
  const spriteFor = (avatarKey, sheetCanvas) => {
    if (!remoteSprites.has(avatarKey)) {
      const name = `r${remoteSprites.size + 1}`;
      remoteSprites.set(avatarKey, k.loadSprite(name, sheetCanvas.toDataURL(), { sliceX: COLS, sliceY: ROWS.length, anims }).then(() => name));
    }
    return remoteSprites.get(avatarKey);
  };
  const removeRemote = (id) => {
    const r = remotes.get(id);
    if (r && r.obj) r.obj.destroy();
    remotes.delete(id);
  };
  const addRemote = async ({ id, username: name, avatarKey, sheet: remoteSheet, x, y, d = 'down' }) => {
    const existing = remotes.get(id);
    if (existing && existing.avatarKey === avatarKey) { Object.assign(existing, { username: name, tx: x, ty: y }); return; }
    if (existing) removeRemote(id);
    const entry = { obj: null, avatarKey, username: name, x, y, tx: x, ty: y, d, m: false, anim: `${d}-idle` };
    remotes.set(id, entry);
    const spriteName = await spriteFor(avatarKey, remoteSheet);
    if (!alive || remotes.get(id) !== entry) return; // left (or changed look) while loading
    entry.obj = k.add([k.sprite(spriteName, { anim: entry.anim }), k.pos(entry.x, entry.y), k.anchor('bot'), k.scale(CHAR_SCALE), k.z(entry.y)]);
  };
  const moveRemote = (id, { x, y, d, m }) => {
    const r = remotes.get(id);
    if (!r) return;
    Object.assign(r, { tx: x, ty: y, d: d || r.d, m: Boolean(m) });
  };

  // overlay on top of everything: name tag + the guide arrow orbiting the player toward the tutorial target
  k.add([k.pos(0, 0), k.z(9999), {
    draw() {
      const ft = k.formatText({ font: FONT, text: username, size: 8 });
      const w = ft.width + 6;
      k.drawRect({ pos: k.vec2(pos.x - w / 2, pos.y + 3), width: w, height: 11, color: col('#000000'), opacity: 0.6, radius: 2 });
      k.drawText({ font: FONT, text: username, size: 8, pos: k.vec2(pos.x, pos.y + 8.5), anchor: 'center', color: col('#ffffff') });
      // speech bubbles (fixed phrases / emojis from the plaza chat) above the heads
      const nowMs = k.time() * 1000;
      const drawBubble = (x, footY, text) => {
        const bw = k.formatText({ font: FONT, text, size: 7 }).width + 8;
        const by = footY - FRAME.h * CHAR_SCALE - 14;
        k.drawRect({ pos: k.vec2(x - bw / 2, by), width: bw, height: 11, color: col('#0b0914'), opacity: 0.88, radius: 3 });
        k.drawTriangle({ p1: k.vec2(x - 3, by + 11), p2: k.vec2(x + 3, by + 11), p3: k.vec2(x, by + 14), color: col('#0b0914'), opacity: 0.88 });
        k.drawText({ font: FONT, text, size: 7, pos: k.vec2(x, by + 5.5), anchor: 'center', color: col('#ffffff') });
      };
      for (const [bid, b] of bubbles) {
        if (b.until < nowMs) { bubbles.delete(bid); continue; }
        if (bid === 'me') drawBubble(pos.x, pos.y, b.text);
        else { const r = remotes.get(bid); if (r && r.obj) drawBubble(r.x, r.y, b.text); }
      }
      // other players: smaller, dimmer name tags
      for (const r of remotes.values()) {
        if (!r.obj) continue;
        const rw = k.formatText({ font: FONT, text: r.username, size: 6 }).width + 4;
        k.drawRect({ pos: k.vec2(r.x - rw / 2, r.y + 3), width: rw, height: 8, color: col('#000000'), opacity: 0.45, radius: 2 });
        k.drawText({ font: FONT, text: r.username, size: 6, pos: k.vec2(r.x, r.y + 7), anchor: 'center', color: col('#e5e7eb') });
      }

      const place = state.guide ? placeById(state.guide) : null;
      if (place && state.activeDoor !== place.id) {
        const c = doorCentre(place);
        const vx = c.x - pos.x;
        const vy = c.y - (pos.y - 10);
        const dist = Math.hypot(vx, vy) || 1;
        const ux = vx / dist;
        const uy = vy / dist;
        const r = 26 + Math.sin(k.time() * 6) * 2;
        const cx = pos.x + ux * r;
        const cy = pos.y - 10 + uy * r;
        const tri = {
          p1: k.vec2(cx + ux * 6, cy + uy * 6),
          p2: k.vec2(cx - ux * 4 - uy * 5, cy - uy * 4 + ux * 5),
          p3: k.vec2(cx - ux * 4 + uy * 5, cy - uy * 4 - ux * 5),
        };
        k.drawTriangle({ ...tri, color: col('#000000'), opacity: 0.45, pos: k.vec2(1, 1) });
        k.drawTriangle({ ...tri, color: col(place.color) });
      }
    },
  }]);

  // ── input ────────────────────────────────────────────────────────────────────
  const down = (...keys) => keys.some((key) => k.isKeyDown(key));
  // Taps / clicks are read from the DOM event itself: Kaplay only refreshes its mouse position on mousemove,
  // so a click with no movement before it (some touch screens, stylus, assistive tools) would land on a stale
  // spot. The view is letterboxed (VIEW_W x VIEW_H scaled to fit, centred), so undo that mapping by hand.
  const onPointerDown = (e) => {
    if (state.frozen) return;
    const box = canvas.getBoundingClientRect();
    const scale = Math.min(box.width / VIEW_W, box.height / VIEW_H);
    const lx = (e.clientX - box.left - (box.width - VIEW_W * scale) / 2) / scale;
    const ly = (e.clientY - box.top - (box.height - VIEW_H * scale) / 2) / scale;
    if (lx < 0 || ly < 0 || lx > VIEW_W || ly > VIEW_H) return; // on a letterbox bar
    const p = k.toWorld(k.vec2(lx, ly));
    // tapping another player opens their card instead of walking there
    for (const [id, r] of remotes) {
      if (r.obj && Math.abs(p.x - r.x) <= 9 && p.y >= r.y - 32 && p.y <= r.y + 4) { onPlayerTap(id); return; }
    }
    target = { x: Math.min(WORLD.w - 8, Math.max(8, p.x)), y: Math.min(WORLD.h - 4, Math.max(14, p.y)) };
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  const requestEnter = () => { if (!state.frozen && state.activeDoor) onEnterRequest(state.activeDoor); };
  k.onKeyPress('enter', requestEnter);
  k.onKeyPress('space', requestEnter);

  k.onUpdate(() => {
    const dt = k.dt();
    const keys = state.frozen ? { dx: 0, dy: 0 } : keyVector({
      left: down('left', 'a') || virtualKeys.left,
      right: down('right', 'd') || virtualKeys.right,
      up: down('up', 'w') || virtualKeys.up,
      down: down('down', 's') || virtualKeys.down,
    });
    let dx = 0;
    let dy = 0;
    if (keys.dx !== 0 || keys.dy !== 0) {
      target = null;
      dx = keys.dx * WALK_SPEED * dt;
      dy = keys.dy * WALK_SPEED * dt;
    } else if (target && !state.frozen) {
      const s = stepToward(pos, target, WALK_SPEED, dt);
      dx = s.dx;
      dy = s.dy;
      if (s.arrived) target = null;
    }

    const next = dx || dy ? moveWithCollision(pos, dx, dy) : pos;
    const moved = next.x !== pos.x || next.y !== pos.y;
    if (target && !moved) target = null; // walked into a wall: stop instead of pushing forever
    pos = next;
    if (dx || dy) facing = facingFor(dx, dy, facing);

    const row = facing.dir === 'side' ? (facing.flip ? 'left' : 'right') : facing.dir;
    const anim = `${row}-${moved ? 'walk' : 'idle'}`;
    if (anim !== currentAnim) { currentAnim = anim; player.play(anim); }
    const bob = moved ? Math.abs(Math.sin(k.time() * 11)) * 1.2 : 0; // a little hop while walking
    player.pos = k.vec2(pos.x, pos.y - bob);
    player.z = pos.y;

    const camX = Math.min(WORLD.w - VIEW_W / 2, Math.max(VIEW_W / 2, pos.x));
    const camY = Math.min(WORLD.h - VIEW_H / 2, Math.max(VIEW_H / 2, pos.y - (FRAME.h * CHAR_SCALE) / 2));
    k.setCamPos(camX, camY);

    const door = doorAt(pos);
    const id = door ? door.id : null;
    if (id !== state.activeDoor) { state.activeDoor = id; onDoorChange(id); }

    const egg = easterEggAt(pos);
    const eggId = egg ? egg.id : null;
    if (eggId !== state.egg) { state.egg = eggId; onEasterEgg(eggId); }

    onLocalMove({ x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10, d: row, m: moved });

    // other players walk smoothly toward their latest reported position
    for (const r of remotes.values()) {
      if (!r.obj) continue;
      const s = approach(r, dt);
      r.x = s.x;
      r.y = s.y;
      const walking = s.moving || r.m;
      const ranim = `${r.d}-${walking ? 'walk' : 'idle'}`;
      if (ranim !== r.anim) { r.anim = ranim; r.obj.play(ranim); }
      const rbob = walking ? Math.abs(Math.sin(k.time() * 11)) * 1.2 : 0;
      r.obj.pos = k.vec2(r.x, r.y - rbob);
      r.obj.z = r.y;
    }
  });

  return {
    enter: requestEnter,
    /** Place id the guide arrow should point at (null hides it). */
    setGuide(id) { state.guide = id || null; },
    /** While frozen (a tutorial card is open) the character ignores input. */
    setFrozen(v) { state.frozen = Boolean(v); if (v) target = null; },
    addRemote,
    moveRemote,
    removeRemote,
    /** Directions held on the on-screen D-pad: { up, down, left, right } (missing = released). */
    setVirtualKeys(keys) {
      for (const dir of ['up', 'down', 'left', 'right']) virtualKeys[dir] = Boolean(keys && keys[dir]);
    },
    /** Shows `text` in a bubble above a character for a few seconds ('me' = our own character). */
    showBubble(id, text) { bubbles.set(id, { text: String(text), until: k.time() * 1000 + BUBBLE_MS }); },
    /** The server refused a move: snap back to where it says we are. */
    setPosition(x, y) { pos = { x, y }; target = null; },
    destroy() {
      alive = false;
      canvas.removeEventListener('pointerdown', onPointerDown);
      try { k.quit(); } catch { /* already gone */ }
    },
  };
}

