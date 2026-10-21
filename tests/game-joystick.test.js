// The on-screen virtual joystick of the game (client/src/lib/game/joystick.js): any direction, speed proportional
// to how far the knob is pushed, a dead zone at the centre, the knob kept inside the ring and never faster than walking.
const { stickVector, clampStick, DEAD_ZONE } = require('../client/src/lib/game/joystick');

const len = (v) => Math.hypot(v.x, v.y);

test('the centre and the dead zone do not move the character', () => {
  expect(stickVector(0, 0, 40)).toEqual({ x: 0, y: 0, knobX: 0, knobY: 0 });
  const v = stickVector(40 * DEAD_ZONE, 0, 40);
  expect(len(v)).toBe(0);
  expect(v.knobX).toBeCloseTo(6); // the knob still follows the finger
  expect(stickVector(10, 10, 0)).toEqual({ x: 0, y: 0, knobX: 0, knobY: 0 });
  expect(stickVector(NaN, 3, 40)).toEqual({ x: 0, y: 0, knobX: 0, knobY: 0 });
});

test('speed grows with the push and is full at the rim', () => {
  const half = stickVector(0, -20, 40);
  expect(half.x).toBeCloseTo(0);
  expect(half.y).toBeCloseTo(-(0.5 - DEAD_ZONE) / (1 - DEAD_ZONE));
  const rim = stickVector(-40, 0, 40);
  expect(rim.x).toBeCloseTo(-1);
  expect(len(stickVector(-30, 0, 40))).toBeGreaterThan(len(half));
  expect(len(stickVector(-30, 0, 40))).toBeLessThan(len(rim));
});

test('beyond the ring: full speed in the finger direction, knob stopped on the rim', () => {
  const v = stickVector(300, 400, 40);
  expect(len(v)).toBeCloseTo(1);
  expect(v.x).toBeCloseTo(0.6);
  expect(v.y).toBeCloseTo(0.8);
  expect(Math.hypot(v.knobX, v.knobY)).toBeCloseTo(40);
});

test('any angle, not only eight directions', () => {
  const a = stickVector(Math.cos(0.3) * 40, Math.sin(0.3) * 40, 40);
  expect(Math.atan2(a.y, a.x)).toBeCloseTo(0.3);
  expect(len(a)).toBeCloseTo(1);
});

test('the scene never walks faster than the walking speed', () => {
  expect(clampStick({ x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 });
  expect(clampStick({ x: 0.2, y: -0.1 })).toEqual({ x: 0.2, y: -0.1 });
  expect(clampStick(null)).toEqual({ x: 0, y: 0 });
  expect(clampStick({ x: 'a', y: Infinity })).toEqual({ x: 0, y: 0 });
});
