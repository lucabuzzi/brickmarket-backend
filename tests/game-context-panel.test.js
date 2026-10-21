// The side panel of the game (client/src/lib/game/contextPanel.js): opening, going deeper, back and close.
const { panelReducer, EMPTY_PANEL, currentView, canGoBack, viewNpc, MAX_DEPTH } = require('../client/src/lib/game/contextPanel');

const dialog = { kind: 'dialog', npc: 'lego_merchant', node: 'hello' };
const goods = { kind: 'goods', npc: 'lego_merchant', query: { product_type: 'lego' } };
const product = { kind: 'product', npc: 'lego_merchant', item: { id: 1 } };

test('starts empty; open shows one view and starts over', () => {
  expect(currentView(EMPTY_PANEL)).toBeNull();
  let s = panelReducer(EMPTY_PANEL, { type: 'open', view: dialog });
  expect(currentView(s)).toBe(dialog);
  expect(canGoBack(s)).toBe(false);
  s = panelReducer(s, { type: 'push', view: goods });
  s = panelReducer(s, { type: 'open', view: { kind: 'player', player: { u: 'ann' } } });
  expect(s.stack).toHaveLength(1);
  expect(currentView(s).kind).toBe('player');
});

test('push goes deeper, back returns, back on the first view does nothing, close empties', () => {
  let s = panelReducer(EMPTY_PANEL, { type: 'open', view: dialog });
  s = panelReducer(s, { type: 'push', view: goods });
  s = panelReducer(s, { type: 'push', view: product });
  expect(currentView(s)).toBe(product);
  expect(canGoBack(s)).toBe(true);
  s = panelReducer(s, { type: 'back' });
  expect(currentView(s)).toBe(goods);
  s = panelReducer(s, { type: 'back' });
  expect(panelReducer(s, { type: 'back' })).toBe(s);
  expect(panelReducer(s, { type: 'close' })).toEqual(EMPTY_PANEL);
  expect(panelReducer(EMPTY_PANEL, { type: 'close' })).toBe(EMPTY_PANEL);
});

test('replace swaps the current line of a dialogue without growing the history', () => {
  let s = panelReducer(EMPTY_PANEL, { type: 'open', view: dialog });
  s = panelReducer(s, { type: 'replace', view: { ...dialog, node: 'how' } });
  expect(s.stack).toHaveLength(1);
  expect(currentView(s).node).toBe('how');
  expect(currentView(panelReducer(EMPTY_PANEL, { type: 'replace', view: dialog }))).toBe(dialog);
});

test('unknown views and actions are ignored; the history is capped', () => {
  const s = panelReducer(EMPTY_PANEL, { type: 'open', view: dialog });
  expect(panelReducer(s, { type: 'push', view: { kind: 'nope' } })).toBe(s);
  expect(panelReducer(s, { type: 'open', view: null })).toBe(s);
  expect(panelReducer(s, { type: 'dance' })).toBe(s);
  let deep = s;
  for (let i = 0; i < 20; i++) deep = panelReducer(deep, { type: 'push', view: { ...product, item: { id: i } } });
  expect(deep.stack).toHaveLength(MAX_DEPTH);
  expect(currentView(deep).item.id).toBe(19);
});

test('viewNpc', () => {
  expect(viewNpc(goods)).toBe('lego_merchant');
  expect(viewNpc({ kind: 'player', player: {} })).toBeNull();
  expect(viewNpc(null)).toBeNull();
});
