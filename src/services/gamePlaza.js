// The plaza of "CardBrix the game": who is in it, where they stand, and whether a move they report is possible.
// Pure (no sockets, no DB, injectable clock), unit-tested in tests/game-plaza.test.js; the WebSocket wiring is
// in gamePlazaSocket.js. Players are shown only by username and character (never e-mail or any other data),
// and a player who switched "visible in the plaza" off is never sent to anyone.
//
// State lives in this process's memory: fine while the backend runs as a single instance (Render today). With
// several instances the plaza would need a shared store (e.g. Redis pub/sub).
const WORLD = require('../../client/src/config/gameWorld.json');
const { normalizeAvatarConfig, defaultAvatarConfig } = require('./avatarConfig');
const PHRASES = require('../../client/src/config/plazaPhrases.json');

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

  /** Adds (or refreshes, on reconnect) a player at the spawn point. `user` = { id, username, avatar_config }. */
  join(user, { visible = true } = {}) {
    const existing = this.players.get(user.id);
    const p = {
      id: user.id,
      username: String(user.username || '').slice(0, 40),
      avatar: normalizeAvatarConfig(user.avatar_config) || defaultAvatarConfig(),
      x: existing ? existing.x : WORLD.spawn.x,
      y: existing ? existing.y : WORLD.spawn.y,
      d: existing ? existing.d : 'down',
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

    const nx = Math.min(WORLD.w, Math.max(0, x));
    const ny = Math.min(WORLD.h, Math.max(0, y));
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
   * A player says one of the fixed phrases/emojis. Returns:
   *  - 'ok'        accepted: broadcast it
   *  - 'ignored'   unknown phrase, unknown player, or a hidden player (speaking would reveal them)
   *  - 'cooldown'  too soon after their previous message
   */
  say(id, key) {
    const p = this.players.get(id);
    if (!p || !p.visible || typeof key !== 'string' || !SAYABLE.has(key)) return 'ignored';
    const now = this.now();
    if (now - p.lastSayAt < PHRASES.cooldownMs) return 'cooldown';
    p.lastSayAt = now;
    return 'ok';
  }

  /** Every visible player except `exceptId`, as public views. */
  visiblePlayers(exceptId) {
    const out = [];
    for (const p of this.players.values()) if (p.visible && p.id !== exceptId) out.push(this.publicView(p));
    return out;
  }

  /** Moves of visible players since the last call ({ id, x, y, d, m }), clearing them. */
  takeDirtyMoves() {
    const out = [];
    for (const p of this.players.values()) {
      if (!p.dirty) continue;
      p.dirty = false;
      if (p.visible) out.push({ id: p.id, x: p.x, y: p.y, d: p.d, m: p.m });
    }
    return out;
  }

  visibleCount() {
    let n = 0;
    for (const p of this.players.values()) if (p.visible) n++;
    return n;
  }
}

module.exports = { PlazaRoom, PLAZA_DIRS: DIRS, PLAZA_WORLD: WORLD, PLAZA_PHRASES: PHRASES };
