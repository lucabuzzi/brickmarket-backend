// The plaza of "CardBrix the game": who is in it, in which map (the plaza or the market inside the castle), where
// they stand, and whether a move or a change of map they report is possible.
// Pure (no sockets, no DB, injectable clock), unit-tested in tests/game-plaza.test.js; the WebSocket wiring is
// in gamePlazaSocket.js. Players are shown only by username and character (never e-mail or any other data),
// and a player who switched "visible in the plaza" off is never sent to anyone.
//
// State lives in this process's memory: fine while the backend runs as a single instance (Render today). With
// several instances the plaza would need a shared store (e.g. Redis pub/sub).
const WORLD = require('../../client/src/config/gameWorld.json');
const { normalizeAvatarConfig, defaultAvatarConfig } = require('./avatarConfig');
const PHRASES = require('../../client/src/config/plazaPhrases.json');
const MAPS = require('../../client/src/config/gameMaps.json');

// How far (world px) from a linking door the server still accepts "I walk through it": the client checks the
// door with its live position, the server only knows the last one it was sent (up to ~100 ms old).
const TRAVEL_REACH = 16;

const mapOf = (id) => MAPS.maps[id] || null;
function spawnOf(mapId, spawnId) {
  const map = mapOf(mapId);
  const p = map.spawns[spawnId] || map.spawns[map.defaultSpawn];
  return { x: p.x, y: p.y };
}

// Everything a player may say: the fixed phrase ids and emoji ids (no free text, see plazaPhrases.json).
const SAYABLE = new Set([...PHRASES.phrases, ...Object.keys(PHRASES.emojis)]);

const DIRS = ['down', 'up', 'right', 'left'];
const round1 = (n) => Math.round(n * 10) / 10;

class PlazaRoom {
  /**
   * @param {object} opts
   * @param {() => number} [opts.now] clock in ms (injectable for tests)
   * @param {number} [opts.speedSlack] how much faster than walking a reported move may be (network jitter)
   * @param {number} [opts.minIntervalMs] moves closer together than this are dropped (flood protection)
   */
  constructor({ now = () => Date.now(), speedSlack = 1.6, minIntervalMs = 50 } = {}) {
    this.now = now;
    this.speedSlack = speedSlack;
    this.minIntervalMs = minIntervalMs;
    this.players = new Map();
  }

  /**
   * Adds (or refreshes, on reconnect) a player. `user` = { id, username, avatar_config }. `map` / `spawn` say where
   * the client starts (e.g. back in the market after a visit to the site): only known maps and their spawn points
   * are accepted, anything else means the plaza start point. A reconnect in the same map keeps the position.
   */
  join(user, { visible = true, map = 'plaza', spawn = null } = {}) {
    const existing = this.players.get(user.id);
    const mapId = mapOf(map) ? map : 'plaza';
    const keep = existing && existing.map === mapId;
    const at = keep ? { x: existing.x, y: existing.y } : spawnOf(mapId, spawn);
    const p = {
      id: user.id,
      username: String(user.username || '').slice(0, 40),
      avatar: normalizeAvatarConfig(user.avatar_config) || defaultAvatarConfig(),
      map: mapId,
      x: at.x,
      y: at.y,
      d: keep ? existing.d : 'down',
      m: false,
      visible: Boolean(visible),
      lastMoveAt: this.now(),
      lastSayAt: existing ? existing.lastSayAt : -Infinity,
      dirty: false,
    };
    this.players.set(user.id, p);
    return p;
  }

  /** Removes a player; returns true when they were visible (others must be told). */
  leave(id) {
    const p = this.players.get(id);
    if (!p) return false;
    this.players.delete(id);
    return p.visible;
  }

  get(id) {
    return this.players.get(id) || null;
  }

  /** What other clients get to know about a player. */
  publicView(p) {
    return { id: p.id, u: p.username, a: p.avatar, x: p.x, y: p.y, d: p.d, m: p.m };
  }

  /** Turns visibility on/off. Returns { changed, visible }. */
  setVisible(id, visible) {
    const p = this.players.get(id);
    if (!p) return { changed: false, visible: false };
    const v = Boolean(visible);
    const changed = p.visible !== v;
    p.visible = v;
    p.dirty = false;
    return { changed, visible: v };
  }

