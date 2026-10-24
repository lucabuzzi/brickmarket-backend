// The NPCs of CardBrix the game (client/src/config/gameNpcs.json, client/src/lib/game/npcs.js): every dialogue is
// well formed, every answer leads somewhere real (a node, an existing place of the same map, a page the site
// serves, a whitelisted listings query), every NPC stands on a free, reachable spot, and every line exists in
// all five languages and follows the product rules on credits.
const {
  NPCS, ACTION_TYPES, npcById, npcForPlace, drawnNpcs, npcPlaces, npcBlocked, npcBox, dialogNode, chooseOption,
  validateDialog, startNode, npcNameKey, npcRoleKey, nodeTextKey, optionLabelKey,
} = require('../client/src/lib/game/npcs');
const { MAPS, MAP_IDS } = require('../client/src/lib/game/maps');
const { isWalkable, overlaps, doorAt } = require('../client/src/lib/game/gameMap');
const { cleanQuery, CARD_GAMES } = require('../client/src/lib/game/marketQueries');
const { MARKET_SHOPS } = require('../client/src/lib/game/marketMap');
const { isKnownRoute } = require('../src/services/knownRoutes');

const LANGS = ['it', 'en', 'es', 'fr', 'de'];
const locales = Object.fromEntries(LANGS.map((l) => [l, require(`../client/src/locales/${l}.json`)]));
const get = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

const allOptions = () => NPCS.flatMap((n) => Object.entries(n.dialog.nodes).flatMap(([node, d]) => d.options.map((o) => ({ npc: n, node, o }))));

describe('dialogues', () => {
  test('every dialogue is valid (start node, options with exactly one of next / do, known actions)', () => {
    for (const n of NPCS) expect([n.id, validateDialog(n.dialog)]).toEqual([n.id, []]);
  });

  test('validateDialog catches broken dialogues', () => {
    expect(validateDialog({ start: 'a', nodes: {} })).toEqual(['missing start node']);
    const errs = validateDialog({
      start: 'a',
      nodes: { a: { options: [{ id: 'x', next: 'nope' }, { id: 'y', do: { type: 'fly' } }, { id: 'z', next: 'a', do: { type: 'close' } }, { id: 'l', do: { type: 'link', path: 'http://evil' } }] }, b: { options: [] } },
    });
    expect(errs.join('|')).toMatch(/unknown node nope/);
    expect(errs.join('|')).toMatch(/unknown action fly/);
    expect(errs.join('|')).toMatch(/exactly one/);
    expect(errs.join('|')).toMatch(/bad link/);
    expect(errs.join('|')).toMatch(/b: no options/);
  });

  test('every node can be reached from the start and every node offers a way out (close, back or an action)', () => {
    for (const n of NPCS) {
      const seen = new Set([n.dialog.start]);
      const queue = [n.dialog.start];
      while (queue.length) {
        for (const o of n.dialog.nodes[queue.shift()].options) {
          if (o.next && !seen.has(o.next)) { seen.add(o.next); queue.push(o.next); }
        }
      }
      expect([n.id, [...seen].sort()]).toEqual([n.id, Object.keys(n.dialog.nodes).sort()]);
      expect(n.dialog.nodes[n.dialog.start].options.some((o) => o.do && o.do.type === 'close')).toBe(true);
    }
  });

  test('links open pages the site really serves', () => {
    for (const { npc, o } of allOptions().filter(({ o }) => o.do && o.do.type === 'link')) {
      // structural pages live under /it/... (and /en/...), the others at their plain path
      if (!isKnownRoute(o.do.path) && !isKnownRoute(`it${o.do.path}`)) throw new Error(`${npc.id}.${o.id} links to unknown page ${o.do.path}`);
    }
  });

  test('"take me there" answers walk to a place of the NPC\'s own map; goods queries are whitelisted', () => {
    for (const { npc, o } of allOptions()) {
      if (!o.do) continue;
      expect(ACTION_TYPES).toContain(o.do.type);
      if (o.do.type === 'walk') expect(MAPS[npc.map].places.map((p) => p.id)).toContain(o.do.place);
      if (o.do.type === 'products') expect(cleanQuery(o.do.query)).toEqual(o.do.query);
    }
  });

  test('dialogNode / chooseOption / startNode', () => {
    const d = dialogNode('pokemon_merchant', 'hello');
    expect(d.textKey).toBe('game.npcs.pokemon_merchant.hello');
    expect(d.options.find((o) => o.id === 'how_market').labelKey).toBe('game.dialog.opt.how_market');
    expect(chooseOption('pokemon_merchant', 'hello', 'how_market')).toEqual({ type: 'node', node: 'how' });
    expect(chooseOption('pokemon_merchant', 'hello', 'show_products')).toEqual({ type: 'action', action: { type: 'products', query: { product_type: 'tcg', game: 'pokemon' } } });
    expect(chooseOption('pokemon_merchant', 'hello', 'nope')).toBeNull();
    expect(chooseOption('nobody', 'hello', 'bye')).toBeNull();
    expect(dialogNode('guide', 'nope')).toBeNull();
    expect(startNode('guide')).toBe('hello');
    expect(startNode('nobody')).toBeNull();
  });

  test('every shop of the market has its merchant, who shows the real goods of that shop and nothing else', () => {
    for (const shop of MARKET_SHOPS) {
      const npc = npcForPlace('market', shop.id);
      expect([shop.id, npc && npc.id]).toEqual([shop.id, `${shop.id}_merchant`]);
      const queries = allOptions().filter(({ npc: n, o }) => n.id === npc.id && o.do && o.do.type === 'products').map(({ o }) => o.do.query);
      expect(queries.length).toBeGreaterThan(0);
      for (const q of queries) expect(q).toEqual(shop.query);
    }
    // the player's own shop has its clerk, who sells and shows the player's listings
    expect(npcForPlace('market', 'myshop').id).toBe('shop_clerk');
    const clerkActions = allOptions().filter(({ npc: n, o }) => n.id === 'shop_clerk' && o.do).map(({ o }) => o.do.type);
    expect(clerkActions).toEqual(expect.arrayContaining(['sell', 'mylistings', 'close']));
    expect(clerkActions).not.toContain('products');
        // every card game of the site has a shop of its own
    expect(MARKET_SHOPS.filter((s) => s.query.product_type === 'tcg').map((s) => s.query.game).sort()).toEqual([...CARD_GAMES].sort());
  });
});

