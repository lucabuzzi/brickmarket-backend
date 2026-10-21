// "CardBrix the game" characters: which looks exist (config/gameCharacters.json), which of them are playable
// (built sheets, listed in config/avatarSpec.json `looks`), how they pair up in the creator (one class, a man
// and a woman) and which colour parts each of them can recolour. Pure, unit-tested in tests/game-characters.test.js;
// the server mirrors the same rules in src/services/avatarConfig.js.
import SPEC from '../../config/avatarSpec.json';
import CHARS from '../../config/gameCharacters.json';

export const PARTS = ['skin', 'hairColor', 'outfitColor', 'accentColor', 'legsColor'];

// The first four looks recolour every part, with generic labels.
const LEGACY_LABELS = { skin: 'skin', hairColor: 'hair', outfitColor: 'outfit', accentColor: 'details', legsColor: 'trousers' };

/** id -> { id, pair, gender, legacy, replacedBy, labels: { part: label key | null } } for every known look. */
export const CHARACTER_INFO = Object.fromEntries([
  ...CHARS.characters.map((c) => [c.id, {
    id: c.id, pair: c.pair, gender: c.gender, legacy: false, replacedBy: null,
    labels: Object.fromEntries(PARTS.map((p) => [p, c.regions[p] ? c.regions[p].label : null])),
  }]),
  ...CHARS.legacyLooks.map((l) => [l.id, {
    id: l.id, pair: l.pair, gender: l.gender, legacy: true, replacedBy: l.replacedBy, labels: { ...LEGACY_LABELS },
  }]),
]);

/** The looks a player can pick right now (their sheets are built). */
export const AVAILABLE_LOOKS = SPEC.looks.filter((id) => CHARACTER_INFO[id]);

/** The playable look for `id`: itself, or the character that replaced a retired legacy look; null otherwise. */
export function resolveLook(id) {
  if (AVAILABLE_LOOKS.includes(id)) return id;
  const info = CHARACTER_INFO[id];
  if (info && info.replacedBy && AVAILABLE_LOOKS.includes(info.replacedBy)) return info.replacedBy;
  return null;
}

/** The colour parts `look` can recolour, in display order, with their label keys: [{ part, label }]. */
export function editableParts(look) {
  const info = CHARACTER_INFO[look];
  if (!info) return [];
  return PARTS.filter((p) => info.labels[p]).map((p) => ({ part: p, label: info.labels[p] }));
}

export function isPartEnabled(look, part) {
  const info = CHARACTER_INFO[look];
  return Boolean(info && info.labels[part]);
}

const PAIR_ORDER = [...CHARS.pairs, ...new Set(CHARS.legacyLooks.map((l) => l.pair))];

/**
 * The classes shown in the creator: [{ pair, members: [look ids, man first] }], only those with at least one
 * playable member, new characters before the legacy looks.
 */
export function creatorClasses() {
  return PAIR_ORDER
    .map((pair) => ({
      pair,
      members: AVAILABLE_LOOKS
        .filter((id) => CHARACTER_INFO[id].pair === pair)
        .sort((a, b) => (CHARACTER_INFO[a].gender === 'male' ? 0 : 1) - (CHARACTER_INFO[b].gender === 'male' ? 0 : 1)),
    }))
    .filter((c) => c.members.length);
}

/** The member of `pair` with `gender`, else its first playable member. */
export function memberOf(pair, gender) {
  const cls = creatorClasses().find((c) => c.pair === pair);
  if (!cls) return null;
  return cls.members.find((id) => CHARACTER_INFO[id].gender === gender) || cls.members[0];
}
