// The game plaza state (src/services/gamePlaza.js): joining, visibility, move validation (bounds, speed, flood)
// and what other players are allowed to learn. Pure, with an injected clock.
const { PlazaRoom, PLAZA_WORLD } = require('../src/services/gamePlaza');

function setup() {
  let t = 1000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const room = new PlazaRoom({ now: clock.now });
  return { room, clock };
}
const user = (id, extra = {}) => ({ id, username: `user_${id}`, avatar_config: { v: 2, look: 'donna_base', skin: 1, hairColor: 2, outfitColor: 3, accentColor: 4, legsColor: 5 }, email: 'secret@example.com', ...extra });

describe('join / leave', () => {
  test('a player joins at the spawn point, visible by default', () => {
    const { room } = setup();
    const p = room.join(user('a'));
    expect([p.x, p.y]).toEqual([PLAZA_WORLD.spawn.x, PLAZA_WORLD.spawn.y]);
    expect(p.visible).toBe(true);
    expect(room.visibleCount()).toBe(1);
  });

  test('others only learn username, character and position (no e-mail or other fields)', () => {
    const { room } = setup();
    room.join(user('a'));
    const view = room.visiblePlayers('someone-else')[0];
    expect(Object.keys(view).sort()).toEqual(['a', 'd', 'id', 'm', 'u', 'x', 'y']);
    expect(view.u).toBe('user_a');
    expect(JSON.stringify(view)).not.toContain('secret@example.com');
  });

  test('a broken or missing character falls back to the default one', () => {
    const { room } = setup();
    expect(room.join(user('a', { avatar_config: null })).avatar.look).toBe('uomo_base');
    expect(room.join(user('b', { avatar_config: { v: 2, look: 'hacker' } })).avatar.look).toBe('uomo_base');
  });

  test('legacy (v1) characters are converted', () => {
    const { room } = setup();
    const p = room.join(user('a', { avatar_config: { skin: 1, hairStyle: 0, hairColor: 2, outfit: 3, outfitColor: 4, accessory: 0 } }));
    expect(p.avatar.v).toBe(2);
  });

  test('a reconnect keeps the position', () => {
    const { room, clock } = setup();
    room.join(user('a'));
    clock.advance(500);
    room.move('a', { x: PLAZA_WORLD.spawn.x + 10, y: PLAZA_WORLD.spawn.y, d: 'right', m: true });
    const again = room.join(user('a'));
    expect(again.x).toBe(PLAZA_WORLD.spawn.x + 10);
  });

  test('leave reports whether the player was visible', () => {
    const { room } = setup();
    room.join(user('a'));
    room.join(user('b'), { visible: false });
    expect(room.leave('a')).toBe(true);
    expect(room.leave('b')).toBe(false);
    expect(room.leave('nobody')).toBe(false);
  });

  test('usernames are capped', () => {
    const { room } = setup();
    expect(room.join(user('a', { username: 'x'.repeat(200) })).username).toHaveLength(40);
  });
});

describe('visibility', () => {
  test('hidden players are never listed nor broadcast', () => {
    const { room, clock } = setup();
    room.join(user('a'), { visible: false });
    room.join(user('b'));
    expect(room.visiblePlayers('b')).toEqual([]);
    clock.advance(200);
    expect(room.move('a', { x: PLAZA_WORLD.spawn.x + 5, y: PLAZA_WORLD.spawn.y, d: 'right', m: true })).toBe('ok');
    expect(room.takeDirtyMoves()).toEqual([]);
  });

  test('setVisible reports changes only', () => {
    const { room } = setup();
    room.join(user('a'));
    expect(room.setVisible('a', true)).toEqual({ changed: false, visible: true });
    expect(room.setVisible('a', false)).toEqual({ changed: true, visible: false });
    expect(room.setVisible('nobody', true)).toEqual({ changed: false, visible: false });
  });
});

describe('move validation', () => {
  test('a normal step is accepted and batched once', () => {
    const { room, clock } = setup();
    room.join(user('a'));
    clock.advance(100);
    expect(room.move('a', { x: PLAZA_WORLD.spawn.x + 5, y: PLAZA_WORLD.spawn.y, d: 'right', m: true })).toBe('ok');
    expect(room.takeDirtyMoves()).toEqual([{ id: 'a', x: PLAZA_WORLD.spawn.x + 5, y: PLAZA_WORLD.spawn.y, d: 'right', m: true }]);
    expect(room.takeDirtyMoves()).toEqual([]);
  });

  test('a teleport (too far for the elapsed time) is rejected and the position is kept', () => {
    const { room, clock } = setup();
    room.join(user('a'));
    clock.advance(100);
    expect(room.move('a', { x: 20, y: 20, d: 'up', m: true })).toBe('rejected');
    expect([room.get('a').x, room.get('a').y]).toEqual([PLAZA_WORLD.spawn.x, PLAZA_WORLD.spawn.y]);
  });

  test('after a long pause a long move is fine (the player was walking meanwhile)', () => {
    const { room, clock } = setup();
    room.join(user('a'));
    clock.advance(5000);
    expect(room.move('a', { x: PLAZA_WORLD.spawn.x - 200, y: PLAZA_WORLD.spawn.y - 100, d: 'up', m: false })).toBe('ok');
  });

  test('flooding (moves faster than the minimum interval) is dropped', () => {
    const { room, clock } = setup();
    room.join(user('a'));
    clock.advance(10);
    expect(room.move('a', { x: PLAZA_WORLD.spawn.x + 0.5, y: PLAZA_WORLD.spawn.y, d: 'right', m: true })).toBe('ignored');
  });

  test('positions are clamped into the world', () => {
    const { room, clock } = setup();
    room.join(user('a'));
    clock.advance(60000);
    room.move('a', { x: -50, y: 99999, d: 'down', m: false });
    expect([room.get('a').x, room.get('a').y]).toEqual([0, PLAZA_WORLD.h]);
  });

  test.each([
    ['NaN coordinates', { x: NaN, y: 10, d: 'down' }],
    ['string coordinates', { x: '10', y: 10, d: 'down' }],
    ['unknown direction', { x: 10, y: 10, d: 'diagonal' }],
    ['no message', null],
  ])('ignores %s', (_label, msg) => {
    const { room, clock } = setup();
    room.join(user('a'));
    clock.advance(1000);
    expect(room.move('a', msg)).toBe('ignored');
  });

  test('moves of unknown players are ignored', () => {
    const { room } = setup();
    expect(room.move('ghost', { x: 1, y: 1, d: 'down' })).toBe('ignored');
  });
});
