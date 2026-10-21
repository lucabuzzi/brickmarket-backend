// The on-screen virtual joystick of the game (client/src/game/components/VirtualJoystick.jsx), kept free of any
// DOM code so it is unit-testable (tests/game-joystick.test.js). The base stays put; the knob follows the finger
// inside the ring, and how far it is pushed sets the walking speed.

/** Share of the radius around the centre where a touch does not move the character. */
export const DEAD_ZONE = 0.15;

/**
 * Finger offset (dx, dy) from the centre of the base, in px, with the knob travel `radius` →
 * `{ x, y }` walking vector (length 0..1, any angle; 0 inside the dead zone, 1 at the rim and beyond) and
 * `{ knobX, knobY }` where to draw the knob (the finger, clamped to the ring).
 */
export function stickVector(dx, dy, radius, deadZone = DEAD_ZONE) {
  const d = Math.hypot(dx, dy);
  if (!(d > 0) || !(radius > 0)) return { x: 0, y: 0, knobX: 0, knobY: 0 };
  const ux = dx / d;
  const uy = dy / d;
  const reach = Math.min(d, radius);
  const push = reach / radius;
  const mag = push <= deadZone ? 0 : (push - deadZone) / (1 - deadZone);
  return { x: ux * mag, y: uy * mag, knobX: ux * reach, knobY: uy * reach };
}

/** A stick vector as the scene takes it: finite numbers, length never above 1 (never faster than walking). */
export function clampStick(v) {
  const x = Number(v && v.x) || 0;
  const y = Number(v && v.y) || 0;
  const len = Math.hypot(x, y);
  if (!Number.isFinite(len) || len === 0) return { x: 0, y: 0 };
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}
