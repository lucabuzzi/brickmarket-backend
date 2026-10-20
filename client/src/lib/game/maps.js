// "CardBrix the game": the registry of maps (the plaza and the market inside the castle) with what the scene
// needs to run either of them: world size, places with doors, obstacles and spawn points. Pure, unit-tested in
// tests/game-market.test.js. Which doors link which maps is in config/gameMaps.json (shared with the server).
import CONFIG from '../../config/gameMaps.json';
import { WORLD, PLACES, BLOCKED } from './gameMap';
import { MARKET_WORLD, MARKET_PLACES, MARKET_BLOCKED } from './marketMap';

export const MAPS = {
  plaza: { id: 'plaza', world: WORLD, places: PLACES, blocked: BLOCKED, ...CONFIG.maps.plaza },
  market: { id: 'market', world: MARKET_WORLD, places: MARKET_PLACES, blocked: MARKET_BLOCKED, ...CONFIG.maps.market },
};
export const MAP_IDS = Object.keys(MAPS);
export const MAP_LINKS = CONFIG.links;

/** Every place of every map (for labels and the UI around the canvas). */
export const ALL_PLACES = MAP_IDS.flatMap((id) => MAPS[id].places);

export function mapById(id) {
  return MAPS[id] || MAPS.plaza;
}

/** The point a character appears at in `mapId` (`spawnId`, else the map's default spawn). */
export function spawnPoint(mapId, spawnId) {
  const map = mapById(mapId);
  const p = map.spawns[spawnId] || map.spawns[map.defaultSpawn];
  return { x: p.x, y: p.y };
}

/** The spawn of `mapId` closest to `pos`: where to bring the player back after a visit to the site. */
export function nearestSpawn(mapId, pos) {
  const map = mapById(mapId);
  let best = map.defaultSpawn;
  let bestD = Infinity;
  for (const [id, p] of Object.entries(map.spawns)) {
    const d = Math.hypot(p.x - pos.x, p.y - pos.y);
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}
