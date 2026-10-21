// "CardBrix the game" characters: the catalogue of looks (character sheets drawn as pixel art, one per look),
// the colour palettes the player can apply, and the pure maths that recolours a sheet. No image loading here
// (game/skinLoader.js does that), so everything is unit-tested in tests/game-skins.test.js.
//
// A sheet has 4 rows (down, up, right, left) x 4 walk-frame columns of 48x56 pixels, built by
// scripts/build-game-skins.js, which also writes a mask: each pixel's R value is the colour region it belongs to.
import SPEC from '../../config/avatarSpec.json';
import { resolveLook, isPartEnabled, AVAILABLE_LOOKS } from './characters';

export const FRAME = { w: 48, h: 56 };
export const COLS = 4;
export const ROWS = ['down', 'up', 'right', 'left'];
export const IDLE_COL = { down: 1, up: 0, right: 1, left: 1 };

/** The looks a player can pick (built sheets, see characters.js). All free. */
export const LOOKS = AVAILABLE_LOOKS.map((id) => ({ id, access: 'free' }));

// Index 0 of every list is "as drawn" (no recolouring), so the originals are always one tap away. New colours
// are only ever appended: saved avatars store the index, so reordering would change how they look.
export const PALETTES = {
  skin: [null, '#ffdbb4', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'],
  hairColor: [null, '#1b1b1f', '#4a2c17', '#8b5a2b', '#d9a441', '#c0392b', '#e8e8e8', '#3b82f6', '#a855f7'],
  // Gold is reserved for the site chrome (see CLAUDE.md colour system), so no gold among the outfit colours.
  outfitColor: [null, '#c6ff3d', '#ff5a36', '#8b5cf6', '#22d3ee', '#3b82f6', '#f1f5f9', '#374151', '#f472b6', '#ef4444', '#1e3a8a', '#4c1d95', '#4d7c0f'],
  accentColor: [null, '#ff8a2a', '#ffe14d', '#22d3ee', '#c6ff3d', '#ff5a36', '#f472b6', '#8b5cf6', '#f1f5f9', '#dc2626', '#38bdf8'],
  legsColor: [null, '#7a4a22', '#374151', '#1f2a44', '#4b5320', '#8b1e2d', '#6b7280', '#c2b280', '#111827'],
};
export const COLOR_PARTS = Object.keys(PALETTES);

// Which mask value (region) each colour part recolours.
export const REGION_OF = { skin: 1, hairColor: 2, outfitColor: 3, accentColor: 4, legsColor: 5 };

export function defaultAvatar() {
  return { v: 2, look: LOOKS[0].id, ...Object.fromEntries(COLOR_PARTS.map((p) => [p, 0])) };
}

// Counts of the first (code-drawn) avatar, only to read rows saved before the skins existed.
const V1 = { skin: 6, hairStyle: 6, hairColor: 8, outfit: 6, outfitColor: 8, accessory: 6 };

function fromV1(cfg) {
  for (const [part, count] of Object.entries(V1)) {
    const v = cfg[part];
    if (!Number.isInteger(v) || v < 0 || v >= count) return null;
  }
  return withEnabledParts({ v: 2, look: LOOKS[0].id, skin: cfg.skin + 1, hairColor: cfg.hairColor + 1, outfitColor: cfg.outfitColor + 1, accentColor: 0, legsColor: 0 });
}

/** Parts the look cannot recolour (e.g. the skin of an armoured knight) are always "as drawn". */
function withEnabledParts(avatar) {
  for (const p of COLOR_PARTS) if (!isPartEnabled(avatar.look, p)) avatar[p] = 0;
  return avatar;
}

/** Always returns a full, in-range v2 avatar (null / partial / out-of-range input falls back piece by piece). */
export function sanitizeAvatar(cfg) {
  const out = defaultAvatar();
  if (!cfg || typeof cfg !== 'object') return out;
  if (cfg.v === undefined) return fromV1(cfg) || out;
  const look = resolveLook(cfg.look); // a retired legacy look becomes the character that replaced it
  if (look) out.look = look;
  for (const p of COLOR_PARTS) {
    const v = cfg[p];
    if (Number.isInteger(v) && v >= 0 && v < PALETTES[p].length) out[p] = v;
  }
  return withEnabledParts(out);
}

export function randomAvatar(rand = Math.random) {
  const out = { v: 2, look: LOOKS[Math.floor(rand() * LOOKS.length)].id };
  for (const p of COLOR_PARTS) out[p] = Math.floor(rand() * PALETTES[p].length);
  return withEnabledParts(out);
}

/** Where a frame lives in the sheet. `dir` is 'down' | 'up' | 'right' | 'left'. */
export function frameRect(dir, col) {
  return { x: col * FRAME.w, y: ROWS.indexOf(dir) * FRAME.h, w: FRAME.w, h: FRAME.h };
}

// ── recolouring ────────────────────────────────────────────────────────────────────────────────
function rgbToHsv(r, g, b) {
  const rr = r / 255; const gg = g / 255; const bb = b / 255;
  const mx = Math.max(rr, gg, bb); const mn = Math.min(rr, gg, bb); const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === rr) h = ((gg - bb) / d) % 6;
    else if (mx === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0; let g = 0; let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const hexToHsv = (hex) => rgbToHsv(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
const TARGETS = Object.fromEntries(COLOR_PARTS.map((p) => [p, PALETTES[p].map((hex) => (hex ? hexToHsv(hex) : null))]));
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Returns a copy of `sheet` (RGBA) with each colour region repainted. `mask` holds the region id per pixel
 * (one byte per pixel); `stats[region]` = { sref, vref } is the average saturation/brightness of that region as
 * drawn, so a pixel keeps its shading RELATIVE to the region: a darker shadow pixel stays darker than the
 * lit ones after the recolour. Hue always becomes the chosen colour's hue. Index 0 of a part leaves it as drawn.
 */
export function recolorPixels(sheet, mask, stats, avatar) {
  const out = new Uint8ClampedArray(sheet);
  const byRegion = {};
  for (const part of COLOR_PARTS) {
    const target = TARGETS[part][avatar[part]];
    if (target && stats[REGION_OF[part]]) byRegion[REGION_OF[part]] = target;
  }
  for (let k = 0; k < mask.length; k++) {
    const target = byRegion[mask[k]];
    if (!target) continue;
    const i = k * 4;
    if (!out[i + 3]) continue;
    const { sref, vref } = stats[mask[k]];
    const [, s, v] = rgbToHsv(out[i], out[i + 1], out[i + 2]);
    const [r, g, b] = hsvToRgb(target[0], clamp01(target[1] * (sref ? s / sref : 1)), clamp01(target[2] * (vref ? v / vref : 1)));
    out[i] = r; out[i + 1] = g; out[i + 2] = b;
  }
  return out;
}
