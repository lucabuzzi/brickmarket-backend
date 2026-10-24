// "CardBrix the game": the NPCs (guide, keepers of the buildings, merchants of the market) and the dialogue engine
// they all share. Who stands where and what they say is data (config/gameNpcs.json); this module only reads it,
// so a new merchant or a new line is a config + locale change, not new code. Pure, unit-tested in
// tests/game-npcs.test.js; WorldScreen turns the actions an option returns into panel views or scene moves.
import CONFIG from '../../config/gameNpcs.json';

/** Every action an option may carry, with the fields it needs. */
export const ACTION_TYPES = ['products', 'auctions', 'arena', 'link', 'walk', 'tutorial', 'close', 'sell', 'mylistings'];

export const NPCS = Object.entries(CONFIG.npcs).map(([id, n]) => ({ id, ...n, place: n.place || null }));

export function npcById(id) {
  return NPCS.find((n) => n.id === id) || null;
}

/** The NPC that answers when the player enters `placeId` of `mapId` (keepers and merchants), or null. */
export function npcForPlace(mapId, placeId) {
  return NPCS.find((n) => n.map === mapId && n.place === placeId) || null;
}

/** NPCs drawn in the scene of `mapId` (the dragon is the statue itself, so it has no sprite). */
export function drawnNpcs(mapId) {
  return NPCS.filter((n) => n.map === mapId && n.avatar);
}

// An NPC's body blocks a small strip at its feet, like a player's; its interaction zone surrounds it.
const BODY = { w: 10, h: 4 };
export const NPC_HEIGHT = 26; // world px, about the height of a character drawn at the scene's scale

export function npcBox(n) {
  return { x: n.x - BODY.w / 2, y: n.y - BODY.h, w: BODY.w, h: BODY.h };
}

/** Clickable box of the NPC's sprite (feet at (x, y)). */
export function npcHitBox(n) {
  return { x: n.x - 8, y: n.y - NPC_HEIGHT - 2, w: 16, h: NPC_HEIGHT + 4 };
}

/**
 * NPCs that stand on their own (not at a building) become places of their map: a door zone around them, so the
 * same "stand there and press enter" logic of the buildings applies to talking to them.
 */
export function npcPlaces(mapId) {
  return NPCS.filter((n) => n.map === mapId && !n.place && n.avatar).map((n) => ({
    id: n.id, kind: 'npc', npc: n.id, color: n.color, auraColor: n.color,
    ...npcHitBox(n),
    door: { x: n.x - 14, y: n.y - 10, w: 28, h: 20 },
  }));
}

/** Collision boxes of the NPCs drawn on `mapId`. */
export function npcBlocked(mapId) {
  return drawnNpcs(mapId).map(npcBox);
}

// ── dialogue ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Locale keys of an NPC: name, role and the text of every node. */
export const npcNameKey = (id) => `game.npcs.${id}.name`;
export const npcRoleKey = (id) => `game.npcs.${id}.role`;
export const nodeTextKey = (id, node) => `game.npcs.${id}.${node}`;
export const optionLabelKey = (optionId) => `game.dialog.opt.${optionId}`;

export function startNode(npcId) {
  const n = npcById(npcId);
  return n ? n.dialog.start : null;
}

/** The node `nodeId` of `npcId`'s dialogue: { npc, node, textKey, options: [{ id, labelKey, next?, do? }] }. */
export function dialogNode(npcId, nodeId) {
  const n = npcById(npcId);
  const node = n && n.dialog.nodes[nodeId];
  if (!node) return null;
  return {
    npc: npcId,
    node: nodeId,
    textKey: nodeTextKey(npcId, nodeId),
    options: node.options.map((o) => ({ ...o, labelKey: optionLabelKey(o.id) })),
  };
}

/**
 * What picking `optionId` in `nodeId` does: { type: 'node', node } (the dialogue goes on) or
 * { type: 'action', action } (the panel / scene acts on it). null for an unknown option.
 */
export function chooseOption(npcId, nodeId, optionId) {
  const d = dialogNode(npcId, nodeId);
  const o = d && d.options.find((x) => x.id === optionId);
  if (!o) return null;
  if (o.next) return { type: 'node', node: o.next };
  return { type: 'action', action: o.do };
}

/** Problems of one NPC's dialogue (empty when valid): unknown nodes, actions, missing fields, dead options. */
export function validateDialog(dialog) {
  const errors = [];
  if (!dialog || !dialog.nodes || !dialog.nodes[dialog.start]) return ['missing start node'];
  for (const [nodeId, node] of Object.entries(dialog.nodes)) {
    if (!Array.isArray(node.options) || node.options.length === 0) errors.push(`${nodeId}: no options`);
    const seen = new Set();
    for (const o of node.options || []) {
      if (seen.has(o.id)) errors.push(`${nodeId}: duplicate option ${o.id}`);
      seen.add(o.id);
      if (Boolean(o.next) === Boolean(o.do)) { errors.push(`${nodeId}.${o.id}: needs exactly one of next / do`); continue; }
      if (o.next && !dialog.nodes[o.next]) errors.push(`${nodeId}.${o.id}: unknown node ${o.next}`);
      if (o.do) {
        if (!ACTION_TYPES.includes(o.do.type)) errors.push(`${nodeId}.${o.id}: unknown action ${o.do.type}`);
        if (o.do.type === 'products' && !o.do.query) errors.push(`${nodeId}.${o.id}: products without query`);
        if (o.do.type === 'link' && !(typeof o.do.path === 'string' && o.do.path.startsWith('/'))) errors.push(`${nodeId}.${o.id}: bad link`);
        if (o.do.type === 'walk' && !o.do.place) errors.push(`${nodeId}.${o.id}: walk without place`);
      }
    }
  }
  return errors;
}
