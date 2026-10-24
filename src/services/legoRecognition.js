/**
 * legoRecognition.js — recognises a LEGO set from a photo of its box (or bag), in two steps like the cards
 * (cardRecognition.js):
 *   1. the vision model reads the SET NUMBER printed on the box (plus the name and whether the box looks sealed);
 *   2. that number is looked up in the Rebrickable catalog (integrations/catalogs/rebrickable.js), which says whether
 *      the set really exists and gives its name, year and pieces.
 * Only a set that exists becomes a result, so a misread number never fills a listing. "Sealed" is only a hint for
 * the condition, which the seller confirms or changes.
 * The photo is never stored or logged: it lives in memory for the duration of the request.
 */

const { geminiReader, prepareImage } = require('./cardRecognition');
const rebrickable = require('../integrations/catalogs/rebrickable');
const { computeMarketValue } = require('./marketValue');

const PROMPT = [
  'You are reading a photo of a LEGO set box (or polybag) for a marketplace listing.',
  'Report only what is actually printed and legible on the packaging. Never guess or complete from memory.',
  '- setNumber: the set number printed on the box (usually 4 to 6 digits, e.g. 75192, 10281, 42143), digits only.',
  '- name: the set name as printed, if legible.',
  '- sealed: true if the box looks factory sealed and unopened, false if it is clearly opened or there is no box, null if you cannot tell.',
  '- isLego: false if the photo does not show a LEGO product.',
  'Use null for anything that is not clearly legible.',
].join('\n');

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    isLego: { type: 'BOOLEAN' },
    setNumber: { type: 'STRING', nullable: true },
    name: { type: 'STRING', nullable: true },
    sealed: { type: 'BOOLEAN', nullable: true },
  },
  required: ['isLego', 'setNumber', 'name', 'sealed'],
};

/** The model's JSON -> { isLego, setNumber, name, sealed }; anything malformed is null, never thrown. */
function parseLegoReading(text) {
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  if (!data || typeof data !== 'object') return null;
  const digits = String(data.setNumber ?? '').replace(/[\s.]/g, '');
  const name = typeof data.name === 'string' ? data.name.trim().slice(0, 120) : '';
  return {
    isLego: data.isLego !== false,
    // a set number: 3 to 7 digits, optionally with its "-1" variant suffix
    setNumber: /^\d{3,7}(-\d{1,2})?$/.test(digits) ? digits : null,
    name: name && !/^(null|unknown|n\/a)$/i.test(name) ? name : null,
    sealed: typeof data.sealed === 'boolean' ? data.sealed : null,
  };
}

/** The condition the box suggests (a LEGO condition of the sell form): sealed -> new, opened -> used, else none. */
const suggestedCondition = (reading) => (reading?.sealed === true ? 'new' : reading?.sealed === false ? 'used' : null);

/**
 * (photo) -> {
 *   status: 'matched'     the set exists: `set` is the catalog's ({ set_num, name, year, num_parts, img_url }), `pricing`
 *                         the market value estimate of the sell page (marketValue.js)
 *         | 'not_found'   a number was read but no set has it
 *         | 'unreadable'  no LEGO packaging, or no number legible: retake the photo
 *   reading: { setNumber, name, sealed, condition }, usage
 * }
 * `reader` and `lookup` are swappable so tests run offline.
 */
async function recognizeLegoSet(buffer, { reader = geminiReader(), lookup = rebrickable.lookupSet } = {}) {
  const jpeg = await prepareImage(buffer);
  const { reading, usage } = await reader(jpeg, { prompt: PROMPT, schema: SCHEMA, parse: parseLegoReading });
  const read = reading ? { setNumber: reading.setNumber, name: reading.name, sealed: reading.sealed, condition: suggestedCondition(reading) } : null;
  if (!reading || !reading.isLego || !reading.setNumber) return { status: 'unreadable', reading: read, set: null, pricing: null, usage };
  const found = await lookup(rebrickable.normalizeSetNum(reading.setNumber));
  if (!found) return { status: 'not_found', reading: read, set: null, pricing: null, usage };
  const set = { set_num: found.set_num, name: found.name, year: found.year ?? null, num_parts: found.num_parts ?? null, img_url: found.img_url ?? null };
  const p = computeMarketValue(found);
  const pricing = p ? { retailPrice: p.retailPrice ?? null, marketValue: p.marketValue ?? null, low: p.low ?? null, high: p.high ?? null } : null;
  return { status: 'matched', reading: read, set, pricing, usage };
}

module.exports = { recognizeLegoSet, parseLegoReading, suggestedCondition, PROMPT, SCHEMA };
