// The hand-checked list that links the old Pokémon listings to their expansion (src/db/data/cardSetLinks.js).
// Pure data checks: nothing here touches a database.
const fs = require('fs');
const path = require('path');
const { CARD_SET_LINKS } = require('../src/db/data/cardSetLinks');
const { CARD_SET_ID_PATTERN } = require('../src/services/cardDetails');

describe('CARD_SET_LINKS', () => {
  test('has entries, each listing at most once', () => {
    expect(CARD_SET_LINKS.length).toBeGreaterThan(0);
    const ids = CARD_SET_LINKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test.each(CARD_SET_LINKS.map((l) => [l.title, l]))('%s: ids and numbers are consistent', (_title, l) => {
    expect(l.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    // what the API accepts, or the server would reject the same values when a seller saves the listing
    expect(l.cardSetId).toMatch(CARD_SET_ID_PATTERN);
    expect(l.cardExternalId).toMatch(CARD_SET_ID_PATTERN);
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

  test('the script only touches listed ids, Pokémon cards without a link, and the undo only what it wrote', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'backfill_card_set_links.js'), 'utf8');
    expect(src).toMatch(/WHERE id = \$1 AND product_type = 'tcg' AND game = 'pokemon' AND card_set_id IS NULL/);
    expect(src).toMatch(/WHERE id = \$1 AND card_set_id = \$2 AND card_external_id = \$3/);
    expect(src).toMatch(/--down/);
    expect(src).not.toMatch(/DELETE|DROP/i);
  });
});
