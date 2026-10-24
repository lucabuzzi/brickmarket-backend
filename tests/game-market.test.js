// The market inside the castle and the links between maps (client/src/lib/game/marketMap.js, maps.js,
// marketGround.js, config/gameMaps.json): the shared config agrees with the plaza, every door that links two
// maps lands on a free spot, every shop and the gate can be walked to, the eight shops stand on an octagon round
// the plaza, and the market ground is painted whole and the same every time.
const WORLD_CFG = require('../client/src/config/gameWorld.json');
const CONFIG = require('../client/src/config/gameMaps.json');
const { BUILDINGS, isWalkable, doorAt, footRect, overlaps, propBox } = require('../client/src/lib/game/gameMap');
const {
  MARKET_WORLD, MARKET_SHOPS, SHOP_ARTS, MARKET_CENTRE, PLAZA, EXIT_GATE, GATE_TOWERS, MARKET_PROPS, MARKET_BLOCKED,
  MARKET_WAYS, WALLS, WALL_N, WALL_SIDE, WALL_S,
} = require('../client/src/lib/game/marketMap');
const { MAPS, MAP_IDS, MAP_LINKS, ALL_PLACES, spawnPoint, nearestSpawn, mapById } = require('../client/src/lib/game/maps');
const { paintMarketGround, GROUND_SCALE } = require('../client/src/lib/game/marketGround');
const { cleanQuery } = require('../client/src/lib/game/marketQueries');
const { paintBuilding, BUILDING_PAD, ROOF_EXTRA } = require('../client/src/lib/game/buildingSprite');

function record() {
  const rects = [];
  return { rects, fillStyle: '', fillRect(x, y, w, h) { rects.push({ x, y, w, h, c: this.fillStyle }); } };
}

