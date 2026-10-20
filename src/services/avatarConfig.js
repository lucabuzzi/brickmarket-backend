// Validation of the CardBrix game avatar. Version 2 (current): a "look" (one of the character sheets) plus one
// small integer per recolourable part (0 = as drawn). The look list and the option counts live in
// client/src/config/avatarSpec.json so the creator and this server agree on what is valid. Anything out of
// range / of the wrong type is rejected, never coerced, and unknown keys are dropped so the JSONB column can't
// be used to store arbitrary data. Version 1 (the first, code-drawn character) is still accepted and converted.
const SPEC = require('../../client/src/config/avatarSpec.json');

const LOOKS = SPEC.looks;
const COLOR_PARTS = ['skin', 'hairColor', 'outfitColor', 'accentColor', 'legsColor'];

// The first version of the avatar had these option counts (see git history): kept only to read old rows.
const V1_SPEC = { skin: 6, hairStyle: 6, hairColor: 8, outfit: 6, outfitColor: 8, accessory: 6 };

/** The avatar a brand-new player starts from: first look, everything as drawn. */
function defaultAvatarConfig() {
  return { v: 2, look: LOOKS[0], ...Object.fromEntries(COLOR_PARTS.map((p) => [p, 0])) };
}

function fromV1(obj) {
  for (const [part, count] of Object.entries(V1_SPEC)) {
    const v = obj[part];
    if (!Number.isInteger(v) || v < 0 || v >= count) return null;
  }
  // v1 colour 0 was the first swatch; in v2 index 0 means "as drawn", so the swatches shift by one.
  return { v: 2, look: LOOKS[0], skin: obj.skin + 1, hairColor: obj.hairColor + 1, outfitColor: obj.outfitColor + 1, accentColor: 0, legsColor: 0 };
}

/**
 * Returns the normalised v2 config, or null when `input` isn't a valid avatar. `input` may be an object or a
 * JSON string (multipart forms send strings). Legacy v1 objects (no `v`) are converted.
 */
function normalizeAvatarConfig(input) {
  let obj = input;
  if (typeof input === 'string') {
    if (input.length > 500) return null;
    try { obj = JSON.parse(input); } catch (_) { return null; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  if (obj.v === undefined) return fromV1(obj);
  if (obj.v !== 2 || !LOOKS.includes(obj.look)) return null;

  const out = { v: 2, look: obj.look };
  for (const part of COLOR_PARTS) {
    const val = obj[part];
    if (!Number.isInteger(val) || val < 0 || val >= SPEC[part]) return null;
    out[part] = val;
  }
  return out;
}

module.exports = { AVATAR_LOOKS: LOOKS, AVATAR_COLOR_PARTS: COLOR_PARTS, AVATAR_SPEC: SPEC, defaultAvatarConfig, normalizeAvatarConfig };
