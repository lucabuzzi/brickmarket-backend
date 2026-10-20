// "CardBrix the game": the market inside the castle (entered from the Annunci castle of the plaza). A medieval
// market square closed by the castle walls: three stalls along the north wall, one per kind of listing (LEGO,
// collectible cards, Funko Pop), a well in the middle and the gate back to the plaza in the south wall.
// Pure layout data, like gameMap.js (unit-tested in tests/game-market.test.js); groundSprite.js paints the
// cobblestones and walls, gameScene.js draws the live parts. Sizes, spawns and the gate door come from
// config/gameMaps.json, which the server reads too.
import MAPS from '../../config/gameMaps.json';
import { propBox } from './gameMap';

const CFG = MAPS.maps.market;
export const MARKET_WORLD = { w: CFG.w, h: CFG.h };
export const MARKET_SPAWNS = CFG.spawns;

// The stalls: `color` is the Annunci pillar colour (sign text, door hint, glow), `awning` the stripes of the
// tent, `path` the real page of the site. Door zones sit in front of each stall, like in the plaza.
const STALL_Y = 60;
export const MARKET_STALLS = [
  { id: 'lego', x: 44, awning: '#e53935', signIcon: 'brick', path: '/annunci/lego' },
  { id: 'cards', x: 196, awning: '#2f6fe0', signIcon: 'card', path: '/annunci/carte-collezionabili' },
  { id: 'funko', x: 348, awning: '#ff8a2a', signIcon: 'funko', path: '/annunci/funko' },
].map((b) => ({
  ...b, y: STALL_Y, w: 88, h: 66, color: '#c6ff3d', auraColor: '#c6ff3d', roofStyle: 'pennants',
  door: { x: b.x + 28, y: STALL_Y + 66, w: 32, h: 14 },
}));

// The gate in the south wall: standing in front of it and pressing "enter" goes back to the plaza.
const exitLink = MAPS.links.find((l) => l.from === 'market' && l.place === 'exit');
export const EXIT_GATE = {
  id: 'exit', x: 212, y: 290, w: 56, h: 30, color: '#c6ff3d', auraColor: '#c6ff3d',
  door: { ...exitLink.door }, travel: { to: exitLink.to, spawn: exitLink.spawn },
};

export const MARKET_PLACES = [...MARKET_STALLS, EXIT_GATE];

// The castle walls around the square (the south wall is split by the gate).
export const WALLS = [
  { x: 0, y: 0, w: 480, h: 44 },
  { x: 0, y: 0, w: 16, h: 320 },
  { x: 464, y: 0, w: 16, h: 320 },
  { x: 0, y: 298, w: 212, h: 22 },
  { x: 268, y: 298, w: 212, h: 22 },
];

// The well in the middle of the square (collision box of its stone ring).
export const WELL = { x: 226, y: 194, w: 28, h: 12 };

// Market props: (x, y) = bottom-centre, solid like the plaza props ('base' = thin strip, 'full' = whole box).
export const MARKET_PROPS = [
  { id: 'barrel_nw', type: 'barrel', x: 30, y: 122, w: 12, h: 14, solid: 'base' },
  { id: 'barrel_ne', type: 'barrel', x: 450, y: 122, w: 12, h: 14, solid: 'base' },
  { id: 'barrel_sw', type: 'barrel', x: 30, y: 270, w: 12, h: 14, solid: 'base' },
  { id: 'barrel_se', type: 'barrel', x: 450, y: 270, w: 12, h: 14, solid: 'base' },
  { id: 'crate_w', type: 'crate', x: 164, y: 118, w: 14, h: 12, solid: 'full' },
  { id: 'crate_e', type: 'crate', x: 316, y: 118, w: 14, h: 12, solid: 'full' },
  { id: 'torch_w', type: 'torch', x: 168, y: 252, w: 6, h: 24, solid: 'base' },
  { id: 'torch_e', type: 'torch', x: 312, y: 252, w: 6, h: 24, solid: 'base' },
  { id: 'torch_nw', type: 'torch', x: 64, y: 196, w: 6, h: 24, solid: 'base' },
  { id: 'torch_ne', type: 'torch', x: 416, y: 196, w: 6, h: 24, solid: 'base' },
  { id: 'cart_w', type: 'cart', x: 92, y: 250, w: 30, h: 16, solid: 'full', color: '#ffd23f' },
  { id: 'cart_e', type: 'cart', x: 388, y: 250, w: 30, h: 16, solid: 'full', color: '#8b5cf6' },
];

export const MARKET_BLOCKED = [
  ...MARKET_STALLS.map(({ x, y, w, h }) => ({ x, y, w, h })),
  { x: EXIT_GATE.x, y: EXIT_GATE.y, w: EXIT_GATE.w, h: EXIT_GATE.h },
  ...WALLS,
  WELL,
  ...MARKET_PROPS.map(propBox).filter(Boolean),
];

// Paved ways of the square (visual only): the road from the gate to the well and on to the stalls.
export const MARKET_PATHS = [
  { x: 228, y: 210, w: 24, h: 80 },
  { x: 40, y: 140, w: 400, h: 20 },
  ...MARKET_STALLS.map((b) => ({ x: b.door.x + b.door.w / 2 - 10, y: b.y + b.h, w: 20, h: 16 })),
  { x: 228, y: 158, w: 24, h: 38 },
];
