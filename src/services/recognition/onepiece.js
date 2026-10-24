/**
 * One Piece Card Game: the code printed at the bottom right ("OP01-077") is checked on optcgapi.com, which returns
 * every print of it (base, alternate arts, reprints). See ../onepieceCode.js and ../onepiecePrints.js.
 */

const { normalizeCode } = require('../onepieceCode');
const { fetchPrintsByCode } = require('../../integrations/catalogs/onepiecePrints');
const { mapOnePieceCard } = require('../../integrations/catalogs/onepieceCards');

module.exports = {
  game: 'onepiece',
  title: 'One Piece Card Game',
  prompt: [
    '- code: the card number printed at the bottom right, e.g. "OP01-077", "ST10-005", "EB01-012", "PRB01-001", "P-034".',
    '- name: the character or card name as printed.',
    '- rarity: the rarity mark printed next to the code (C, UC, R, SR, SEC, L, SP, P, TR), if legible.',
    '- number, setCode: always null for this game.',
  ],

  identify(reading) {
    const code = normalizeCode(reading.code);
    return code ? { code } : null;
  },

  /** `fetchPrints` can be swapped (tests): code -> raw optcgapi rows. */
  async findPrints(reading, query, { fetchImpl, fetchPrints = (code) => fetchPrintsByCode(code, fetchImpl ? { fetchImpl } : {}) } = {}) {
    if (!query) return { prints: [] };
    const prints = (await fetchPrints(query.code)).map(mapOnePieceCard);
    return { prints, names: prints.map((p) => p.name) };
  },

  /** What a photo named after its print ("OP01-077_p1.jpg") is scored against. */
  keysOf: (print) => [print.external_id],

  async sample(key, { fetchImpl } = {}) {
    const code = normalizeCode(key);
    const rows = code ? await fetchPrintsByCode(code, fetchImpl ? { fetchImpl } : {}) : [];
    const row = rows.find((r) => (r.card_image_id || r.card_set_id).toLowerCase() === key.toLowerCase()) || rows[0];
    return row ? mapOnePieceCard(row) : null;
  },
};
