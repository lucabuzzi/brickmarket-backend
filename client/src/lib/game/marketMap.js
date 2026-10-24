// "CardBrix the game": the market inside the castle (entered from the Annunci castle of the plaza). A courtyard
// closed by the castle walls: eight shops on the corners of an octagon round a paved plaza, one shop per kind of
// listing (LEGO, Funko Pop and six card games), a ring of brick ways in front of their doors and the gate back to
// the plaza in the south wall. In the middle of the plaza stands the player's own shop, where they sell their things.
// Pure layout data, like gameMap.js (unit-tested in tests/game-market.test.js); marketGround.js paints the floor
// and the walls, the shop art comes from scripts/build-game-shops.js, gameScene.js draws the live parts. Sizes,
// spawns and the gate door come from config/gameMaps.json, which the server reads too.
import MAPS from '../../config/gameMaps.json';
import SHOP_ART from '../../assets/game/shops/shops.json';
import { propBox } from './gameMap';
import { siteCategoryPath } from './marketQueries';

const CFG = MAPS.maps.market;
export const MARKET_WORLD = { w: CFG.w, h: CFG.h };
export const MARKET_SPAWNS = CFG.spawns;

export const WALL_N = 52; // depth of the north wall (battlements, banners)
export const WALL_SIDE = 16;
export const WALL_S = 22;

// The octagon: shop k stands on its corner at angle 22.5 + 45k degrees (k = 0 east-south-east, clockwise), so the
// north and the south of the ring stay open (the south opening is the way to the gate).
export const MARKET_CENTRE = { x: 480, y: 410 };
const RX = 333 / Math.cos(Math.PI / 8);
const RY = 212 / Math.sin((3 * Math.PI) / 8);
function corner(k) {
  const a = ((22.5 + 45 * k) * Math.PI) / 180;
  return { x: Math.round(MARKET_CENTRE.x + RX * Math.cos(a)), y: Math.round(MARKET_CENTRE.y + RY * Math.sin(a)) };
}

// The shops: `art` is the building (client/src/assets/game/shops; the three card games without art of their own
// share the dice shop for now, never side by side), `query` the real listings its merchant shows, `path` the page
// of the site with the same listings. The collision box is the bottom of the building (FOOT_W x FOOT_H, roof and
// sign rise above it and can be walked behind); the door zone is in front of the door, on the brick way.
const FOOT_W = 112;
const FOOT_H = 46;
const SHOP_DEFS = [
  { id: 'pokemon', k: 5, art: 'card_shop', query: { product_type: 'tcg', game: 'pokemon' } },
  { id: 'yugioh', k: 6, art: 'dice_shop', query: { product_type: 'tcg', game: 'yugioh' } },
  { id: 'lego', k: 7, art: 'brick_shop', query: { product_type: 'lego' } },
  { id: 'lorcana', k: 0, art: 'dice_shop', query: { product_type: 'tcg', game: 'lorcana' } },
  { id: 'funko', k: 1, art: 'figure_shop', query: { product_type: 'funko' } },
  { id: 'dragonball', k: 2, art: 'dice_shop', query: { product_type: 'tcg', game: 'dragonball' } },
  { id: 'magic', k: 3, art: 'wizard_shop', query: { product_type: 'tcg', game: 'magic' } },
  { id: 'onepiece', k: 4, art: 'japan_shop', query: { product_type: 'tcg', game: 'onepiece' } },
];
export const SHOP_ARTS = SHOP_ART.arts;
export const MARKET_SHOPS = SHOP_DEFS.map((s) => {
  const { x: cx, y: base } = corner(s.k);
  const art = SHOP_ART.arts[s.art];
  return {
    ...s,
    cx,
    base,
    x: cx - FOOT_W / 2, y: base - FOOT_H, w: FOOT_W, h: FOOT_H,
    drawn: { x: cx - art.w / 2, y: base - art.h, w: art.w, h: art.h },
    door: { x: cx - 16, y: base, w: 32, h: 14 },
    color: '#c6ff3d', auraColor: '#c6ff3d',
    path: siteCategoryPath(s.query),
  };
});

