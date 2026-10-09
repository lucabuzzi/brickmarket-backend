// Extra details a trading-card listing can carry: language, rarity and professional grading.
// Pure helpers (no DB, no Express) shared by the listings routes and the tests.

/** ISO-ish codes shown in the wizard; the labels live in the client locales. */
const CARD_LANGUAGES = ['it', 'en', 'ja', 'de', 'fr', 'es', 'pt', 'ko', 'zh'];
const GRADING_COMPANIES = ['psa', 'cgc', 'bgs', 'sgc', 'other'];
const CARD_RARITY_MAX = 60;
const CARD_GRADE_MAX = 10;

/** API field name -> listings column */
const CARD_DETAIL_COLUMNS = Object.freeze({
  cardLanguage: 'card_language',
  cardRarity: 'card_rarity',
  cardGradingCompany: 'card_grading_company',
  cardGrade: 'card_grade',
  // link to the catalog (expansion + card), only for games that have one — see SET_GAMES
  cardSetId: 'card_set_id',
  cardNumber: 'card_number',
  cardExternalId: 'card_external_id',
});
const CARD_SET_KEYS = ['cardSetId', 'cardNumber', 'cardExternalId'];
/** Games whose expansions live in card_sets (TCGdex). Others never store the catalog link. */
const SET_GAMES = ['pokemon'];
const CARD_SET_ID_PATTERN = /^[A-Za-z0-9._-]{1,60}$/;
const CARD_NUMBER_MAX = 20;
const CARD_DETAIL_KEYS = Object.keys(CARD_DETAIL_COLUMNS);

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

/**
 * A graded card needs both the company and the grade; one without the other is a mistake.
 * Only looks at what the request actually sent, so a partial update that touches neither is fine.
 * Returns an error message, or null when the combination is acceptable.
 */
function checkCardDetails(v) {
  if (v.cardGradingCompany === undefined && v.cardGrade === undefined) return null;
  if (isBlank(v.cardGradingCompany) !== isBlank(v.cardGrade)) {
    return 'Indica insieme la società di gradazione e il voto (oppure nessuno dei due)';
  }
  return null;
}

/**
 * The card columns to write, keyed by API field name. Values are trimmed and blank becomes null.
 * Anything that is not a card (productType given and not 'tcg') clears all four.
 *  - create (partial=false): always returns all four keys
 *  - update (partial=true): only the keys the request sent (or all of them when the type is not a card)
 * The catalog link (expansion/number/card id) is cleared too when the request names a game without a catalog.
 */
function cardDetailsForDb(v, productType, { partial = false } = {}) {
  const notCard = productType !== undefined && productType !== 'tcg';
  const noCatalog = notCard || (v.game !== undefined && !SET_GAMES.includes(v.game));
  const out = {};
  for (const key of CARD_DETAIL_KEYS) {
    if (notCard || (noCatalog && CARD_SET_KEYS.includes(key))) { out[key] = null; continue; }
    if (partial && v[key] === undefined) continue;
    out[key] = isBlank(v[key]) ? null : String(v[key]).trim();
  }
  return out;
}

module.exports = {
  CARD_LANGUAGES, GRADING_COMPANIES, CARD_RARITY_MAX, CARD_GRADE_MAX, CARD_SET_ID_PATTERN, CARD_NUMBER_MAX, SET_GAMES,
  CARD_DETAIL_COLUMNS, CARD_DETAIL_KEYS, checkCardDetails, cardDetailsForDb,
};
