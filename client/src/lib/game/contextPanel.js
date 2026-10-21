// "CardBrix the game": what the side panel shows. It reacts to what the player interacts with (an NPC, a goods
// list, a product, another player, the auction board, the arena) and keeps a short history so "back" returns to
// the previous view, like a menu of an RPG. Pure reducer, unit-tested in tests/game-context-panel.test.js.
//
// Views:
//   { kind: 'dialog', npc, node }        a line of an NPC with its answers
//   { kind: 'goods', npc, query }         real listings of a merchant
//   { kind: 'product', item, npc }        one listing, with the link to its real page
//   { kind: 'player', player }            another player's inventory ({ u, a })
//   { kind: 'auctions', npc }             the board of the running auctions
//   { kind: 'arena', npc }                the Skill Zone: challenges, credits, open contests

export const MAX_DEPTH = 8;
export const VIEW_KINDS = ['dialog', 'goods', 'product', 'player', 'auctions', 'arena'];

export const EMPTY_PANEL = { stack: [] };

export function currentView(state) {
  return state.stack.length ? state.stack[state.stack.length - 1] : null;
}

export function canGoBack(state) {
  return state.stack.length > 1;
}

const valid = (view) => Boolean(view && VIEW_KINDS.includes(view.kind));

/**
 * actions: { type: 'open', view } starts over from `view` (a new NPC / player was picked)
 *          { type: 'push', view } goes deeper (a product of a list, the goods of a merchant)
 *          { type: 'replace', view } swaps the current view (the next line of the same dialogue)
 *          { type: 'back' } | { type: 'close' }
 */
export function panelReducer(state, action) {
  switch (action.type) {
    case 'open':
      return valid(action.view) ? { stack: [action.view] } : state;
    case 'push':
      if (!valid(action.view)) return state;
      return { stack: [...state.stack, action.view].slice(-MAX_DEPTH) };
    case 'replace':
      if (!valid(action.view)) return state;
      return { stack: state.stack.length ? [...state.stack.slice(0, -1), action.view] : [action.view] };
    case 'back':
      return state.stack.length > 1 ? { stack: state.stack.slice(0, -1) } : state;
    case 'close':
      return state.stack.length ? EMPTY_PANEL : state;
    default:
      return state;
  }
}

/** The NPC the current view belongs to (for the portrait in the header), or null. */
export function viewNpc(view) {
  return (view && view.npc) || null;
}
