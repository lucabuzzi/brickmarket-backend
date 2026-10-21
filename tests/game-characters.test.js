// The characters of "CardBrix the game" (client/src/config/gameCharacters.json, client/src/lib/game/characters.js,
// the avatar validation on both sides) and the magenta-sheet helpers of scripts/lib/skinPipeline.js: the cleaned
// catalogue has no prices or accessories, every character is translated, the creator groups them in classes,
// characters only recolour the zones they really have, and retired legacy looks are converted, never lost.
const CHARS = require('../client/src/config/gameCharacters.json');
const SPEC = require('../client/src/config/avatarSpec.json');
const P = require('../scripts/lib/skinPipeline');

const LANGS = ['it', 'en', 'es', 'fr', 'de'];
const PARTS = ['skin', 'hairColor', 'outfitColor', 'accentColor', 'legsColor'];
const SITE_GOLD = '#d4af37';

describe('gameCharacters.json (cleaned design brief)', () => {
  test('free characters: no prices, rarities, accessories or asset paths', () => {
    const { _comment: _ignored, ...data } = CHARS; // the comment explains what was removed
    const text = JSON.stringify(data);
    for (const banned of ['unlockCost', 'rarity', 'accessor', 'defaultAccessories', '/assets/', 'planeswalker']) {
      expect(text.toLowerCase()).not.toContain(banned.toLowerCase());
    }
    expect(text.toLowerCase()).not.toContain(SITE_GOLD);
  });

  test('six classes, each a man and a woman, with unique ids', () => {
    expect(CHARS.pairs).toHaveLength(6);
    const ids = CHARS.characters.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pair of CHARS.pairs) {
      const members = CHARS.characters.filter((c) => c.pair === pair);
      expect(members.map((c) => c.gender).sort()).toEqual(['female', 'male']);
    }
  });

  test('every character lists the 5 colour parts; enabled ones have valid reference colours and a body band', () => {
    for (const c of CHARS.characters) {
      expect(Object.keys(c.regions).sort()).toEqual([...PARTS].sort());
      expect(PARTS.some((p) => c.regions[p])).toBe(true);
      for (const r of Object.values(c.regions).filter(Boolean)) {
        expect(typeof r.label).toBe('string');
        for (const ref of r.ref) expect(typeof ref === 'string' ? ref : ref.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(r.band[0]).toBeGreaterThanOrEqual(0);
        expect(r.band[1]).toBeLessThanOrEqual(1);
        expect(r.band[0]).toBeLessThan(r.band[1]);
      }
    }
  });

  test('every legacy look is replaced by a real character of the same gender', () => {
    for (const l of CHARS.legacyLooks) {
      const to = CHARS.characters.find((c) => c.id === l.replacedBy);
      expect(to).toBeDefined();
      expect(to.gender).toBe(l.gender);
    }
  });

  test('the sheet spec matches what the build script expects (4 columns x 3 rows, magenta key)', () => {
    expect(CHARS.sheet.cols).toBe(4);
    expect(CHARS.sheet.rows).toEqual(['down', 'up', 'right']);
    expect(CHARS.sheet.chromaKey.hex.toUpperCase()).toBe('#FF00FF');
  });
});

describe.each(LANGS)('%s texts', (lang) => {
  const game = require(`../client/src/locales/${lang}.json`).game;
  test('every character, class and colour zone label is translated', () => {
    for (const c of [...CHARS.characters, ...CHARS.legacyLooks]) expect(game.characters[c.id]).toBeTruthy();
    for (const pair of [...CHARS.pairs, ...new Set(CHARS.legacyLooks.map((l) => l.pair))]) {
      expect(game.classes[pair].name).toBeTruthy();
      expect(game.classes[pair].tagline).toBeTruthy();
    }
    const labels = new Set(['skin', 'hair', 'outfit', 'details', 'trousers']);
    for (const c of CHARS.characters) for (const r of Object.values(c.regions)) if (r) labels.add(r.label);
    for (const label of labels) expect(game.creator.regions[label]).toBeTruthy();
    for (const k of ['class', 'gender', 'gender_male', 'gender_female']) expect(game.creator[k]).toBeTruthy();
  });
});

