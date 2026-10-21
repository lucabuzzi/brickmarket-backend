/**
 * onepiecePrints.js — every print (base card, alternate arts, reprints, foils) of one One Piece card code, straight
 * from the public optcgapi.com database. No DB access: the card recognition checks a code read on a photo against
 * this list, so a misread or invented code never becomes a listing. See https://optcgapi.com/documentation
 */

const { codeKind } = require('./onepieceCode');

const OPTCG_BASE = 'https://optcgapi.com/api';

async function fetchList(path, fetchImpl) {
  try {
    const res = await fetchImpl(`${OPTCG_BASE}/${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[OPTCG prints] Network error:', err.message);
    return [];
  }
}

// a starter-deck card can also be reprinted in a booster, so both lists are asked; promos have their own
const SOURCES = {
  set: (code) => [`sets/card/${code}/`],
  starter: (code) => [`decks/card/${code}/`, `sets/card/${code}/`],
  promo: (code) => [`promos/card/${code}/`],
};

/**
 * Raw optcgapi rows of every print of `code` ("OP01-077"), base card first, without duplicates; [] when the code is
 * not a One Piece code or the database does not know it.
 */
async function fetchPrintsByCode(code, { fetchImpl = fetch } = {}) {
  const kind = codeKind(code);
  if (!kind) return [];
  const lists = await Promise.all(SOURCES[kind](encodeURIComponent(code)).map((p) => fetchList(p, fetchImpl)));
  const seen = new Set();
  const rows = [];
  for (const row of lists.flat()) {
    const id = row && (row.card_image_id || row.card_set_id);
    if (!id || seen.has(id) || row.card_set_id !== code) continue;
    seen.add(id);
    rows.push(row);
  }
  // base print ("OP01-077") first, then its variants in id order ("_p1", "_p2", "_r1")
  return rows.sort((a, b) => {
    const ia = a.card_image_id || a.card_set_id;
    const ib = b.card_image_id || b.card_set_id;
    if (ia === code) return -1;
    if (ib === code) return 1;
    return ia.localeCompare(ib);
  });
}

module.exports = { fetchPrintsByCode, OPTCG_BASE };
