// The market inside the castle and the links between maps (client/src/lib/game/marketMap.js, maps.js,
// marketGround.js, config/gameMaps.json): the shared config agrees with the plaza, every door that links two
// maps lands on a free spot, every stall and gate can be walked to, and the market art stays inside its canvas.
const WORLD_CFG = require('../client/src/config/gameWorld.json');
const CONFIG = require('../client/src/config/gameMaps.json');
const { BUILDINGS, isWalkable, doorAt, footRect, overlaps, propBox } = require('../client/src/lib/game/gameMap');
const {
  MARKET_WORLD, MARKET_STALLS, EXIT_GATE, MARKET_PROPS, MARKET_BLOCKED, MARKET_PATHS, WALLS,
} = require('../client/src/lib/game/marketMap');
const { MAPS, MAP_IDS, MAP_LINKS, ALL_PLACES, spawnPoint, nearestSpawn, mapById } = require('../client/src/lib/game/maps');
const { paintMarketGround } = require('../client/src/lib/game/marketGround');
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
    expect(nearestSpawn('market', { x: 395, y: 160 })).toBe('funko');
    expect(nearestSpawn('plaza', { x: 70, y: 120 })).toBe('castle');
    expect(mapById('???').id).toBe('plaza');
  });
});

describe('walking around', () => {
  test('from the market gate you can reach every stall and the gate door', () => {
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
  test('the stalls lead to the real listing pages', () => {
    expect(MARKET_STALLS.map((s) => [s.id, s.path])).toEqual([
      ['lego', '/annunci/lego'],
      ['cards', '/annunci/carte-collezionabili'],
      ['funko', '/annunci/funko'],
    ]);
  });

  test('stalls use the Annunci pillar colour for signs and hints, and each has its own tent', () => {
    for (const s of MARKET_STALLS) expect(s.color).toBe('#c6ff3d');
    expect(new Set(MARKET_STALLS.map((s) => s.awning)).size).toBe(3);
  });

  test('props stay inside the walls and never block a door or a spawn', () => {
    for (const p of MARKET_PROPS) {
      expect(p.x - p.w / 2).toBeGreaterThanOrEqual(16);
      expect(p.x + p.w / 2).toBeLessThanOrEqual(MARKET_WORLD.w - 16);
      const box = propBox(p);
      if (!box) continue;
      expect(MARKET_BLOCKED).toContainEqual(box);
      for (const place of MARKET_STALLS.concat(EXIT_GATE)) expect(overlaps(box, place.door)).toBe(false);
      for (const sp of Object.values(MAPS.market.spawns)) expect(overlaps(box, footRect(sp))).toBe(false);
    }
  });

  test('the walls close the square except for the gate', () => {
    const covered = (x, y) => WALLS.some((w) => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h)
      || (x >= EXIT_GATE.x && x < EXIT_GATE.x + EXIT_GATE.w && y >= EXIT_GATE.y);
    for (let x = 0; x < MARKET_WORLD.w; x += 4) expect(covered(x, 2)).toBe(true);
    for (let x = 0; x < MARKET_WORLD.w; x += 4) expect(covered(x, MARKET_WORLD.h - 2)).toBe(true);
  });
});

describe('market art', () => {
  test('the ground paints only inside the market and is deterministic', () => {
    const a = record();
    paintMarketGround(a);
    expect(a.rects.length).toBeGreaterThan(500);
    for (const r of a.rects) {
      if (!(r.w > 0 && r.h > 0 && r.x >= 0 && r.y >= 0 && r.x + r.w <= MARKET_WORLD.w && r.y + r.h <= MARKET_WORLD.h)) {
        throw new Error(`outside the market: ${JSON.stringify(r)}`);
      }
    }
    const b = record();
    paintMarketGround(b);
    expect(b.rects).toEqual(a.rects);
    expect(MARKET_PATHS.length).toBeGreaterThan(0);
  });

  test.each([...MARKET_STALLS, BUILDINGS.find((b) => b.id === 'listings')])('$id paints inside its canvas, with its colours', (b) => {
    const ctx = record();
    paintBuilding(ctx, b, 0, 0);
    for (const r of ctx.rects) {
      if (!(r.w > 0 && r.h > 0 && r.x >= 0 && r.y >= 0 && r.x + r.w <= b.w + 2 * BUILDING_PAD && r.y + r.h <= b.h + ROOF_EXTRA)) {
        throw new Error(`outside the canvas: ${JSON.stringify(r)}`);
      }
    }
    expect(ctx.rects.some((r) => r.c === (b.awning || b.color))).toBe(true);
    expect(ctx.rects.some((r) => r.y < ROOF_EXTRA)).toBe(true);
  });

  test('the castle does not look like a stall, and the three market stalls differ', () => {
    const sig = (b) => { const c = record(); paintBuilding(c, b); return JSON.stringify(c.rects); };
    const castle = BUILDINGS.find((b) => b.id === 'listings');
    expect(castle.style).toBe('castle');
    const sigs = [castle, ...MARKET_STALLS].map(sig);
    expect(new Set(sigs).size).toBe(4);
  });
});
