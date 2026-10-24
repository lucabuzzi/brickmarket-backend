/**
 * Magic: The Gathering. Cards printed since 2015 carry the set code and the collector number at the bottom left
 * ("MKM • EN" / "0123"): Scryfall answers the exact print from those two. Older cards, or a code that was not legible,
 * are looked up by name and the seller picks among the prints of that name. A card in another language is found
 * through its printed name and offered as the English catalog print (the language stays on the listing).
 * See https://scryfall.com/docs/api — it asks for a descriptive User-Agent.
 */

const { fetchJson, toDigits, numberKey } = require('./http');
const { mapScryfallCard } = require('../../integrations/catalogs/scryfallCards');

const BASE = 'https://api.scryfall.com';
const HEADERS = { 'User-Agent': 'CardBrix/1.0 (card recognition)' };
const MAX_PRINTS = 24;
const SET_CODE_PRINTED = '2015-07-17'; // Magic Origins: the first set with the set code in the collector line

const get = (path, deps) => fetchJson(`${BASE}${path}`, { fetchImpl: deps.fetchImpl, headers: HEADERS, tag: 'Scryfall' });
const search = (q, deps, extra = '') => get(`/cards/search?q=${encodeURIComponent(q)}&unique=prints${extra}`, deps);
const quoted = (name) => `!"${String(name).replace(/"/g, '')}"`;

/** "mkm" / "M K M" -> "MKM"; anything that is not 2-6 letters and digits -> null. */
function setCodeOf(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{2,6}$/.test(s) && /[A-Z]/.test(s) ? s : null;
}

/** "0123/286" -> "123", "12a" -> "12A"; the total after the slash is not part of the number. */
function collectorNumberOf(raw) {
  const first = String(raw ?? '').split('/')[0].replace(/\s+/g, '');
  const m = /^([0-9OQDILZSBG|]+)([A-Z★]?)$/i.exec(first);
  return m ? numberKey(`${toDigits(m[1])}${m[2]}`) : null;
}

// a double-faced card is named "Front // Back": either face read on the photo counts
const faceNames = (cards) => cards.flatMap((c) => String(c.name || '').split(' // '));

module.exports = {
  game: 'magic',
  title: 'Magic: The Gathering',
  prompt: [
    '- name: the card name as printed in the title bar, in the language it is printed in.',
    '- setCode: the 3-5 character set code printed at the bottom left, e.g. "MKM", "DMU", "2X2" (only on recent cards).',
    '- number: the collector number printed at the bottom left, e.g. "0123" or "123/286".',
    '- rarity: the rarity letter printed next to the collector number (C, U, R, M), if legible.',
    '- code: always null for this game.',
  ],

  identify(reading) {
    const set = setCodeOf(reading.setCode);
    const number = collectorNumberOf(reading.number);
    return set || number ? { set, number } : null;
  },

  async findPrints(reading, query, deps = {}) {
    const english = !reading.language || reading.language === 'en';
    let cards = [];
    if (query?.set && query?.number) {
      const card = await get(`/cards/${query.set.toLowerCase()}/${encodeURIComponent(query.number.toLowerCase())}`, deps);
      if (card && card.object === 'card') cards = [card];
    }
    if (!cards.length && reading.name) {
      let name = reading.name;
      if (!english) {
        // the printed name of a foreign card -> its English (Oracle) name
        const foreign = await search(`${quoted(name)} lang:${reading.language}`, deps);
        if (foreign?.data?.[0]) name = foreign.data[0].name;
      }
      let found = await search(`${quoted(name)} -is:digital`, deps, '&order=released&dir=desc');
      if (!found?.data?.length && english) {
        // a misread letter: Scryfall's fuzzy match gives the real name
        const fuzzy = await get(`/cards/named?fuzzy=${encodeURIComponent(name)}`, deps);
        if (fuzzy?.name) found = await search(`${quoted(fuzzy.name)} -is:digital`, deps, '&order=released&dir=desc');
      }
      cards = found?.data || [];
      // what was legible of the code narrows the prints down, when it does not rule them all out
      const narrow = (keep) => { const n = cards.filter(keep); if (n.length) cards = n; };
      if (query?.number) narrow((c) => numberKey(c.collector_number) === query.number);
      if (query?.set) narrow((c) => String(c.set).toUpperCase() === query.set);
      // every card since Magic Origins prints its set code: none read means an older card, so those prints come first
      if (!query?.set) cards = [...cards.filter((c) => c.released_at < SET_CODE_PRINTED), ...cards.filter((c) => !(c.released_at < SET_CODE_PRINTED))];
    }
    const prints = cards.slice(0, MAX_PRINTS).map(mapScryfallCard);
    // the catalog is English: a name printed in another language cannot be compared
    return { prints, names: english ? faceNames(cards) : null };
  },

  keysOf: (print) => [print.external_id, `${print.set_code}-${print.details?.localId}`.toLowerCase()],

  /** key "mkm-123" (set-number) -> that print. */
  async sample(key, deps = {}) {
    const [set, number] = String(key).split('-');
    const card = await get(`/cards/${set.toLowerCase()}/${encodeURIComponent(number)}`, deps);
    if (!card || card.object !== 'card') return null;
    const row = mapScryfallCard(card);
    return { ...row, img_url: card.image_uris?.large || card.card_faces?.[0]?.image_uris?.large || row.img_url };
  },

  // exported for tests
  setCodeOf, collectorNumberOf,
};
