// The hand-checked list that links the old card listings to their expansion (src/db/data/cardSetLinks.js).
// Pure data checks: nothing here touches a database.
const fs = require('fs');
const path = require('path');
const { CARD_SET_LINKS } = require('../src/db/data/cardSetLinks');
const { CARD_SET_ID_PATTERN, SET_GAMES } = require('../src/services/cardDetails');

describe('CARD_SET_LINKS', () => {
  test('has entries, each listing at most once', () => {
    expect(CARD_SET_LINKS.length).toBeGreaterThan(0);
    const ids = CARD_SET_LINKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every entry is for a game that has an expansion catalog', () => {
    for (const l of CARD_SET_LINKS) expect(SET_GAMES).toContain(l.game || 'pokemon');
  });

  test.each(CARD_SET_LINKS.map((l) => [l.title, l]))('%s: ids and numbers are consistent', (_title, l) => {
    expect(l.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    // what the API accepts, or the server would reject the same values when a seller saves the listing
    expect(l.cardSetId).toMatch(CARD_SET_ID_PATTERN);
    expect(l.cardExternalId).toMatch(CARD_SET_ID_PATTERN);

    if (l.game === 'yugioh') {
      // "<card id>_<print code>_<rarity code>": the print code is the number
      expect(l.cardNumber).toMatch(/^[A-Z0-9]+-[A-Z]*\d+$/);
      const y = l.cardExternalId.match(/^(\d+)_([A-Z0-9]+-[A-Z]*\d+)_([A-Za-z]+)$/);
      expect(y).not.toBeNull();
      expect(y[2]).toBe(l.cardNumber);
      expect(l.title).toContain(l.cardNumber); // the print code is in the title
      expect(l.cardSetId).toMatch(/^[a-z0-9-]+$/); // a slug of the expansion name
      return;
    }

    expect(l.cardNumber).toMatch(/^\d+\/\d+$/);
    // the card id is "<expansion>-<zero-padded number>" and the number agrees with cardNumber
    const m = l.cardExternalId.match(/^(.+)-(\d+)$/);
    expect(m).not.toBeNull();
    expect(m[1]).toBe(l.cardSetId);
    expect(parseInt(m[2], 10)).toBe(parseInt(l.cardNumber.split('/')[0], 10));
    // a number printed in the title has to match the one we link
    const printed = l.title.match(/\b(\d+)\/(\d+)\b/);
    if (printed && l.cardSetId !== '30th-c') expect(l.cardNumber).toBe(`${parseInt(printed[1], 10)}/${printed[2]}`);
  });

  test('entries name their game, or are Pokémon (the script default)', () => {
    expect(CARD_SET_LINKS.filter((l) => l.game === 'yugioh').length).toBeGreaterThan(0);
    expect(CARD_SET_LINKS.filter((l) => !l.game).length).toBeGreaterThan(0);
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'backfill_card_set_links.js'), 'utf8');
    expect(src).toMatch(/l\.game \|\| 'pokemon'/);
  });

  test('the script only touches listed ids, card listings of the entry game without a link, and the undo only what it wrote', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'backfill_card_set_links.js'), 'utf8');
    expect(src).toMatch(/WHERE id = \$1 AND product_type = 'tcg' AND game = \$5 AND card_set_id IS NULL/);
    expect(src).toMatch(/WHERE id = \$1 AND card_set_id = \$2 AND card_external_id = \$3/);
    expect(src).toMatch(/--down/);
    expect(src).not.toMatch(/DELETE|DROP/i);
  });
});
