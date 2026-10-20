// "CardBrix the game": the Kaplay scene. Layout, collisions and movement rules come from gameMap.js (pure and
// unit-tested); the static art (ground, stalls, dragon, character) is painted in code by groundSprite.js,
// buildingSprite.js, dragonSprite.js and the character sheets (skins.js) and shown here as sprites. This file adds the live
// parts (floating coins, blue flames, cloud shadows, door hints, tutorial guide arrow) and wires input.
// Kaplay is imported dynamically so the engine stays out of the main marketplace bundle - it is downloaded
// only when someone opens /game.
import { FRAME, COLS, ROWS, IDLE_COL } from './skins';
import { buildGroundCanvas } from './groundSprite';
import { buildBuildingCanvas, BUILDING_PAD, AUCTION_TIMER_BOX } from './buildingSprite';
import { buildDragonCanvas, DRAGON_H } from './dragonSprite';
import {
  WORLD, SPAWN, BUILDINGS, PLACES, TREES, CREDITS_PLACE, STATUE_SCALE, WALK_SPEED, moveWithCollision, doorAt, doorCentre,
  facingFor, stepToward, keyVector,
} from './gameMap';

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
 */
export async function startGame({ canvas, sheet, username, labels, onDoorChange, onEnterRequest }) {
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

  const state = { activeDoor: null, guide: null, frozen: false };
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

  // ── trees ────────────────────────────────────────────────────────────────────
  for (const tr of TREES) {
    k.add([k.pos(tr.x, tr.y), k.z(tr.y), {
      draw() {
        k.drawEllipse({ pos: k.vec2(0, 0), radiusX: 9, radiusY: 3, color: col('#000000'), opacity: 0.25 });
        rect(-2, -9, 4, 9, '#7a4a22');
        k.drawCircle({ pos: k.vec2(0, -17), radius: 10, color: col('#2e9a4a') });
        k.drawCircle({ pos: k.vec2(-3, -20), radius: 6, color: col('#4fc36a') });
        k.drawCircle({ pos: k.vec2(-5, -22), radius: 2, color: col('#9ff0a8') });
      },
    }]);
  }

  // ── stalls (one per pillar) ──────────────────────────────────────────────────
  for (const b of BUILDINGS) {
    const label = String(labels[b.id] || b.id).toUpperCase();
    k.add([k.sprite(`b-${b.id}`), k.pos(b.x - BUILDING_PAD, b.y), k.z(b.y + b.h)]);
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

  // overlay on top of everything: name tag + the guide arrow orbiting the player toward the tutorial target
  k.add([k.pos(0, 0), k.z(9999), {
    draw() {
      const ft = k.formatText({ font: FONT, text: username, size: 8 });
      const w = ft.width + 6;
      k.drawRect({ pos: k.vec2(pos.x - w / 2, pos.y + 3), width: w, height: 11, color: col('#000000'), opacity: 0.6, radius: 2 });
      k.drawText({ font: FONT, text: username, size: 8, pos: k.vec2(pos.x, pos.y + 8.5), anchor: 'center', color: col('#ffffff') });

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
  k.onMousePress(() => {
    if (state.frozen) return;
    const p = k.toWorld(k.mousePos());
    target = { x: Math.min(WORLD.w - 8, Math.max(8, p.x)), y: Math.min(WORLD.h - 4, Math.max(14, p.y)) };
  });
  const requestEnter = () => { if (!state.frozen && state.activeDoor) onEnterRequest(state.activeDoor); };
  k.onKeyPress('enter', requestEnter);
  k.onKeyPress('space', requestEnter);

  k.onUpdate(() => {
    const dt = k.dt();
    const keys = state.frozen ? { dx: 0, dy: 0 } : keyVector({
      left: down('left', 'a'), right: down('right', 'd'), up: down('up', 'w'), down: down('down', 's'),
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
  });

  return {
    enter: requestEnter,
    /** Place id the guide arrow should point at (null hides it). */
    setGuide(id) { state.guide = id || null; },
    /** While frozen (a tutorial card is open) the character ignores input. */
    setFrozen(v) { state.frozen = Boolean(v); if (v) target = null; },
    destroy() { try { k.quit(); } catch { /* already gone */ } },
  };
}