describe('with the sheets built today (avatarSpec.json)', () => {
  const C = require('../client/src/lib/game/characters');

  test('the playable looks are the ones in avatarSpec.json', () => {
    expect(C.AVAILABLE_LOOKS).toEqual(SPEC.looks);
  });

  test('playable looks resolve to themselves, retired legacy looks to their replacement, the rest to null', () => {
    for (const id of SPEC.looks) expect(C.resolveLook(id)).toBe(id);
    for (const l of CHARS.legacyLooks) {
      if (!SPEC.looks.includes(l.id)) expect(C.resolveLook(l.id)).toBe(l.replacedBy);
    }
    for (const c of CHARS.characters) if (!SPEC.looks.includes(c.id)) expect(C.resolveLook(c.id)).toBeNull();
    expect(C.resolveLook('nope')).toBeNull();
  });

  test('the creator shows every playable look exactly once, grouped by class, man first', () => {
    const classes = C.creatorClasses();
    expect(classes.flatMap((c) => c.members).sort()).toEqual([...SPEC.looks].sort());
    for (const c of classes) {
      for (const id of c.members) expect(C.CHARACTER_INFO[id].pair).toBe(c.pair);
      if (c.members.length === 2) expect(C.CHARACTER_INFO[c.members[0]].gender).toBe('male');
    }
  });

  test('the explorers (first Gemini sheets) are playable and replace the classic looks', () => {
    expect(SPEC.looks).toEqual(expect.arrayContaining(['esploratore_collezionista', 'esploratrice_collezionista']));
    expect(SPEC.looks).not.toContain('uomo_base');
    expect(C.resolveLook('uomo_base')).toBe('esploratore_collezionista');
    expect(C.memberOf('monster_explorer', 'female')).toBe('esploratrice_collezionista');
    expect(C.editableParts('esploratore_collezionista').map((e) => e.part)).toEqual(PARTS);
  });
});

describe('once new characters are built (avatarSpec rewritten by the build script)', () => {
  const FUTURE_LOOKS = ['corsaro', 'corsara', 'cavaliere_neon', 'uomo_base', 'donna_base', 'donna_cyber'];
  let server;
  let client;
  let skins;
  beforeAll(() => {
    jest.isolateModules(() => {
      jest.doMock('../client/src/config/avatarSpec.json', () => ({ ...SPEC, looks: FUTURE_LOOKS }));
      server = require('../src/services/avatarConfig');
      client = require('../client/src/lib/game/characters');
      skins = require('../client/src/lib/game/skins');
    });
  });
  afterAll(() => jest.dontMock('../client/src/config/avatarSpec.json'));

  test('new classes come first, then the legacy ones still playable', () => {
    expect(client.creatorClasses().map((c) => c.pair)).toEqual(['sea_pirate', 'cyber_knight', 'classic', 'cyber_classic']);
    expect(client.memberOf('cyber_knight', 'female')).toBe('cavaliere_neon'); // no woman yet: the man
  });

  test('a character only edits the zones it has, with its own labels', () => {
    expect(client.editableParts('cavaliere_neon')).toEqual([
      { part: 'outfitColor', label: 'cyber_armor' },
      { part: 'accentColor', label: 'visor_scarf_blade' },
      { part: 'legsColor', label: 'armored_greaves' },
    ]);
  });

  test('server: a saved legacy look whose replacement is built is converted, zeroing the zones it lacks', () => {
    const saved = { v: 2, look: 'uomo_cyber', skin: 3, hairColor: 2, outfitColor: 4, accentColor: 1, legsColor: 5 };
    expect(server.normalizeAvatarConfig(saved)).toEqual({ v: 2, look: 'cavaliere_neon', skin: 0, hairColor: 0, outfitColor: 4, accentColor: 1, legsColor: 5 });
  });

  test('server: a legacy look nobody replaced yet stays as it is; an unbuilt character is refused', () => {
    const saved = { v: 2, look: 'donna_cyber', skin: 3, hairColor: 2, outfitColor: 4, accentColor: 1, legsColor: 5 };
    expect(server.normalizeAvatarConfig(saved)).toEqual(saved);
    expect(server.normalizeAvatarConfig({ ...saved, look: 'arcanista' })).toBeNull();
  });

  test('server: colours on a zone the character cannot recolour are refused (never stored)', () => {
    const base = { v: 2, look: 'cavaliere_neon', skin: 0, hairColor: 0, outfitColor: 2, accentColor: 2, legsColor: 2 };
    expect(server.normalizeAvatarConfig(base)).toEqual(base);
    expect(server.normalizeAvatarConfig({ ...base, skin: 1 })).toBeNull();
  });

  test('client: sanitize converts exactly like the server, and random avatars are always valid', () => {
    const saved = { v: 2, look: 'uomo_cyber', skin: 3, hairColor: 2, outfitColor: 4, accentColor: 1, legsColor: 5 };
    expect(skins.sanitizeAvatar(saved)).toEqual(server.normalizeAvatarConfig(saved));
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 200; i++) {
      const a = skins.randomAvatar(rand);
      expect(server.normalizeAvatarConfig(a)).toEqual(a);
    }
  });
});