  /**
   * Applies a reported move { x, y, d, m }. Returns:
   *  - 'ok'        accepted (position clamped into the world)
   *  - 'ignored'   malformed, unknown player or too soon after the previous move (flood)
   *  - 'rejected'  farther than walking could have got in the elapsed time (teleport / speed hack):
   *                the server keeps the old position and the caller should send it back as a correction
   */
  move(id, msg) {
    const p = this.players.get(id);
    if (!p || !msg || typeof msg !== 'object') return 'ignored';
    const { x, y, d, m } = msg;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !DIRS.includes(d)) return 'ignored';
    const now = this.now();
    const elapsed = now - p.lastMoveAt;
    if (elapsed < this.minIntervalMs) return 'ignored';

    const size = mapOf(p.map);
    const nx = Math.min(size.w, Math.max(0, x));
    const ny = Math.min(size.h, Math.max(0, y));
    const maxDist = WORLD.walkSpeed * (elapsed / 1000) * this.speedSlack + 6;
    if (Math.hypot(nx - p.x, ny - p.y) > maxDist) return 'rejected';

    p.x = round1(nx);
    p.y = round1(ny);
    p.d = d;
    p.m = Boolean(m);
    p.lastMoveAt = now;
    if (p.visible) p.dirty = true;
    return 'ok';
  }

  /**
   * A player walks through a door into another map. Accepted only when a link goes from their map to `to` and
   * their last known position is at that link's door; they then appear at the link's spawn point.
   * Returns { from, to } when accepted, null otherwise (the caller sends the current position back).
   */
  travel(id, to) {
    const p = this.players.get(id);
    if (!p || typeof to !== 'string') return null;
    const link = MAPS.links.find((l) => l.from === p.map && l.to === to && (
      p.x >= l.door.x - TRAVEL_REACH && p.x <= l.door.x + l.door.w + TRAVEL_REACH
      && p.y >= l.door.y - TRAVEL_REACH && p.y <= l.door.y + l.door.h + TRAVEL_REACH
    ));
    if (!link) return null;
    const from = p.map;
    const at = spawnOf(link.to, link.spawn);
    p.map = link.to;
    p.x = at.x;
    p.y = at.y;
    p.m = false;
    p.dirty = false;
    p.lastMoveAt = this.now();
    return { from, to: link.to };
  }

  /**
   * A player says one of the fixed phrases/emojis. Returns:
   *  - 'ok'        accepted: broadcast it
   *  - 'ignored'   unknown phrase, unknown player, or a hidden player (speaking would reveal them)
   *  - 'cooldown'  too soon after their previous message
   */
  say(id, key) {
    if (typeof key !== 'string' || !SAYABLE.has(key)) return 'ignored';
    return this.speak(id);
  }

  /**
   * A player may speak (a fixed phrase, or a typed message that moderation then checks): same answers as say(),
   * one cooldown for both kinds of message.
   */
  speak(id) {
    const p = this.players.get(id);
    if (!p || !p.visible) return 'ignored';
    const now = this.now();
    if (now - p.lastSayAt < PHRASES.cooldownMs) return 'cooldown';
    p.lastSayAt = now;
    return 'ok';
  }

  /** Every visible player except `exceptId` (only those in `map`, when given), as public views. */
  visiblePlayers(exceptId, map) {
    const out = [];
    for (const p of this.players.values()) {
      if (p.visible && p.id !== exceptId && (!map || p.map === map)) out.push(this.publicView(p));
    }
    return out;
  }

  /** Moves of visible players since the last call ({ id, map, x, y, d, m }), clearing them. */
  takeDirtyMoves() {
    const out = [];
    for (const p of this.players.values()) {
      if (!p.dirty) continue;
      p.dirty = false;
      if (p.visible) out.push({ id: p.id, map: p.map, x: p.x, y: p.y, d: p.d, m: p.m });
    }
    return out;
  }

  visibleCount(map) {
    let n = 0;
    for (const p of this.players.values()) if (p.visible && (!map || p.map === map)) n++;
    return n;
  }
}

module.exports = { PlazaRoom, PLAZA_DIRS: DIRS, PLAZA_WORLD: WORLD, PLAZA_PHRASES: PHRASES, PLAZA_MAPS: MAPS, PLAZA_TRAVEL_REACH: TRAVEL_REACH };