// The gate in the south wall, between two small towers: standing in front of it and pressing "enter" goes back
// to the plaza.
const exitLink = MAPS.links.find((l) => l.from === 'market' && l.place === 'exit');
export const EXIT_GATE = {
  id: 'exit', x: 452, y: CFG.h - 30, w: 56, h: 30, color: '#c6ff3d', auraColor: '#c6ff3d',
  door: { ...exitLink.door }, travel: { to: exitLink.to, spawn: exitLink.spawn },
};
export const GATE_TOWERS = [
  { x: EXIT_GATE.x - 12, y: CFG.h - 56, w: 22, h: 56 },
  { x: EXIT_GATE.x + EXIT_GATE.w - 10, y: CFG.h - 56, w: 22, h: 56 },
];

// The player's own shop, in the middle of the plaza: every player sees it as theirs ("your shop"); its clerk sells the
// player's things (lib/game/sellFlow.js). Generic shop art for now, its door facing the south way and the gate.
const MY_SHOP_ART = 'dice_shop';
const MY_SHOP_BASE = MARKET_CENTRE.y + 30;
export const MY_SHOP = {
  id: 'myshop', art: MY_SHOP_ART, cx: MARKET_CENTRE.x, base: MY_SHOP_BASE,
  x: MARKET_CENTRE.x - FOOT_W / 2, y: MY_SHOP_BASE - FOOT_H, w: FOOT_W, h: FOOT_H,
  drawn: {
    x: MARKET_CENTRE.x - SHOP_ART.arts[MY_SHOP_ART].w / 2, y: MY_SHOP_BASE - SHOP_ART.arts[MY_SHOP_ART].h,
    w: SHOP_ART.arts[MY_SHOP_ART].w, h: SHOP_ART.arts[MY_SHOP_ART].h,
  },
  door: { x: MARKET_CENTRE.x - 16, y: MY_SHOP_BASE, w: 32, h: 14 },
  color: '#c6ff3d', auraColor: '#c6ff3d',
  path: '/sell',
};

export const MARKET_PLACES = [...MARKET_SHOPS, MY_SHOP, EXIT_GATE];

// The castle walls round the courtyard (the south wall is split by the gate).
export const WALLS = [
  { x: 0, y: 0, w: CFG.w, h: WALL_N },
  { x: 0, y: 0, w: WALL_SIDE, h: CFG.h },
  { x: CFG.w - WALL_SIDE, y: 0, w: WALL_SIDE, h: CFG.h },
  { x: 0, y: CFG.h - WALL_S, w: EXIT_GATE.x, h: WALL_S },
  { x: EXIT_GATE.x + EXIT_GATE.w, y: CFG.h - WALL_S, w: CFG.w - EXIT_GATE.x - EXIT_GATE.w, h: WALL_S },
];

// The paved plaza in the middle (an octagon too), where the player's shop stands.
export const PLAZA = { x: MARKET_CENTRE.x, y: MARKET_CENTRE.y, rx: 128, ry: 94 };
export function octagonPoints(o, grow = 0) {
  return Array.from({ length: 8 }, (_, k) => {
    const a = ((22.5 + 45 * k) * Math.PI) / 180;
    return [o.x + (o.rx + grow) * Math.cos(a), o.y + (o.ry + grow) * Math.sin(a)];
  });
}

// The brick ways (visual only): a ring joining the bit of way in front of every shop, round the outside of the
// side shops, and straight ways from the ring to the plaza (north and south) and on to the gate.
const at = (k) => MARKET_SHOPS.find((s) => s.k === k);
const PORCH = 66;
const WAY_Y = 9;
const L = (s) => [s.cx - PORCH, s.base + WAY_Y];
const R = (s) => [s.cx + PORCH, s.base + WAY_Y];
export const WAY_WIDTH = 16;
export const MARKET_WAYS = [
  [
    L(at(5)), R(at(5)), L(at(6)), R(at(6)), L(at(7)), R(at(7)),
    [R(at(7))[0] + 20, at(7).base + 18], [R(at(0))[0] + 20, at(0).base], R(at(0)), L(at(0)),
    R(at(1)), L(at(1)), R(at(2)), L(at(2)),
    R(at(3)), L(at(3)), [L(at(3))[0] - 20, at(3).base], [L(at(4))[0] - 20, at(4).base + 18], L(at(4)), R(at(4)), L(at(5)),
  ],
  [[MARKET_CENTRE.x, at(5).base + WAY_Y], [MARKET_CENTRE.x, PLAZA.y - PLAZA.ry + 4]],
  [[MARKET_CENTRE.x, PLAZA.y + PLAZA.ry - 4], [MARKET_CENTRE.x, CFG.h - 12]],
];