/** Grid flood fill (2px steps) over the spots a character can stand on, from `from`. */
function reachable(map, from) {
  const key = (x, y) => `${x},${y}`;
  const start = { x: Math.round(from.x / 2) * 2, y: Math.round(from.y / 2) * 2 };
  const seen = new Set([key(start.x, start.y)]);
  const queue = [start];
  const out = [];
  while (queue.length) {
    const c = queue.shift();
    out.push(c);
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const n = { x: c.x + dx, y: c.y + dy };
      const k = key(n.x, n.y);
      if (seen.has(k) || !isWalkable(n, map.blocked, map.world)) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return out;
}
const reachesDoor = (spots, place) => spots.some((p) => overlaps(footRect(p), place.door));

describe('shared map config', () => {
  test('the plaza in gameMaps.json matches gameWorld.json (size and start point)', () => {
    expect([CONFIG.maps.plaza.w, CONFIG.maps.plaza.h]).toEqual([WORLD_CFG.w, WORLD_CFG.h]);
    expect(CONFIG.maps.plaza.spawns.start).toEqual(WORLD_CFG.spawn);
  });

  test('every link goes from a door of a real place to a real spawn of another map', () => {
    const castle = BUILDINGS.find((b) => b.id === 'listings');
    expect(MAP_LINKS.find((l) => l.from === 'plaza').door).toEqual(castle.door);
    expect(MAP_LINKS.find((l) => l.from === 'market').door).toEqual(EXIT_GATE.door);
    for (const l of MAP_LINKS) {
      expect(MAP_IDS).toContain(l.from);
      expect(MAP_IDS).toContain(l.to);
      expect(l.to).not.toBe(l.from);
      expect(MAPS[l.to].spawns[l.spawn]).toBeDefined();
      const place = MAPS[l.from].places.find((p) => p.id === l.place);
      expect(place.travel).toEqual({ to: l.to, spawn: l.spawn });
    }
  });

  test('every spawn point is free to stand on and outside every door zone (no instant re-entry)', () => {
    for (const id of MAP_IDS) {
      const map = MAPS[id];
      expect(map.spawns[map.defaultSpawn]).toBeDefined();
      for (const [name, p] of Object.entries(map.spawns)) {
        if (!isWalkable(p, map.blocked, map.world)) throw new Error(`${id}.${name} is blocked`);
        expect(doorAt(p, map.places)).toBeNull();
      }
    }
  });

  test('place ids are unique across maps (the UI looks them up by id)', () => {
    expect(new Set(ALL_PLACES.map((p) => p.id)).size).toBe(ALL_PLACES.length);
  });

  test('spawnPoint / nearestSpawn / mapById', () => {
    expect(spawnPoint('market', 'lego')).toEqual(CONFIG.maps.market.spawns.lego);
    expect(spawnPoint('market', 'nope')).toEqual(CONFIG.maps.market.spawns.gate);
    expect(spawnPoint('nowhere')).toEqual(CONFIG.maps.plaza.spawns.start);
    expect(nearestSpawn('market', { x: CONFIG.maps.market.spawns.funko.x + 3, y: CONFIG.maps.market.spawns.funko.y + 2 })).toBe('funko');
    expect(nearestSpawn('plaza', { x: 70, y: 120 })).toBe('castle');
    expect(mapById('???').id).toBe('plaza');
  });
});

describe('walking around', () => {
  test('from the market gate you can reach every shop and the gate door', () => {
    const spots = reachable(MAPS.market, spawnPoint('market', 'gate'));
    for (const place of MAPS.market.places) {
      if (!reachesDoor(spots, place)) throw new Error(`${place.id} cannot be reached`);
    }
  });

  test('back in the plaza (in front of the castle) you can reach every place', () => {
    const spots = reachable(MAPS.plaza, spawnPoint('plaza', 'castle'));
    for (const place of MAPS.plaza.places) {
      if (!reachesDoor(spots, place)) throw new Error(`${place.id} cannot be reached`);
    }
  });
});

describe('market layout', () => {
  test('eight shops, each leading to the real listing page of its kind', () => {
    expect(MARKET_SHOPS.map((s) => [s.id, s.path])).toEqual([
      ['pokemon', '/annunci/carte-collezionabili/pokemon'],
      ['yugioh', '/annunci/carte-collezionabili/yugioh'],
      ['lego', '/annunci/lego'],
      ['lorcana', '/annunci/carte-collezionabili/lorcana'],
      ['funko', '/annunci/funko'],
      ['dragonball', '/annunci/carte-collezionabili/dragonball'],
      ['magic', '/annunci/carte-collezionabili/magic'],
      ['onepiece', '/annunci/carte-collezionabili/onepiece'],
    ]);
    for (const s of MARKET_SHOPS) expect(cleanQuery(s.query)).toEqual(s.query);
  });

  test('the shops stand on the corners of an octagon round the plaza, open to the south (the gate)', () => {
    const c = MARKET_CENTRE;
    const angles = MARKET_SHOPS.map((s) => (Math.atan2((s.base - c.y) / 1.6, s.cx - c.x) * 180) / Math.PI).map((a) => (a + 360) % 360).sort((a, b) => a - b);
    // eight distinct directions, none pointing straight south (90°) or north (270°)
    expect(new Set(angles.map(Math.round)).size).toBe(8);
    for (const a of angles) { expect(Math.abs(a - 90)).toBeGreaterThan(10); expect(Math.abs(a - 270)).toBeGreaterThan(10); }
    // mirror-symmetric: for every shop there is one at the same height on the other side
    for (const s of MARKET_SHOPS) expect(MARKET_SHOPS.some((o) => o.base === s.base && o.cx === 2 * c.x - s.cx)).toBe(true);
    // the gate is straight south of the plaza
    expect(EXIT_GATE.x + EXIT_GATE.w / 2).toBe(c.x);
  });

  test('the three shops sharing the dice-shop art are never next to each other round the ring', () => {
    const ring = [...MARKET_SHOPS].sort((a, b) => a.k - b.k).map((s) => s.art);
    ring.forEach((art, i) => {
      if (art === 'dice_shop') expect(ring[(i + 1) % ring.length]).not.toBe('dice_shop');
    });
    expect(ring.filter((a) => a === 'dice_shop')).toHaveLength(3);
    for (const s of MARKET_SHOPS) expect(SHOP_ARTS[s.art]).toBeDefined();
  });

  test('shops, their artwork and their door zones do not overlap one another; doors open onto free ground', () => {
    for (const a of MARKET_SHOPS) {
      for (const b of MARKET_SHOPS) {
        if (a === b) continue;
        expect([a.id, b.id, overlaps(a.drawn, b.drawn)]).toEqual([a.id, b.id, false]);
      }
      // the collision box is the bottom of the drawn building, the door zone just in front of it
      expect(a.y + a.h).toBe(a.base);
      expect(a.drawn.y + a.drawn.h).toBe(a.base);
      expect(a.door.y).toBe(a.base);
      const others = MARKET_BLOCKED.filter((b) => !(b.x === a.x && b.y === a.y && b.w === a.w && b.h === a.h));
      for (const b of others) expect([a.id, overlaps(a.door, b)]).toEqual([a.id, false]);
    }
  });

  test('every shop is drawn inside the walls, its sign board below the north wall', () => {
    for (const s of MARKET_SHOPS) {
      expect(s.drawn.x).toBeGreaterThanOrEqual(WALL_SIDE);
      expect(s.drawn.x + s.drawn.w).toBeLessThanOrEqual(MARKET_WORLD.w - WALL_SIDE);
      expect(s.drawn.y - 12).toBeGreaterThanOrEqual(WALL_N);
      expect(s.door.y + s.door.h).toBeLessThan(MARKET_WORLD.h - WALL_S);
    }
  });

  test('every shop has a spawn in front of it (coming back from its page) and the plaza is free to walk on', () => {
    for (const s of MARKET_SHOPS) {
      const sp = MAPS.market.spawns[s.id];
      expect([s.id, Math.abs(sp.x - s.cx) <= 2 && sp.y > s.door.y + s.door.h && sp.y < s.door.y + 40]).toEqual([s.id, true]);
    }
    expect(nearestSpawn('market', { x: MARKET_SHOPS[0].cx, y: MARKET_SHOPS[0].base + 30 })).toBe(MARKET_SHOPS[0].id);
    expect(isWalkable({ x: PLAZA.x - 30, y: PLAZA.y }, MAPS.market.blocked, MAPS.market.world)).toBe(true);
  });

  test('props stay inside the walls and never block a door or a spawn', () => {
    for (const p of MARKET_PROPS) {
      expect(p.x - p.w / 2).toBeGreaterThanOrEqual(WALL_SIDE);
      expect(p.x + p.w / 2).toBeLessThanOrEqual(MARKET_WORLD.w - WALL_SIDE);
      const box = propBox(p);
      if (!box) continue;
      expect(MARKET_BLOCKED).toContainEqual(box);
      for (const place of [...MARKET_SHOPS, EXIT_GATE]) expect([p.id, place.id, overlaps(box, place.door)]).toEqual([p.id, place.id, false]);
      for (const [name, sp] of Object.entries(MAPS.market.spawns)) expect([p.id, name, overlaps(box, footRect(sp))]).toEqual([p.id, name, false]);
    }
  });

  test('the walls close the courtyard except for the gate, which the two towers frame', () => {
    const covered = (x, y) => WALLS.some((w) => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h)
      || (x >= EXIT_GATE.x && x < EXIT_GATE.x + EXIT_GATE.w && y >= EXIT_GATE.y);
    for (let x = 0; x < MARKET_WORLD.w; x += 4) expect(covered(x, 2)).toBe(true);
    for (let x = 0; x < MARKET_WORLD.w; x += 4) expect(covered(x, MARKET_WORLD.h - 2)).toBe(true);
    for (let y = 0; y < MARKET_WORLD.h; y += 4) { expect(covered(2, y)).toBe(true); expect(covered(MARKET_WORLD.w - 2, y)).toBe(true); }
    const [west, east] = GATE_TOWERS;
    expect(west.x + west.w).toBeLessThanOrEqual(EXIT_GATE.door.x);
    expect(east.x).toBeGreaterThanOrEqual(EXIT_GATE.door.x + EXIT_GATE.door.w);
    for (const t of GATE_TOWERS) expect(MARKET_BLOCKED).toContainEqual(t);
  });
});

describe('market art', () => {
  const ground = paintMarketGround();

  test('the ground covers the whole market at GROUND_SCALE, every pixel opaque, and is deterministic', () => {
    expect([ground.width, ground.height]).toEqual([MARKET_WORLD.w * GROUND_SCALE, MARKET_WORLD.h * GROUND_SCALE]);
    expect(ground.data.length).toBe(ground.width * ground.height * 4);
    for (let i = 3; i < ground.data.length; i += 4) if (ground.data[i] !== 255) throw new Error(`transparent pixel ${(i - 3) / 4}`);
    const again = paintMarketGround();
    expect(Buffer.from(again.data.buffer).equals(Buffer.from(ground.data.buffer))).toBe(true);
  });

  test('ways, plaza and walls show where they are', () => {
    const at = (x, y) => { const i = (Math.round(y * GROUND_SCALE) * ground.width + Math.round(x * GROUND_SCALE)) * 4; return [ground.data[i], ground.data[i + 1], ground.data[i + 2]]; };
    const warm = ([r, , b]) => r - b > 40; // bricks of the ways
    const shop = MARKET_SHOPS[0];
    expect(warm(at(shop.cx + 1, shop.base + 9.5))).toBe(true); // in front of a door
    expect(warm(at(MARKET_CENTRE.x + 1, (shop.base + PLAZA.y - PLAZA.ry) / 2))).toBe(true); // the north way
    expect(warm(at(100, 120))).toBe(false); // plain cobbles in a corner
    const [r, g, b] = at(PLAZA.x + 30, PLAZA.y + 10);
    expect(Math.min(r, g, b)).toBeGreaterThan(150); // light slabs of the plaza
    expect(MARKET_WAYS.length).toBeGreaterThan(0);
  });

  test('the castle in the plaza still paints inside its canvas', () => {
    const b = BUILDINGS.find((x) => x.id === 'listings');
    const ctx = record();
    paintBuilding(ctx, b, 0, 0);
    for (const r of ctx.rects) {
      if (!(r.w > 0 && r.h > 0 && r.x >= 0 && r.y >= 0 && r.x + r.w <= b.w + 2 * BUILDING_PAD && r.y + r.h <= b.h + ROOF_EXTRA)) {
        throw new Error(`outside the canvas: ${JSON.stringify(r)}`);
      }
    }
    expect(b.style).toBe('castle');
  });
});
