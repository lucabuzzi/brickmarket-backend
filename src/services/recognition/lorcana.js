/**
 * Disney Lorcana. The bottom left of a card reads "123/204 • EN • 5": collector number, set size, language and set
 * number. lorcana-api.com answers the card from the set and collector numbers; without them, the name finds it.
 * See https://lorcana-api.com/How-To.html
 */

const { fetchJson, toDigits } = require('./http');
const { mapLorcanaCard } = require('../../integrations/catalogs/lorcanaCards');

const BASE = 'https://api.lorcana-api.com';
const MAX_PRINTS = 12;

const get = (path, deps) => fetchJson(`${BASE}${path}`, { fetchImpl: deps.fetchImpl, tag: 'Lorcana' });
const searchCards = async (search, deps) => {
  const data = await get(`/cards/fetch?search=${encodeURIComponent(search)}`, deps);
  return Array.isArray(data) ? data : [];
};

const intOf = (raw) => {
  const digits = toDigits(String(raw ?? '').trim());
  return /^\d{1,4}$/.test(digits) ? Number(digits) : null;
};

/** "123/204" -> 123; "5" (set number) -> 5. */
const cardNumberOf = (raw) => intOf(String(raw ?? '').split('/')[0]);

module.exports = {
  game: 'lorcana',
  title: 'Disney Lorcana',
  prompt: [
    '- name: the full card name as printed: the character name and, below it, its version, joined as "Name - Version" (e.g. "Ratigan - Party Crasher").',
    '- number: the collector number printed at the bottom left, e.g. "123/204".',
    '- setCode: the set number printed after the language code at the bottom left, e.g. "5" in "123/204 • EN • 5".',
    '- rarity, code: always null for this game.',
  ],

  identify(reading) {
    const number = cardNumberOf(reading.number);
    const set = intOf(reading.setCode);
    return number ? { number, set: set && set < 100 ? set : null } : null;
  },

  async findPrints(reading, query, deps = {}) {
    let cards = [];
    if (query?.set) cards = await searchCards(`set_num=${query.set};card_num=${query.number}`, deps);
    if (!cards.length && reading.name) {
      const byName = await searchCards(`name~${reading.name.split(' - ')[0]}`, deps);
      cards = byName.filter((c) => !query || Number(c.Card_Num) === query.number);
    }
    const prints = cards.filter((c) => c && c.Unique_ID).slice(0, MAX_PRINTS).map(mapLorcanaCard);
    // lorcana-api.com is English: a name printed in another language cannot be compared
    const english = !reading.language || reading.language === 'en';
    return { prints, names: english ? prints.map((p) => p.name) : null };
  },

  keysOf: (print) => [print.external_id],

  /** key: a Unique_ID, e.g. "SSK-123". */
  async sample(key, deps = {}) {
    const card = (await searchCards(`unique_id=${key}`, deps))[0];
    return card ? mapLorcanaCard(card) : null;
  },

  // exported for tests
  cardNumberOf,
};
