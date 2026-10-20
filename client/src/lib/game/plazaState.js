// Client side of the game plaza: the list of OTHER players built from the server messages (see
// src/services/gamePlazaSocket.js for the protocol) and the smoothing that makes them walk instead of jumping
// between the 10-per-second updates. Pure, unit-tested in tests/game-plaza-client.test.js.
import WORLD from '../../config/gameWorld.json';

export const MAX_REMOTE_PLAYERS = 40; // more than this would slow phones down: the nearest ones are shown
const DIRS = ['down', 'up', 'right', 'left'];

export function emptyPlaza() {
  return { you: null, players: {} };
}

const sane = (p) => p && typeof p.id === 'string' && Number.isFinite(p.x) && Number.isFinite(p.y);

/** Applies one server message; returns a NEW state (the input is never mutated). Unknown messages: same state. */
export function applyPlazaMessage(state, msg) {
  if (!msg || typeof msg !== 'object') return state;
  switch (msg.t) {
    case 'welcome': {
      const players = {};
      for (const p of Array.isArray(msg.players) ? msg.players : []) {
        if (sane(p) && p.id !== msg.you) players[p.id] = { ...p, tx: p.x, ty: p.y };
      }
      return { you: msg.you, players };
    }
    case 'join': {
      const p = msg.p;
      if (!sane(p) || p.id === state.you) return state;
      const prev = state.players[p.id];
      return { ...state, players: { ...state.players, [p.id]: { ...p, x: prev ? prev.x : p.x, y: prev ? prev.y : p.y, tx: p.x, ty: p.y } } };
    }
    case 'leave': {
      if (!state.players[msg.id]) return state;
      const players = { ...state.players };
      delete players[msg.id];
      return { ...state, players };
    }
    case 'moves': {
      if (!Array.isArray(msg.list)) return state;
      let players = state.players;
      for (const mv of msg.list) {
        const p = players[mv && mv.id];
        if (!p || !Number.isFinite(mv.x) || !Number.isFinite(mv.y)) continue;
        if (players === state.players) players = { ...state.players };
        players[mv.id] = { ...p, tx: mv.x, ty: mv.y, d: DIRS.includes(mv.d) ? mv.d : p.d, m: Boolean(mv.m) };
      }
      return players === state.players ? state : { ...state, players };
    }
    default:
      return state;
  }
}

/**
 * One frame of smoothing: moves (x, y) toward (tx, ty) a bit faster than walking, so a remote player catches up
 * with the latest update without ever overshooting; very far targets (reconnect, correction) snap.
 */
export function approach(p, dt) {
  const dx = p.tx - p.x;
  const dy = p.ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.01) return { x: p.tx, y: p.ty, moving: false };
  if (dist > 80) return { x: p.tx, y: p.ty, moving: false };
  const step = Math.min(dist, WORLD.walkSpeed * 1.6 * dt);
  return { x: p.x + (dx / dist) * step, y: p.y + (dy / dist) * step, moving: true };
}

/** The ids of the `limit` players closest to `me` ({ x, y }). */
export function nearestIds(players, me, limit = MAX_REMOTE_PLAYERS) {
  return Object.values(players)
    .map((p) => ({ id: p.id, d: Math.hypot(p.x - me.x, p.y - me.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((p) => p.id);
}

/** Small time-based throttle for outgoing moves: send at most every `ms`, but always send the stop. */
export function shouldSendMove(last, next, now, ms = 100) {
  if (!last) return true;
  if (last.m && !next.m) return true; // stopped walking: tell the others right away
  if (now - last.at < ms) return false;
  return last.x !== next.x || last.y !== next.y || last.d !== next.d || last.m !== next.m;
}