describe('magenta sheets (skinPipeline)', () => {
  const W = 6;
  const H = 4;
  const image = () => {
    const d = new Uint8Array(W * H * 4);
    for (let k = 0; k < W * H; k++) d.set([255, 0, 255, 255], k * 4);
    return d;
  };
  const set = (d, x, y, rgb) => d.set([...rgb, 255], (y * W + x) * 4);
  const alpha = (d, x, y) => d[(y * W + x) * 4 + 3];

  test('the key colour goes, within tolerance, everywhere; the character stays', () => {
    const d = image();
    set(d, 1, 1, [76, 29, 149]); // purple robe: far from magenta
    set(d, 2, 1, [76, 29, 149]);
    set(d, 3, 1, [240, 20, 235]); // JPEG-ish magenta
    expect(P.removeChromaKey(d, W, H, { rgb: [255, 0, 255], tolerance: 35 })).toBeGreaterThan(0);
    expect(alpha(d, 1, 1)).toBe(255);
    expect(alpha(d, 2, 1)).toBe(255);
    expect(alpha(d, 3, 1)).toBe(0);
    expect(alpha(d, 0, 0)).toBe(0);
  });

  test('magenta spill on the character edge is removed, the inside is kept', () => {
    const d = image();
    for (let x = 1; x <= 4; x++) for (let y = 1; y <= 2; y++) set(d, x, y, [30, 58, 138]);
    set(d, 1, 1, [200, 60, 190]); // pinkish edge pixel
    P.removeChromaKey(d, W, H, { rgb: [255, 0, 255], tolerance: 35 });
    expect(alpha(d, 1, 1)).toBe(0);
    expect(alpha(d, 2, 1)).toBe(255);
  });

  test('zones by closest reference colour, restricted by body height; outlines and odd colours stay as drawn', () => {
    const corsaro = CHARS.characters.find((c) => c.id === 'corsaro');
    const refs = P.prepareRefs(corsaro.regions);
    expect(P.classifyByRefs([224, 172, 105], 0.2, refs)).toBe(P.REGION.skin);
    expect(P.classifyByRefs([30, 58, 138], 0.5, refs)).toBe(P.REGION.outfit);
    expect(P.classifyByRefs([220, 38, 38], 0.5, refs)).toBe(P.REGION.accent);
    expect(P.classifyByRefs([120, 53, 15], 0.9, refs)).toBe(P.REGION.legs);
    expect(P.classifyByRefs([43, 43, 43], 0.1, refs)).toBe(P.REGION.hair);
    expect(P.classifyByRefs([43, 43, 43], 0.9, refs)).not.toBe(P.REGION.hair); // dark boots are not hair
    expect(P.classifyByRefs([5, 5, 5], 0.5, refs)).toBe(P.REGION.none); // outline
    expect(P.classifyByRefs([0, 255, 0], 0.5, refs)).toBe(P.REGION.none); // nothing like it
  });

  test('a character without skin or hair zones never gets them', () => {
    const knight = CHARS.characters.find((c) => c.id === 'cavaliere_neon');
    const regions = new Set(P.prepareRefs(knight.regions).map((z) => z.region));
    expect(regions.has(P.REGION.skin)).toBe(false);
    expect(regions.has(P.REGION.hair)).toBe(false);
  });
});
