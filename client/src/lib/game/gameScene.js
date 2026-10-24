// "CardBrix the game": the Kaplay scene. Layout, collisions and movement rules come from gameMap.js, marketMap.js
// and maps.js (pure and unit-tested); the static art (ground, stalls, castle, dragon, character) is painted in
// code by groundSprite.js, marketGround.js, buildingSprite.js, dragonSprite.js and the character sheets (skins.js),
// the market shops are artwork (scripts/build-game-shops.js); all of it is shown here as sprites. This file adds the live parts (floating coins, blue flames, torches, cloud shadows,
// door hints, tutorial guide arrow), wires input and switches between the maps (plaza <-> market in the castle):
// everything that belongs to a map is tagged 'map' and rebuilt on a switch, the player and the overlay stay.
// Kaplay is imported dynamically so the engine stays out of the main marketplace bundle - it is downloaded
// only when someone opens /game.
import { FRAME, COLS, ROWS, IDLE_COL } from './skins';
import { buildGroundCanvas } from './groundSprite';
import { buildMarketGroundCanvas, GROUND_SCALE, hash } from './marketGround';
import { buildBuildingCanvas, BUILDING_PAD, ROOF_EXTRA, AUCTION_TIMER_BOX } from './buildingSprite';
// The dragon statue artwork (built by scripts/build-game-dragon.js): image + size and centre of its golden disc.
import DRAGON_STATUE_URL from '../../assets/game/dragon-statue.png';
import DRAGON_STATUE from '../../assets/game/dragon-statue.json';
// The market shops (built by scripts/build-game-shops.js): one image per building + their size in world units.
import SHOP_ART from '../../assets/game/shops/shops.json';
import {
  WORLD, BUILDINGS, TREES, PROPS, CREDITS_PLACE, WALK_SPEED, moveWithCollision, doorAt, doorCentre,
  facingFor, stepToward, keyVector,
} from './gameMap';
import { MARKET_SHOPS, MY_SHOP, MARKET_PROPS, EXIT_GATE, GATE_TOWERS, MARKET_WORLD } from './marketMap';
import { mapById, spawnPoint, nearestSpawn } from './maps';
import { approach } from './plazaState';
import { drawnNpcs, npcHitBox } from './npcs';
import { clampStick } from './joystick';
import { findPath } from './pathfind';
import { timeLeft, clockText } from './marketQueries';
// The pixel font of the game UI (self-hosted, so the production CSP needs nothing new), drawn into the canvas too.
import PIXEL_FONT_URL from '@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2?url';

const VIEW_W = 320;
const VIEW_H = 240;
// The character sheet cells are 48x56 pixels of detail; shown at this scale they are ~26 world units tall,
// the same size as the door of a stall.
const CHAR_SCALE = 0.55;
const SHOP_ART_URLS = import.meta.glob('../../assets/game/shops/*.png', { eager: true, import: 'default' });
const FADE_S = 0.22; // each half of the fade when changing map

// Kaplay caches its text glyph atlases in a module-level object keyed by font name, so a second scene in the same
// page (creator -> world, edit character) would reuse an atlas whose WebGL texture was destroyed with the first
// one and draw no text at all. The pixel font is loaded under a name that is unique per scene to sidestep that.
let sceneCounter = 0;

// Render resolution: the 320x240 view is drawn into an offscreen buffer of VIEW x density, then stretched onto
// the canvas. 2 looked soft on big screens; matching the canvas' real pixels (capped, for phones' memory) keeps
// sprites and text sharp.
function renderDensity(canvas) {
  const cssW = canvas.getBoundingClientRect().width || VIEW_W * 2;
  const devicePx = cssW * (window.devicePixelRatio || 1);
  return Math.min(3, Math.max(2, Math.ceil(devicePx / VIEW_W)));
}

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
 * - labels: place id -> name (already translated), for every place of every map
 * - start: { map, spawn } where the character appears (default: the plaza start point)
 * - onDoorChange(id | null): fired when the character steps in/out of a place's door zone
 * - onEnterRequest(id): fired when the player presses Enter/Space on a door
 * - onLocalMove({ x, y, d, m }): every frame, our own position (the plaza client throttles what it sends)
 * - onPlayerTap(id): another player's character was tapped/clicked
 * - npcSheets: NPC id -> its recoloured character sheet (canvas); npcNames: NPC id -> name (translated).
 *   Tapping an NPC or a building walks the character to its door (around obstacles) and then enters it.
 * - onMapChange(mapId): the scene switched map (after travel() or a server correction to another map)
 * The returned handle also manages the OTHER players of the plaza: addRemote / moveRemote / removeRemote,
 * and setPosition (server correction).
 */
