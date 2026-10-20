// Client-side plaza state (client/src/lib/game/plazaState.js): building the list of other players from the
// server messages, smoothing their walk, picking the nearest ones and throttling our own updates.
const {
  MAX_REMOTE_PLAYERS, emptyPlaza, applyPlazaMessage, approach, nearestIds, shouldSendMove,
} = require('../client/src/lib/game/plazaState');

const p = (id, x = 100, y = 100) => ({ id, u: `u_${id}`, a: { v: 2, look: 'uomo_base' }, x, y, d: 'down', m: false });

describe('applyPlazaMessage', () => {
  test('welcome replaces everything and never lists myself', () => {
    const s = applyPlazaMessage(emptyPlaza(), { t: 'welcome', you: 'me', players: [p('a'), p('me'), { id: 'bad' }] });
    expect(s.you).toBe('me');
    expect(Object.keys(s.players)).toEqual(['a']);
    expect(s.players.a).toMatchObject({ tx: 100, ty: 100 });
  });

  test('join adds a player, a second join (reconnect) keeps the drawn position and sets the new target', () => {
    let s = applyPlazaMessage(emptyPlaza(), { t: 'welcome', you: 'me', players: [] });
    s = applyPlazaMessage(s, { t: 'join', p: p('a', 50, 60) });
    expect(s.players.a).toMatchObject({ x: 50, y: 60 });
    s = applyPlazaMessage(s, { t: 'join', p: p('a', 70, 60) });
    expect(s.players.a).toMatchObject({ x: 50, tx: 70 });
  });

  test('join of myself is ignored', () => {
    const s0 = applyPlazaMessage(emptyPlaza(), { t: 'welcome', you: 'me', players: [] });
    expect(applyPlazaMessage(s0, { t: 'join', p: p('me') })).toBe(s0);
  });

  test('moves only update targets of known players, and are immutable', () => {
    const s0 = applyPlazaMessage(emptyPlaza(), { t: 'welcome', you: 'me', players: [p('a')] });
    const s1 = applyPlazaMessage(s0, { t: 'moves', list: [{ id: 'a', x: 110, y: 100, d: 'right', m: true }, { id: 'ghost', x: 1, y: 1 }] });
    expect(s1.players.a).toMatchObject({ x: 100, tx: 110, d: 'right', m: true });
    expect(s0.players.a.tx).toBe(100);
    expect(s1.players.ghost).toBeUndefined();
  });

  test('a bad direction keeps the previous one; garbage lists are ignored', () => {
    const s0 = applyPlazaMessage(emptyPlaza(), { t: 'welcome', you: 'me', players: [p('a')] });
    expect(applyPlazaMessage(s0, { t: 'moves', list: [{ id: 'a', x: 101, y: 100, d: 'sideways' }] }).players.a.d).toBe('down');
    expect(applyPlazaMessage(s0, { t: 'moves', list: 'nope' })).toBe(s0);
    expect(applyPlazaMessage(s0, null)).toBe(s0);
    expect(applyPlazaMessage(s0, { t: 'whatever' })).toBe(s0);
  });

  test('leave removes the player', () => {
    const s0 = applyPlazaMessage(emptyPlaza(), { t: 'welcome', you: 'me', players: [p('a'), p('b')] });
    expect(Object.keys(applyPlazaMessage(s0, { t: 'leave', id: 'a' }).players)).toEqual(['b']);
    expect(applyPlazaMessage(s0, { t: 'leave', id: 'zzz' })).toBe(s0);
  });
});

describe('approach', () => {
  test('walks toward the target without overshooting, then stops', () => {
    let cur = { x: 0, y: 0, tx: 20, ty: 0 };
    let frames = 0;
    let r;
    do {
      r = approach(cur, 1 / 60);
      expect(r.x).toBeLessThanOrEqual(20);
      cur = { ...cur, x: r.x, y: r.y };
      frames++;
    } while (r.moving && frames < 500);
    expect(cur.x).toBeCloseTo(20, 5);
  });

  test('a far target (reconnect / correction) snaps', () => {
    expect(approach({ x: 0, y: 0, tx: 300, ty: 0 }, 1 / 60)).toEqual({ x: 300, y: 0, moving: false });
  });
});

describe('nearestIds', () => {
  test('keeps the closest players, up to the limit', () => {
    const players = { a: p('a', 0, 0), b: p('b', 10, 0), c: p('c', 500, 0) };
    expect(nearestIds(players, { x: 9, y: 0 }, 2)).toEqual(['b', 'a']);
    expect(MAX_REMOTE_PLAYERS).toBeGreaterThan(10);
  });
});

describe('shouldSendMove', () => {
  const at = (x, m, t, d = 'right') => ({ x, y: 0, d, m, at: t });
  test('first move, stop, and throttled changes', () => {
    expect(shouldSendMove(null, at(1, true, 0), 0)).toBe(true);
    expect(shouldSendMove(at(1, true, 0), at(2, true, 50), 50)).toBe(false); // too soon
    expect(shouldSendMove(at(1, true, 0), at(2, true, 120), 120)).toBe(true);
    expect(shouldSendMove(at(1, true, 0), at(1, false, 10), 10)).toBe(true); // stop goes out immediately
    expect(shouldSendMove(at(1, false, 0), at(1, false, 500), 500)).toBe(false); // nothing changed
  });
});
