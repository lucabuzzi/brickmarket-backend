/**
 * Pokémon TCG. A card shows its collector number and the size of its set at the bottom ("063/198"); recent cards
 * also print the set abbreviation ("SVI"). Older cards have only a set symbol, so the name is what finds them:
 * TCGdex is searched by name (in the card's language), the number keeps only that card, and the printed total keeps
 * only the sets of that size. With no legible name, the abbreviation (or the total) points at the set directly.
 * The prints are returned as the Italian catalog rows (tcgdex.js reads TCGdex in Italian), same ids in every language.
 */

const { fetchJson, toDigits, numberKey } = require('./http');
const { mapCardDetail } = require('../tcgdexCards');

const BASE = 'https://api.tcgdex.net/v2';
const LANGUAGES = new Set(['en', 'it', 'fr', 'de', 'es', 'pt']); // card names TCGdex can be searched in
const MAX_PRINTS = 12;
const MAX_SETS_BY_TOTAL = 6;
const SETS_TTL_MS = 6 * 60 * 60 * 1000;

const get = (path, deps) => fetchJson(`${BASE}${path}`, { fetchImpl: deps.fetchImpl, tag: 'TCGdex' });

let setsCache = null; // { at, list: [{ id, official }] }
async function setList(deps) {
  if (setsCache && Date.now() - setsCache.at < SETS_TTL_MS) return setsCache.list;
  const data = await get('/en/sets', deps);
  if (!Array.isArray(data)) return setsCache?.list || [];
  setsCache = { at: Date.now(), list: data.map((s) => ({ id: s.id, official: s.cardCount?.official ?? null })) };
  return setsCache.list;
}

/** "063/198" -> { number: '63', total: '198' }; "TG05/TG30" -> TG5 / TG30; "SWSH063" -> { number: 'SWSH63' }. */
function parseNumber(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/\s+/g, '');
  // a real letter prefix (TG, GG, SWSH...) is kept as printed; elsewhere letters are digits misread
  const part = (p) => {
    const m = /^(TG|GG|SWSH|SVP|SV|SMP|SM|XYP|XY|BWP|BW|HGSS|DP|RC|SL|SH|H)?(.+)$/.exec(p);
    const digits = toDigits(m[2]);
    return /^\d+$/.test(digits) ? numberKey(`${m[1] || ''}${digits}`) : null;
  };
  const [a, b] = s.split('/');
  const number = a ? part(a) : null;
  if (!number) return null;
  return { number, total: b ? part(b) : null };
}

/** "Charizard ex" -> "Charizard", "Pikachu VMAX" -> "Pikachu": the search is by "name contains". */
const baseName = (name) => String(name).replace(/[-\s]+(ex|gx|v|vmax|vstar|v-union|break|lv\.?\s?x|prism star|δ|◇)$/i, '').trim();

const abbreviationOf = (raw) => {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z][A-Z0-9]{1,4}$/.test(s) ? s : null;
};

/**
 * One print as the catalog row (read in Italian, in English when TCGdex has no Italian card). TCGdex has no Italian
 * pictures of the oldest sets (Base Set...): those take the English picture, the seller compares it with the card.
 * `cardCountOfficial` lets the sell page write the number as printed ("4/102").
 */
async function printOf(id, official, deps) {
  const path = `/cards/${encodeURIComponent(id)}`;
  const it = await get(`/it${path}`, deps);
  const en = !it?.image ? await get(`/en${path}`, deps) : null;
  const card = it?.id ? { ...it, image: it.image || en?.image } : en;
  if (!card?.id) return null;
  const row = mapCardDetail(card);
  const count = card.set?.cardCount?.official ?? official.get(row.set_code) ?? null;
  return { ...row, details: { ...row.details, cardCountOfficial: count } };
}

module.exports = {
  game: 'pokemon',
  title: 'Pokémon Trading Card Game',
  prompt: [
    '- name: the Pokémon or card name printed at the top, in the language it is printed in (e.g. "Charizard ex").',
    '- number: the collector number printed at the bottom, with the set size when present, e.g. "063/198", "TG05/TG30", "SWSH063".',
    '- setCode: the set abbreviation printed next to the number on recent cards, e.g. "SVI", "PAL", "OBF" (null when only a symbol is printed).',
    '- rarity, code: always null for this game.',
  ],

  identify(reading) {
    const parsed = parseNumber(reading.number);
    return parsed ? { ...parsed, abbreviation: abbreviationOf(reading.setCode) } : null;
  },

  async findPrints(reading, query, deps = {}) {
    // without a number a name alone matches hundreds of cards: the seller searches by hand instead
    if (!query) return { prints: [] };
    const sameNumber = (c) => numberKey(c.localId) === query.number;
    const sets = await setList(deps);
    const official = new Map(sets.map((s) => [s.id, s.official]));
    const setIdOf = (card) => card.id.slice(0, card.id.length - String(card.localId).length - 1);
    let candidates = [];
    let names = null;

    if (reading.name) {
      const lang = LANGUAGES.has(reading.language) ? reading.language : 'en';
      const list = await get(`/${lang}/cards?name=${encodeURIComponent(baseName(reading.name))}`, deps);
      candidates = (Array.isArray(list) ? list : []).filter(sameNumber);
      // the printed set size rules out a card of that name and number from a set of another size
      if (query.total && /^\d+$/.test(query.total)) {
        candidates = candidates.filter((c) => {
          const size = official.get(setIdOf(c));
          return size == null || String(size) === query.total;
        });
      }
      names = candidates.map((c) => c.name);
    }
    if (!candidates.length) {
      // by the printed set: its abbreviation, or else every set of that size
      let setIds = [];
      if (query.abbreviation) {
        const found = await get(`/en/sets?abbreviation.official=${encodeURIComponent(query.abbreviation)}`, deps);
        setIds = (Array.isArray(found) ? found : []).map((s) => s.id);
      }
      if (!setIds.length && query.total && /^\d+$/.test(query.total)) {
        setIds = sets.filter((s) => String(s.official) === query.total).map((s) => s.id).slice(-MAX_SETS_BY_TOTAL);
      }
      const details = await Promise.all(setIds.map((id) => get(`/en/sets/${encodeURIComponent(id)}`, deps)));
      candidates = details.flatMap((set) => (set?.cards || []).filter(sameNumber));
      // these names are English: a name read in English that disagrees is flagged for the seller to check
      names = !reading.language || reading.language === 'en' ? candidates.map((c) => c.name) : null;
    }
    if (candidates.length > 1 && query.total && /^\d+$/.test(query.total)) {
      const bySize = candidates.filter((c) => String(official.get(setIdOf(c))) === query.total);
      if (bySize.length) candidates = bySize;
    }
    const ids = [...new Set(candidates.map((c) => c.id))].slice(0, MAX_PRINTS);
    const prints = (await Promise.all(ids.map((id) => printOf(id, official, deps)))).filter(Boolean);
    // the prints are the Italian catalog rows: an Italian name found by the set alone is compared with them
    if (!names && reading.language === 'it') names = prints.map((p) => p.name);
    return { prints, names };
  },

  keysOf: (print) => [print.external_id],

  /** key: a TCGdex card id, e.g. "sv01-063". */
  async sample(key, deps = {}) {
    const card = await get(`/en/cards/${encodeURIComponent(key)}`, deps);
    if (!card || !card.id) return null;
    const row = mapCardDetail(card);
    return { ...row, img_url: card.image ? `${card.image}/high.png` : null };
  },

  // exported for tests
  parseNumber, baseName, abbreviationOf, resetCache: () => { setsCache = null; },
};