export async function startGame({
  canvas, sheet, username, labels, start = {}, onDoorChange, onEnterRequest, onLocalMove = () => {}, onPlayerTap = () => {},
  onMapChange = () => {}, npcSheets = {}, npcNames = {}, clockUnits = { d: 'd', h: 'h' },
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
    pixelDensity: renderDensity(canvas),
  });
  const FONT = `cbg-pixel-${Date.now().toString(36)}-${++sceneCounter}`; // unique even after a hot reload of this module
  // Text size that fits `maxW` world px (the pixel font is wide: long names and labels shrink instead of spilling).
  const fitCache = new Map();
  const fit = (text, size, maxW) => {
    const key = `${size}|${maxW}|${text}`;
    let v = fitCache.get(key);
    if (v === undefined) {
      const w = k.formatText({ font: FONT, text, size }).width;
      v = w > maxW ? Math.max(3, (size * maxW) / w) : size;
      if (fitCache.size > 500) fitCache.clear();
      fitCache.set(key, v);
    }
    return v;
  };
  const col = (hex) => k.Color.fromHex(hex);
  const rect = (x, y, w, h, hex, opacity = 1) => k.drawRect({ pos: k.vec2(x, y), width: w, height: h, color: col(hex), opacity });

  // ── sprites: character sheet, grounds, dragon, one per building and per shop artwork ──
  const anims = {};
  ROWS.forEach((dir, row) => {
    anims[`${dir}-idle`] = { from: row * COLS + IDLE_COL[dir], to: row * COLS + IDLE_COL[dir] };
    anims[`${dir}-walk`] = { from: row * COLS, to: row * COLS + COLS - 1, loop: true, speed: 7 };
  });
  await Promise.all([
    k.loadFont(FONT, PIXEL_FONT_URL, { filter: 'linear' }),
    k.loadSprite('me', sheet.toDataURL(), { sliceX: COLS, sliceY: ROWS.length, anims }),
    k.loadSprite('ground', buildGroundCanvas().toDataURL()),
    k.loadSprite('ground-market', buildMarketGroundCanvas()), // big: handed over as a canvas, no PNG round trip
    k.loadSprite('dragon-statue', DRAGON_STATUE_URL),
    ...BUILDINGS.map((b) => k.loadSprite(`b-${b.id}`, buildBuildingCanvas(b).toDataURL())),
    ...Object.keys(SHOP_ART.arts).map((art) => k.loadSprite(`shop-${art}`, SHOP_ART_URLS[`../../assets/game/shops/${art}.png`])),
    ...Object.entries(npcSheets).map(([id, c]) => k.loadSprite(`npc-${id}`, c.toDataURL(), { sliceX: COLS, sliceY: ROWS.length, anims })),
  ]);

  const state = { activeDoor: null, guide: null, frozen: false, fade: null, auctionEnd: null };
  let current = mapById(start.map);
  // everything drawn for the current map carries the 'map' tag, so a map switch can clear it in one go
  const add = (comps) => k.add([...comps, 'map']);
  // on-screen joystick (touch): walking vector of length 0..1, used when no key is held
  let virtualStick = { x: 0, y: 0 };
  // speech bubbles over the heads: id ('me', a player id or 'npc:<npc id>') -> { text, until }
  const bubbles = new Map();
  const BUBBLE_MS = 4000;
  const placeById = (id) => current.places.find((p) => p.id === id) || null;

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

  /** Where the dragon artwork is drawn: its golden disc centred on the statue's collision box. */
  function dragonBox() {
    const cx = CREDITS_PLACE.x + CREDITS_PLACE.w / 2;
    const cy = CREDITS_PLACE.y + CREDITS_PLACE.h / 2;
    return { x: cx - DRAGON_STATUE.discX, y: cy - DRAGON_STATUE.discY, w: DRAGON_STATUE.w, h: DRAGON_STATUE.h };
  }

  // ── the plaza ──────────────────────────────────────────────────────────────────
  function buildPlaza() {
    // ground + a soft pulsing golden glow under the statue
    add([k.sprite('ground'), k.pos(0, 0), k.z(0)]);
    const statueX = CREDITS_PLACE.x + CREDITS_PLACE.w / 2;
    const statueBottom = CREDITS_PLACE.y + CREDITS_PLACE.h;
    const statueBox = dragonBox();
    add([k.pos(0, 0), k.z(1), {
      draw() {
        const pulse = 0.5 + 0.5 * Math.sin(k.time() * 2.2);
        k.drawEllipse({ pos: k.vec2(statueX, statueBottom), radiusX: 58, radiusY: 24, color: col('#ffd23f'), opacity: 0.1 + 0.08 * pulse });
      },
    }]);

    // ── the dragon statue (credits): the artwork stands with its golden disc on the summoning ring ──
    add([k.sprite('dragon-statue'), k.pos(statueBox.x, statueBox.y), k.scale(DRAGON_STATUE.texScale), k.z(statueBottom)]);
    add([k.pos(0, 0), k.z(statueBottom + 1), {
      draw() {
        const t = k.time();
        // twinkling sparkles around the statue (its blue flames are part of the artwork)
        [[-56, -70], [54, -76], [-18, -92], [24, -88], [-62, -30], [62, -24]].forEach(([dx, dy], i) => {
          const a = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.3);
          if (a > 0.55) {
            rect(statueX + dx - 1, statueBottom + dy, 3, 1, '#fff7c2', a);
            rect(statueX + dx, statueBottom + dy - 1, 1, 3, '#fff7c2', a);
          }
        });
        const creditsText = String(labels.credits || '').toUpperCase();
        const cs = fit(creditsText, 7, 150);
        const lw = k.formatText({ font: FONT, text: creditsText, size: cs }).width + 8;
        const ly = statueBox.y - 4;
        k.drawRect({ pos: k.vec2(statueX - lw / 2, ly - 7), width: lw, height: 14, color: col('#07130b'), opacity: 0.75, radius: 2 });
        k.drawText({ font: FONT, text: creditsText, size: cs, pos: k.vec2(statueX, ly), anchor: 'center', color: col(CREDITS_PLACE.color) });
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
      add([k.pos(tr.x, tr.y), k.z(tr.y), {
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
      add([k.pos(p.x, p.y), k.z(p.type === 'teleport_pad' ? 2 : p.y), { draw() { drawProp(p); } }]);
    }

    // a soft glow in front of each shop, in its aura colour
    add([k.pos(0, 0), k.z(1), {
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
      add([k.sprite(`b-${b.id}`), k.pos(b.x - BUILDING_PAD, b.y - ROOF_EXTRA), k.z(b.y + b.h)]);
      add([k.pos(b.x, b.y), k.z(b.y + b.h + 1), {
        draw() {
          k.drawText({ font: FONT, text: label, size: fit(label, 8, b.style === 'castle' ? b.w - 46 : b.w - 18), pos: k.vec2(b.w / 2, 34.5), anchor: 'center', color: col(b.color) });
          if (b.id === 'auctions') {
            // the real time left of the auction that ends first ('--:--' when none is running or it is unknown)
            const timer = clockText(timeLeft(state.auctionEnd), clockUnits);
            k.drawText({ font: FONT, text: timer, size: fit(timer, 6, AUCTION_TIMER_BOX.w - 3), pos: k.vec2(AUCTION_TIMER_BOX.x + AUCTION_TIMER_BOX.w / 2, AUCTION_TIMER_BOX.y + AUCTION_TIMER_BOX.h / 2), anchor: 'center', color: col('#7dffa0') });
          }
          drawDoorHints(b, b.x, b.y);
        },
      }]);
    }

    // ── floating coins, cards and cloud shadows (decor) ──────────────────────────
    add([k.pos(0, 0), k.z(5000), {
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
    add([k.pos(0, 0), k.z(9000), {
      draw() {
        const t = k.time();
        for (const c of CLOUDS) {
          const x = ((c.x + t * c.sp) % (WORLD.w + 160)) - 80;
          k.drawEllipse({ pos: k.vec2(x, c.y), radiusX: c.rx, radiusY: c.ry, color: col('#0b2a14'), opacity: 0.06 });
        }
      },
    }]);
  }

  // ── the market inside the castle ───────────────────────────────────────────────
  const FLOWERS = ['#f472b6', '#facc15', '#ffffff', '#fb7185', '#a78bfa', '#38bdf8'];
  const ellipse = (x, y, rx, ry, hex, opacity = 1) => k.drawEllipse({ pos: k.vec2(x, y), radiusX: rx, radiusY: ry, color: col(hex), opacity });
  const MARKET_PROP_DRAW = {
    barrel() {
      ellipse(0, 0, 7, 2, '#000000', 0.25);
      rect(-6, -14, 12, 14, '#7a4a22');
      rect(-6, -14, 12, 2, '#a8702f');
      rect(-6, -10, 12, 1, '#3a2a18');
      rect(-6, -4, 12, 1, '#3a2a18');
      rect(-4, -14, 1, 14, '#5e3a18');
      rect(3, -14, 1, 14, '#5e3a18');
      rect(-5, -13.5, 2, 12, '#ffffff', 0.12);
    },
    crate(p) {
      if (p.solid !== 'none') ellipse(0, 0, p.w / 2 + 1, 2, '#000000', 0.22);
      rect(-p.w / 2, -p.h, p.w, p.h, '#8b5a2b');
      rect(-p.w / 2, -p.h, p.w, 1, '#c08a3e');
      rect(-p.w / 2, -p.h, 1, p.h, '#5e3a18');
      rect(p.w / 2 - 1, -p.h, 1, p.h, '#5e3a18');
      for (let i = 0; i < p.h; i++) { // two diagonal planks
        const off = Math.round((i * (p.w - 1)) / p.h);
        rect(-p.w / 2 + off, -p.h + i, 1, 1, '#5e3a18');
        rect(p.w / 2 - 1 - off, -p.h + i, 1, 1, '#5e3a18');
      }
    },
    cart(p) {
      ellipse(0, 0, p.w / 2, 2.5, '#000000', 0.22);
      rect(-p.w / 2, -p.h + 2, p.w, p.h - 6, '#8b5a2b');
      rect(-p.w / 2, -p.h + 2, p.w, 2, '#c08a3e');
      for (let i = 0; i < 5; i++) rect(-p.w / 2 + 2 + i * 5, -p.h - 1 - (i % 2) * 2, 5, 4, i % 2 ? p.color : '#fdfdf6'); // goods
      for (const wx of [-p.w / 2 + 5, p.w / 2 - 5]) {
        k.drawCircle({ pos: k.vec2(wx, -3), radius: 4, color: col('#3a2a18') });
        k.drawCircle({ pos: k.vec2(wx, -3), radius: 2, color: col('#8b5a2b') });
      }
    },
    // a black iron post with a warm lantern, like the ones hanging on the shops
    lantern(p) {
      const flick = 0.5 + 0.5 * Math.sin(k.time() * 3 + p.x);
      ellipse(0, 0, 5, 1.5, '#000000', 0.25);
      ellipse(0, -26, 12, 9, '#ffcf6b', 0.12 + 0.06 * flick);
      rect(-2.5, -2, 5, 2, '#1f2328');
      rect(-0.5, -24, 1.5, 22, '#1f2328');
      rect(0, -23, 0.5, 20, '#4b5563');
      rect(-3, -31, 7, 1, '#1f2328');
      rect(-2.5, -30, 6, 6, '#1f2328');
      rect(-1.5, -29, 4, 4, '#ffd77a');
      rect(-1, -28.5, 1.5, 3, '#fff3c4');
    },
    // a wooden box of flowers
    planter(p) {
      const { w } = p;
      ellipse(0, 0, w / 2 + 1, 2, '#000000', 0.22);
      rect(-w / 2, -6, w, 6, '#8b5a2b');
      rect(-w / 2, -6, w, 1, '#c08a3e');
      rect(-w / 2, -1, w, 1, '#5e3a18');
      for (let x = -w / 2 + 3; x < w / 2; x += 5) rect(x, -5, 0.5, 4, '#6b4423');
      for (let i = 0; i < w * 0.9; i++) {
        rect(-w / 2 + 1 + hash(p.x, i, 1) * (w - 2), -7 - hash(p.x, i, 2) * 5, 1.5, 1.5, hash(i, p.x, 3) > 0.45 ? '#3f8f3a' : '#5bb143');
      }
      for (let i = 0; i < w / 3; i++) {
        const fx = -w / 2 + 2 + hash(p.x, i, 4) * (w - 4);
        const fy = -8 - hash(p.x, i, 5) * 4;
        rect(fx, fy, 1.5, 1.5, FLOWERS[i % FLOWERS.length]);
        rect(fx + 0.5, fy + 0.5, 0.5, 0.5, '#fde047');
      }
    },
    bush(p) {
      ellipse(0, 0, 9, 2.5, '#000000', 0.22);
      ellipse(0, -6, 9, 7, '#2f6d2a');
      ellipse(-1, -7, 7.5, 6, '#3f8f3a');
      ellipse(-2.5, -8.5, 4, 3, '#5bb143');
      for (let i = 0; i < 4; i++) rect(-6 + hash(p.x, i) * 12, -11 + hash(i, p.y) * 8, 1.5, 1.5, FLOWERS[(i + p.x) % 4]);
    },
    bench() {
      ellipse(0, 0, 13, 2, '#000000', 0.22);
      rect(-12, -12, 24, 4, '#a8692f');
      rect(-12, -12, 24, 1, '#d08f4a');
      rect(-12, -7, 24, 4, '#a8692f');
      rect(-12, -7, 24, 1, '#d08f4a');
      rect(-11, -3, 1.5, 3, '#1f2328');
      rect(9.5, -3, 1.5, 3, '#1f2328');
      rect(-11, -13, 1.5, 2, '#1f2328');
      rect(9.5, -13, 1.5, 2, '#1f2328');
    },
  };

  // the name of a shop on a wooden board above its roof (long names shrink to fit)
  const signWidths = new Map();
  function drawShopSign(cx, y, text) {
    const size = fit(text, 6, 132);
    let tw = signWidths.get(text);
    if (tw === undefined) { tw = k.formatText({ font: FONT, text, size }).width; signWidths.set(text, tw); }
    const w = Math.round(tw + 10);
    const h = Math.round(size + 7);
    const x = Math.round(cx - w / 2);
    rect(x, y, w, h, '#2a1d17');
    rect(x + 1, y + 1, w - 2, h - 2, '#c58a4a');
    rect(x + 1, y + 1, w - 2, 1, '#e3a964');
    rect(x + 1, y + h - 2, w - 2, 1, '#8f5d2c');
    for (const [nx, ny] of [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + h - 3], [x + w - 3, y + h - 3]]) rect(nx, ny, 1, 1, '#2a1d17');
    k.drawText({ font: FONT, text, size, pos: k.vec2(cx + 0.6, y + h / 2 + 0.6), anchor: 'center', color: col('#000000'), opacity: 0.3 });
    k.drawText({ font: FONT, text, size, pos: k.vec2(cx, y + h / 2), anchor: 'center', color: col('#3a2210') });
  }

  // a gate tower: stone blocks, a window, a cone of red tiles and a lime pennant on top
  const TOWER_STONES = ['#a3a9b4', '#99a0ac', '#aeb4be', '#949ba7'];
  function drawTower({ x, y, w, h }) {
    rect(x, y, w, h, '#5d6470');
    for (let yy = y, row = 0; yy < y + h; yy += 5, row++) {
      for (let xx = x - (row & 1) * 4; xx < x + w; xx += 8) {
        const a = Math.max(x, xx);
        const b = Math.min(x + w, xx + 8);
        if (b - a < 1) continue;
        rect(a + 0.5, yy + 0.5, b - a - 1, 4, TOWER_STONES[Math.floor(hash(xx, yy, 3) * TOWER_STONES.length)]);
        rect(a + 0.5, yy + 0.5, b - a - 1, 0.5, '#d3d8df');
      }
    }
    rect(x, y, 1, h, '#4b525d');
    rect(x + w - 1, y, 1, h, '#4b525d');
    rect(x + w / 2 - 2.5, y + 12, 5, 9, '#1f2430');
    rect(x + w / 2 - 2.5, y + 12, 5, 1, '#3b4250');
    for (let i = 0; i < 18; i++) {
      const half = 2 + (i / 17) * (w / 2 + 3);
      rect(x + w / 2 - half, y - 18 + i, half * 2, 1, i % 3 === 0 ? '#7f2a1e' : '#b8402e');
      if (i % 3 === 1) for (let xx = x + w / 2 - half + 2; xx < x + w / 2 + half - 1; xx += 4) rect(xx, y - 18 + i, 1, 1, '#e0705a');
    }
    rect(x + w / 2 - 0.5, y - 24, 1, 6, '#3a2a18');
    rect(x + w / 2 + 0.5, y - 24, 6, 3, '#c6ff3d');
  }

  function buildMarket() {
    add([k.sprite('ground-market'), k.pos(0, 0), k.scale(1 / GROUND_SCALE), k.z(0)]);
    // a soft glow in front of every shop and of the gate
    add([k.pos(0, 0), k.z(1), {
      draw() {
        const pulse = 0.5 + 0.5 * Math.sin(k.time() * 2);
        for (const b of [...MARKET_SHOPS, MY_SHOP, EXIT_GATE]) {
          const c = doorCentre(b);
          k.drawEllipse({ pos: k.vec2(c.x, c.y), radiusX: 18, radiusY: 7, color: col(b.auraColor), opacity: 0.08 + 0.1 * pulse });
        }
      },
    }]);
    // the eight shops and the player's own one in the middle (characters walk behind their roofs), each name on a
    // board above the roof
    for (const s of [...MARKET_SHOPS, MY_SHOP]) {
      const label = String(labels[s.id] || s.id);
      add([k.pos(0, 0), k.z(s.base - 0.5), { draw() { ellipse(s.cx, s.base - 1, s.drawn.w / 2 - 4, 3.5, '#000000', 0.28); } }]);
      add([k.sprite(`shop-${s.art}`), k.pos(s.drawn.x, s.drawn.y), k.scale(SHOP_ART.texScale), k.z(s.base)]);
      add([k.pos(0, 0), k.z(s.base + 1), {
        draw() {
          drawShopSign(s.cx, Math.round(s.drawn.y - 12), label);
          drawDoorHints(s, 0, 0);
        },
      }]);
    }
    for (const p of MARKET_PROPS) {
      const drawProp = MARKET_PROP_DRAW[p.type];
      if (drawProp) add([k.pos(p.x, p.y), k.z(p.solid === 'none' ? p.y + 1 : p.y), { draw() { drawProp(p); } }]);
    }
    // the gate back to the plaza: its two towers (in front of anyone walking past), name board + door hint
    const gateLabel = String(labels.exit || 'exit').toUpperCase();
    add([k.pos(0, 0), k.z(MARKET_WORLD.h), {
      draw() {
        for (const t of GATE_TOWERS) drawTower(t);
        const cx = EXIT_GATE.x + EXIT_GATE.w / 2;
        const gs = fit(gateLabel, 8, 90);
        const lw = k.formatText({ font: FONT, text: gateLabel, size: gs }).width + 8;
        k.drawRect({ pos: k.vec2(cx - lw / 2, EXIT_GATE.y - 4), width: lw, height: 13, color: col('#2a1a0e'), outline: { width: 1, color: col('#c08a3e') } });
        k.drawText({ font: FONT, text: gateLabel, size: gs, pos: k.vec2(cx, EXIT_GATE.y + 2.5), anchor: 'center', color: col(EXIT_GATE.color) });
        drawDoorHints(EXIT_GATE, 0, 0);
      },
    }]);
  }

  // ── NPCs: keepers, merchants and the guide, drawn like players, with a name tag and a "!" over the head ──
  let npcsHere = [];
  function buildNpcs() {
    npcsHere = drawnNpcs(current.id).filter((n) => npcSheets[n.id]);
    for (const n of npcsHere) {
      add([k.sprite(`npc-${n.id}`, { anim: 'down-idle' }), k.pos(n.x, n.y), k.anchor('bot'), k.scale(CHAR_SCALE), k.z(n.y)]);
    }
  }
  /** The place whose door talks to NPC `n`: its building, or the NPC itself when it stands alone. */
  const npcPlaceId = (n) => n.place || n.id;
  function drawNpcTags() {
    const t = k.time();
    for (const n of npcsHere) {
      // the name sits over the head (the feet are where players' name tags go), with the "!" of someone to talk
      // to on its left; both pulse while the player stands in front of them
      const near = state.activeDoor === npcPlaceId(n);
      const s = near ? 1.2 + 0.1 * Math.sin(t * 8) : 1;
      const top = n.y - FRAME.h * CHAR_SCALE - 2;
      const name = String(npcNames[n.id] || '');
      const ns = name ? fit(name, 5, 80) : 0;
      const nw = name ? k.formatText({ font: FONT, text: name, size: ns }).width + 4 : 0;
      const bw = 8 * s;
      const total = nw + bw + (name ? 2 : 0);
      const left = n.x - total / 2;
      const by = top - 10 * s + Math.sin(t * 3 + n.x) * 1;
      k.drawRect({ pos: k.vec2(left, by), width: bw, height: 10 * s, color: col('#0b0914'), opacity: 0.85, radius: 2 });
      k.drawText({ font: FONT, text: '!', size: 7 * s, pos: k.vec2(left + bw / 2 + 0.5, by + 5.4 * s), anchor: 'center', color: col(near ? '#ffffff' : n.color) });
      if (name) {
        const nx = left + bw + 2;
        k.drawRect({ pos: k.vec2(nx, by + 5 * s - 4), width: nw, height: 8, color: col('#000000'), opacity: 0.65, radius: 2 });
        k.drawText({ font: FONT, text: name, size: ns, pos: k.vec2(nx + nw / 2, by + 5 * s), anchor: 'center', color: col(n.color) });
      }
    }
  }

  /** Clears whatever map is on screen and builds the current one. */
  function buildMap() {
    k.destroyAll('map');
    if (current.id === 'market') buildMarket();
    else buildPlaza();
    buildNpcs();
  }

  // ── player ───────────────────────────────────────────────────────────────────
  let pos = spawnPoint(current.id, start.spawn);
  let facing = { dir: 'down', flip: false };
  let currentAnim = 'down-idle';
  let target = null;
  // walking to a place (tap on an NPC / building, or "take me there" in a dialogue): waypoints around the
  // obstacles, then "enter" once the character stands at the door
  let route = null;
  let pendingEnter = null;
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
      drawNpcTags();
      const ns = fit(username, 7, 96);
      const ft = k.formatText({ font: FONT, text: username, size: ns });
      const w = ft.width + 6;
      k.drawRect({ pos: k.vec2(pos.x - w / 2, pos.y + 3), width: w, height: 11, color: col('#000000'), opacity: 0.6, radius: 2 });
      k.drawText({ font: FONT, text: username, size: ns, pos: k.vec2(pos.x, pos.y + 8.5), anchor: 'center', color: col('#ffffff') });
      // speech bubbles (fixed phrases / emojis from the plaza chat) above the heads
      const nowMs = k.time() * 1000;
      const drawBubble = (x, footY, text) => {
        const bs = fit(text, 6, 150);
        const bw = k.formatText({ font: FONT, text, size: bs }).width + 8;
        const by = footY - FRAME.h * CHAR_SCALE - 14;
        k.drawRect({ pos: k.vec2(x - bw / 2, by), width: bw, height: 11, color: col('#0b0914'), opacity: 0.88, radius: 3 });
        k.drawTriangle({ p1: k.vec2(x - 3, by + 11), p2: k.vec2(x + 3, by + 11), p3: k.vec2(x, by + 14), color: col('#0b0914'), opacity: 0.88 });
        k.drawText({ font: FONT, text, size: bs, pos: k.vec2(x, by + 5.5), anchor: 'center', color: col('#ffffff') });
      };
      for (const [bid, b] of bubbles) {
        if (b.until < nowMs) { bubbles.delete(bid); continue; }
        if (bid === 'me') drawBubble(pos.x, pos.y, b.text);
        else if (bid.startsWith('npc:')) {
          // NPCs: above their name tag; only while they stand on the map on screen
          const n = npcsHere.find((x) => `npc:${x.id}` === bid);
          if (n) drawBubble(n.x, n.y - 12, b.text);
        } else { const r = remotes.get(bid); if (r && r.obj) drawBubble(r.x, r.y, b.text); }
      }
      // other players: smaller, dimmer name tags
      for (const r of remotes.values()) {
        if (!r.obj) continue;
        const rs = fit(r.username, 5, 80);
        const rw = k.formatText({ font: FONT, text: r.username, size: rs }).width + 4;
        k.drawRect({ pos: k.vec2(r.x - rw / 2, r.y + 3), width: rw, height: 8, color: col('#000000'), opacity: 0.45, radius: 2 });
        k.drawText({ font: FONT, text: r.username, size: rs, pos: k.vec2(r.x, r.y + 7), anchor: 'center', color: col('#e5e7eb') });
      }

      // the tutorial stops are in the plaza: from the market the arrow points at the gate back
      const place = state.guide ? (placeById(state.guide) || (current.id === 'market' ? EXIT_GATE : null)) : null;
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
    if (state.frozen || state.fade) return;
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
    // tapping an NPC, a building or a stall walks there and talks to / enters it
    const inBox = (b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    const npc = npcsHere.find((n) => inBox(npcHitBox(n)));
    const tapped = npc ? placeById(npcPlaceId(npc)) : current.places.find((pl) => pl.kind !== 'npc' && (inBox(drawnBox(pl)) || inBox(pl.door)));
    if (tapped && walkTo(tapped.id)) return;
    route = null;
    pendingEnter = null;
    target = { x: Math.min(current.world.w - 8, Math.max(8, p.x)), y: Math.min(current.world.h - 4, Math.max(14, p.y)) };
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  const requestEnter = () => { if (!state.frozen && !state.fade && state.activeDoor) onEnterRequest(state.activeDoor); };
  /** What a place looks like on screen (roofs and the dragon rise above their collision box): its tap area. */
  function drawnBox(pl) {
    if (pl.id === CREDITS_PLACE.id) return dragonBox();
    if (pl.drawn) return pl.drawn; // a market shop: its artwork
    return { x: pl.x, y: pl.y - ROOF_EXTRA, w: pl.w, h: pl.h + ROOF_EXTRA };
  }
  /** Walks to the door of `placeId` (current map) around obstacles and enters it on arrival. false = no way there. */
  function walkTo(placeId) {
    const place = placeById(placeId);
    if (!place || state.frozen || state.fade) return false;
    route = null;
    target = null;
    if (state.activeDoor === place.id) { pendingEnter = null; requestEnter(); return true; }
    const path = findPath(pos, doorCentre(place), current.blocked, current.world);
    if (!path.length) { pendingEnter = null; return false; }
    pendingEnter = place.id;
    route = path;
    target = route.shift();
    return true;
  }
  k.onKeyPress('enter', requestEnter);
  k.onKeyPress('space', requestEnter);

  // ── changing map: fade to black, rebuild, fade back in ───────────────────────
  function switchMap(mapId, at) {
    current = mapById(mapId);
    buildMap();
    pos = { x: at.x, y: at.y };
    target = null;
    route = null;
    pendingEnter = null;
    player.pos = k.vec2(pos.x, pos.y);
    state.activeDoor = null;
    onDoorChange(null);
    onMapChange(current.id);
  }
  function stepFade(dt) {
    const f = state.fade;
    if (!f) return;
    f.t += dt;
    if (f.phase === 'out' && f.t >= FADE_S) {
      switchMap(f.mapId, f.at);
      f.phase = 'in';
      f.t = 0;
    } else if (f.phase === 'in' && f.t >= FADE_S) {
      state.fade = null;
    }
  }
  // the black veil of the fade, drawn over everything in screen space
  k.add([k.pos(0, 0), k.fixed(), k.z(10000), {
    draw() {
      const f = state.fade;
      if (!f) return;
      const a = f.phase === 'out' ? f.t / FADE_S : 1 - f.t / FADE_S;
      k.drawRect({ pos: k.vec2(0, 0), width: VIEW_W, height: VIEW_H, color: col('#000000'), opacity: Math.max(0, Math.min(1, a)) });
    },
  }]);

  k.onUpdate(() => {
    const dt = k.dt();
    stepFade(dt);
    let keys = state.frozen || state.fade ? { dx: 0, dy: 0 } : keyVector({
      left: down('left', 'a'),
      right: down('right', 'd'),
      up: down('up', 'w'),
      down: down('down', 's'),
    });
    if (keys.dx === 0 && keys.dy === 0 && !state.frozen && !state.fade) keys = { dx: virtualStick.x, dy: virtualStick.y };
    let dx = 0;
    let dy = 0;
    if (keys.dx !== 0 || keys.dy !== 0) {
      target = null;
      route = null;
      pendingEnter = null;
      dx = keys.dx * WALK_SPEED * dt;
      dy = keys.dy * WALK_SPEED * dt;
    } else if (target && !state.frozen && !state.fade) {
      const s = stepToward(pos, target, WALK_SPEED, dt);
      dx = s.dx;
      dy = s.dy;
      if (s.arrived) target = route && route.length ? route.shift() : null;
    }

    const next = dx || dy ? moveWithCollision(pos, dx, dy, current.blocked, current.world) : pos;
    const moved = next.x !== pos.x || next.y !== pos.y;
    // walked into a wall: stop instead of pushing forever (a frame spent reaching a waypoint does not count)
    if (target && !moved && (dx || dy)) { target = null; route = null; }
    pos = next;
    if (dx || dy) facing = facingFor(dx, dy, facing);

    const row = facing.dir === 'side' ? (facing.flip ? 'left' : 'right') : facing.dir;
    const anim = `${row}-${moved ? 'walk' : 'idle'}`;
    if (anim !== currentAnim) { currentAnim = anim; player.play(anim); }
    const bob = moved ? Math.abs(Math.sin(k.time() * 11)) * 1.2 : 0; // a little hop while walking
    player.pos = k.vec2(pos.x, pos.y - bob);
    player.z = pos.y;

    const camX = Math.min(current.world.w - VIEW_W / 2, Math.max(VIEW_W / 2, pos.x));
    const camY = Math.min(current.world.h - VIEW_H / 2, Math.max(VIEW_H / 2, pos.y - (FRAME.h * CHAR_SCALE) / 2));
    k.setCamPos(camX, camY);

    const door = state.fade ? null : doorAt(pos, current.places);
    const id = door ? door.id : null;
    if (id !== state.activeDoor) { state.activeDoor = id; onDoorChange(id); }
    if (pendingEnter && id === pendingEnter) {
      pendingEnter = null;
      route = null;
      target = null;
      requestEnter();
    } else if (pendingEnter && !target) {
      pendingEnter = null; // stopped before the door (blocked, or the player took over)
    }

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

  buildMap();

  return {
    enter: requestEnter,
    /** Place id the guide arrow should point at (null hides it). */
    setGuide(id) { state.guide = id || null; },
    /** While frozen (a tutorial card is open) the character ignores input. */
    setFrozen(v) { state.frozen = Boolean(v); if (v) { target = null; route = null; pendingEnter = null; } },
    /** Walks to the door of a place of the current map and enters it ("take me there" in a dialogue). */
    walkTo,
    /** End (ISO date) of the real auction that ends first, shown on the auction house clock; null = none. */
    setAuctionClock(endIso) { state.auctionEnd = endIso || null; },
    addRemote,
    moveRemote,
    removeRemote,
    /** Walking vector of the on-screen joystick: { x, y } of length 0..1 (proportional speed); zeros = released. */
    setVirtualStick(v) { virtualStick = clampStick(v); },
    /** Shows `text` in a bubble above a character for a few seconds ('me' = our own character, 'npc:<id>' an NPC). */
    showBubble(id, text) { bubbles.set(id, { text: String(text), until: k.time() * 1000 + BUBBLE_MS }); },
    /** The server refused a move: snap back to where it says we are (switching map first if it says so). */
    setPosition(x, y, mapId) {
      if (mapId && mapId !== current.id) { switchMap(mapId, { x, y }); return; }
      pos = { x, y };
      target = null;
      route = null;
    },
    /** Walks through a linking door: fades out, rebuilds `mapId` and puts the character at `spawnId`. */
    travel(mapId, spawnId) {
      if (state.fade) return;
      state.fade = { phase: 'out', t: 0, mapId, at: spawnPoint(mapId, spawnId) };
      target = null;
      route = null;
      pendingEnter = null;
    },
    /** The current map id and the spawn closest to the character (to come back here after a visit to the site). */
    whereAmI() { return { map: current.id, spawn: nearestSpawn(current.id, pos) }; },
    destroy() {
      alive = false;
      canvas.removeEventListener('pointerdown', onPointerDown);
      try { k.quit(); } catch { /* already gone */ }
    },
  };
}