// Market props: (x, y) = bottom-centre, solid like the plaza props ('base' = thin strip, 'full' = whole box).
const lanterns = octagonPoints(PLAZA, -6).map(([x, y], i) => ({ id: `lantern_${i}`, type: 'lantern', x: Math.round(x), y: Math.round(y), w: 6, h: 32, solid: 'base' }));
const C = MARKET_CENTRE;
export const MARKET_PROPS = [
  ...lanterns,
  // benches and flower boxes on the plaza, in front of the player's shop
  ...[[C.x - 84, C.y + 78], [C.x + 84, C.y + 78]].map(([x, y], i) => ({ id: `bench_${i}`, type: 'bench', x, y, w: 24, h: 13, solid: 'base' })),
  ...[[C.x - 40, C.y + 74], [C.x + 40, C.y + 74]].map(([x, y], i) => ({ id: `plaza_planter_${i}`, type: 'planter', x, y, w: 18, h: 12, solid: 'base' })),
  // flower boxes between the shops and the plaza
  ...[[224, 300], [736, 300], [224, 470], [736, 470], [430, 190], [530, 190], [430, 610], [530, 610]].map(([x, y], i) => ({ id: `planter_${i}`, type: 'planter', x, y, w: 22, h: 12, solid: 'base' })),
  // bushes, barrels, crates and carts in the corners of the courtyard
  ...[[40, 80], [920, 80], [40, 676], [920, 676], [250, 120], [710, 120], [250, 676], [710, 676], [36, 250], [924, 250]].map(([x, y], i) => ({ id: `bush_${i}`, type: 'bush', x, y, w: 16, h: 14, solid: 'base' })),
  ...[[40, 130], [52, 134], [920, 130], [908, 134], [130, 670], [142, 674], [830, 670], [818, 674], [430, 80], [530, 80]].map(([x, y], i) => ({ id: `barrel_${i}`, type: 'barrel', x, y, w: 12, h: 14, solid: 'base' })),
  ...[[100, 140], [114, 140], [860, 140], [846, 140], [60, 600], [900, 600], [400, 670], [560, 670]].map(([x, y], i) => ({ id: `crate_${i}`, type: 'crate', x, y, w: 14, h: 12, solid: 'full' })),
  { id: 'crate_top_w', type: 'crate', x: 107, y: 128, w: 14, h: 12, solid: 'none' }, // stacked on the two below
  { id: 'crate_top_e', type: 'crate', x: 853, y: 128, w: 14, h: 12, solid: 'none' },
  ...[[150, 96, '#ffd23f'], [810, 96, '#8b5cf6'], [200, 664, '#ef4444'], [760, 664, '#22d3ee'], [330, 410, '#22c55e'], [630, 410, '#3b82f6']]
    .map(([x, y, color], i) => ({ id: `cart_${i}`, type: 'cart', x, y, w: 30, h: 16, solid: 'full', color })),
];

export const MARKET_BLOCKED = [
  ...MARKET_SHOPS.map(({ x, y, w, h }) => ({ x, y, w, h })),
  { x: MY_SHOP.x, y: MY_SHOP.y, w: MY_SHOP.w, h: MY_SHOP.h },
  { x: EXIT_GATE.x, y: EXIT_GATE.y, w: EXIT_GATE.w, h: EXIT_GATE.h },
  ...GATE_TOWERS,
  ...WALLS,
  ...MARKET_PROPS.map(propBox).filter(Boolean),
];
