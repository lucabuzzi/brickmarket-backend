// Validation of the CardBrix game avatar. Version 2 (current): a "look" (one of the character sheets) plus one
// small integer per recolourable part (0 = as drawn). The playable looks and the option counts live in
// client/src/config/avatarSpec.json, which parts each character can recolour in gameCharacters.json, so the
// creator (client/src/lib/game/characters.js + skins.js) and this server agree on what is valid. Anything out of
// range / of the wrong type is rejected, never coerced, and unknown keys are dropped so the JSONB column can't
// be used to store arbitrary data. Converted, not lost: version 1 (the first, code-drawn character) and the
// legacy looks once the character that replaced them is playable.
const SPEC = require('../../client/src/config/avatarSpec.json');
const CHARS = require('../../client/src/config/gameCharacters.json');

const LOOKS = SPEC.looks;
// look -> parts it cannot recolour (always 0); legacy looks recolour everything
const DISABLED = Object.fromEntries(CHARS.characters.map((c) => [c.id, Object.keys(c.regions).filter((p) => !c.regions[p])]));
const REPLACED_BY = Object.fromEntries(CHARS.legacyLooks.map((l) => [l.id, l.replacedBy]));
const COLOR_PARTS = ['skin', 'hairColor', 'outfitColor', 'accentColor', 'legsColor'];

// The first version of the avatar had these option counts (see git history): kept only to read old rows.
const V1_SPEC = { skin: 6, hairStyle: 6, hairColor: 8, outfit: 6, outfitColor: 8, accessory: 6 };

/** The avatar a brand-new player starts from: first look, everything as drawn. */
function defaultAvatarConfig() {
  return { v: 2, look: LOOKS[0], ...Object.fromEntries(COLOR_PARTS.map((p) => [p, 0])) };
}

/** Sets to 0 ("as drawn") the parts `cfg.look` cannot recolour. */
function zeroDisabled(cfg) {
  for (const p of DISABLED[cfg.look] || []) cfg[p] = 0;
  return cfg;
}

function fromV1(obj) {
  for (const [part, count] of Object.entries(V1_SPEC)) {
    const v = obj[part];
    if (!Number.isInteger(v) || v < 0 || v >= count) return null;
  }
  // v1 colour 0 was the first swatch; in v2 index 0 means "as drawn", so the swatches shift by one.
  return zeroDisabled({ v: 2, look: LOOKS[0], skin: obj.skin + 1, hairColor: obj.hairColor + 1, outfitColor: obj.outfitColor + 1, accentColor: 0, legsColor: 0 });
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
  if (obj.v !== 2) return null;
  let look = obj.look;
  let converted = false;
  if (!LOOKS.includes(look)) {
    // a retired legacy look becomes the character that replaced it (keeping the colours it can use)
    const to = REPLACED_BY[look];
    if (!to || !LOOKS.includes(to)) return null;
    look = to;
    converted = true;
  }

  const out = { v: 2, look };
  for (const part of COLOR_PARTS) {
    const val = obj[part];
    if (!Number.isInteger(val) || val < 0 || val >= SPEC[part]) return null;
    out[part] = val;
  }
  if (converted) return zeroDisabled(out);
  // a part this character cannot recolour must stay "as drawn" (the creator never sends anything else)
  if ((DISABLED[look] || []).some((p) => out[p] !== 0)) return null;
  return out;
}

module.exports = { AVATAR_LOOKS: LOOKS, AVATAR_COLOR_PARTS: COLOR_PARTS, AVATAR_SPEC: SPEC, defaultAvatarConfig, normalizeAvatarConfig };