describe('NPCs in the world', () => {
  test('every NPC is on a known map; keepers and merchants stand at an existing place of that map', () => {
    for (const n of NPCS) {
      expect(MAP_IDS).toContain(n.map);
      if (n.place) expect(MAPS[n.map].places.map((p) => p.id)).toContain(n.place);
    }
    expect(npcForPlace('market', 'lego').id).toBe('lego_merchant');
    expect(npcForPlace('plaza', 'credits').id).toBe('dragon');
    expect(npcForPlace('plaza', 'listings')).toBeNull(); // the castle gate leads into the market
    expect(npcById('nobody')).toBeNull();
  });

  test('drawn NPCs stand on free ground, away from doors, other obstacles and spawn points', () => {
    for (const id of MAP_IDS) {
      const map = MAPS[id];
      const own = new Set(npcBlocked(id).map((b) => JSON.stringify(b)));
      const others = map.blocked.filter((b) => !own.has(JSON.stringify(b)));
      for (const n of drawnNpcs(id)) {
        const box = npcBox(n);
        expect([n.id, others.some((b) => overlaps(box, b))]).toEqual([n.id, false]);
        expect(n.x).toBeGreaterThan(8);
        expect(n.x).toBeLessThan(map.world.w - 8);
        for (const p of map.places.filter((pl) => pl.kind !== 'npc')) expect([n.id, p.id, overlaps(box, p.door)]).toEqual([n.id, p.id, false]);
        for (const s of Object.values(map.spawns)) expect(isWalkable(s, map.blocked, map.world)).toBe(true);
      }
    }
  });

  test('an NPC standing alone becomes a place with a door zone around it; the dragon has no sprite', () => {
    const guide = npcPlaces('plaza').find((p) => p.id === 'guide');
    expect(guide).toMatchObject({ kind: 'npc', npc: 'guide' });
    const n = npcById('guide');
    expect(doorAt({ x: n.x + 12, y: n.y }, MAPS.plaza.places).id).toBe('guide');
    expect(drawnNpcs('plaza').map((x) => x.id)).not.toContain('dragon');
    expect(MAPS.plaza.places.map((p) => p.id)).toContain('guide');
  });
});

describe.each(LANGS)('texts (%s)', (lang) => {
  const loc = locales[lang];
  test('every NPC has a name, a role and a line for every node; every answer has a label', () => {
    for (const n of NPCS) {
      for (const key of [npcNameKey(n.id), npcRoleKey(n.id), ...Object.keys(n.dialog.nodes).map((node) => nodeTextKey(n.id, node))]) {
        const v = get(loc, key);
        if (typeof v !== 'string' || v.trim().length < 2) throw new Error(`${lang}: missing ${key}`);
      }
    }
    for (const { o } of allOptions()) {
      if (typeof get(loc, optionLabelKey(o.id)) !== 'string') throw new Error(`${lang}: missing ${optionLabelKey(o.id)}`);
    }
  });

  test('credits copy follows the product rules: no money value, no purchase, no exchange rate', () => {
    const texts = [
      ...NPCS.flatMap((n) => Object.keys(n.dialog.nodes).map((node) => get(loc, nodeTextKey(n.id, node)))),
      ...Object.values(loc.game.panel).filter((v) => typeof v === 'string'),
    ].join('\n');
    expect(texts).not.toMatch(/€|\beur(o|os)?\b/i);
  });
});

test('Italian credits copy says "periodo di maturazione", never "recesso"', () => {
  const it = locales.it.game.npcs;
  expect(it.dragon.earn).toMatch(/periodo di maturazione/);
  const all = JSON.stringify(it) + JSON.stringify(locales.it.game.panel);
  expect(all).not.toMatch(/recesso/i);
});
