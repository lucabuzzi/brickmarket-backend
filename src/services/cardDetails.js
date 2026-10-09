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
});
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
 *  - update (partial=true): only the keys the request sent (or all four when the type is not a card)
 */
function cardDetailsForDb(v, productType, { partial = false } = {}) {
  const notCard = productType !== undefined && productType !== 'tcg';
  const out = {};
  for (const key of CARD_DETAIL_KEYS) {
    if (notCard) { out[key] = null; continue; }
    if (partial && v[key] === undefined) continue;
    out[key] = isBlank(v[key]) ? null : String(v[key]).trim();
  }
  return out;
}

module.exports = {
  CARD_LANGUAGES, GRADING_COMPANIES, CARD_RARITY_MAX, CARD_GRADE_MAX,
  CARD_DETAIL_COLUMNS, CARD_DETAIL_KEYS, checkCardDetails, cardDetailsForDb,
};
