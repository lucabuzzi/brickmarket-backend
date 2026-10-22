/**
 * Yu-Gi-Oh!. Every card prints its set code under the artwork on the right ("LOB-EN001", "RA01-IT045", "SDK-001").
 * YGOPRODeck knows the English codes, so a code in another language is looked up as its English twin (same set, same
 * number); the language stays the one printed. The seller then picks the rarity among the prints of that code.
 * Without a legible code the card is looked up by its (English) name. See https://ygoprodeck.com/api-guide/
 */

const { fetchJson, toDigits } = require('./http');
const { slugify, languageOfPrintCode, mapYugiohPrints, REGION_LANGUAGE } = require('../ygoprodeckCards');

const BASE = 'https://db.ygoprodeck.com/api/v7';
const MAX_PRINTS = 24;

const get = (path, deps) => fetchJson(`${BASE}${path}`, { fetchImpl: deps.fetchImpl, tag: 'YGOPRODeck' });

/** "lob-en 001" / "LOB-ENO01" -> "LOB-EN001"; null when there is no "<set>-<region?><number>" in it. */
function normalizeCode(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[‐-―−_.]/g, '-').replace(/\s+/g, '');
  const m = /([A-Z0-9]{2,5})-([A-Z]{0,2}?)([0-9OQDILZSBG|]{3})(?![0-9])/.exec(s);
  if (!m) return null;
  const region = m[2];
  if (region && !REGION_LANGUAGE[region]) return null;
  const digits = toDigits(m[3]);
  return /^\d{3}$/.test(digits) ? `${m[1]}-${region}${digits}` : null;
}

/** The codes to ask YGOPRODeck for, the English one first: "LOB-IT001" -> LOB-EN001, LOB-IT001, LOB-001, LOB-E001. */
function lookupCodes(code) {
  const m = /^([A-Z0-9]+)-([A-Z]*)(\d{3})$/.exec(code);
  if (!m) return [];
  const [, set, , num] = m;
  return [...new Set([`${set}-EN${num}`, code, `${set}-${num}`, `${set}-E${num}`])];
}

/**
 * The card a print code belongs to, as the catalog stores it. /cardsetsinfo can answer the id of an alternate-artwork
 * record ("Blue-Eyes White Dragon" 89631146) while the expansion listing the catalog is filled from carries the main
 * one (89631139): the card is read by its exact name, so the print ids match the catalog's; by id if that fails.
 */
async function cardFor(info, deps) {
  const byName = info.name ? (await get(`/cardinfo.php?name=${encodeURIComponent(info.name)}`, deps))?.data?.[0] : null;
  if (byName) return byName;
  return (await get(`/cardinfo.php?id=${encodeURIComponent(info.id)}`, deps))?.data?.[0] || null;
}

/** The prints of one card, all or only those of one code, each with its expansion id (the catalog's slug of the name). */
function printsOf(card, code) {
  const bySet = new Map();
  for (const p of card.card_sets || []) if (!code || p.set_code === code) bySet.set(p.set_name, p);
  return [...bySet.keys()].flatMap((name) => mapYugiohPrints([card], { id: slugify(name).slice(0, 60).replace(/-+$/, ''), name }))
    .filter((row) => !code || row.details.localId === code);
}

module.exports = {
  game: 'yugioh',
  title: 'Yu-Gi-Oh! Trading Card Game',
  prompt: [
    '- code: the set code printed under the artwork on the right, e.g. "LOB-EN001", "RA01-IT045", "SDK-001".',
    '- name: the card name as printed at the top.',
    '- rarity, number, setCode: always null for this game.',
  ],

  identify(reading) {
    const code = normalizeCode(reading.code);
    return code ? { code } : null;
  },

  async findPrints(reading, query, deps = {}) {
    let prints = [];
    let card = null;
    if (query) {
      for (const code of lookupCodes(query.code)) {
        const info = await get(`/cardsetsinfo.php?setcode=${encodeURIComponent(code)}`, deps);
        if (!info?.id) continue;
        card = await cardFor(info, deps);
        if (card) prints = printsOf(card, code);
        if (prints.length) break;
      }
    }
    const language = query ? languageOfPrintCode(query.code) : reading.language;
    if (!prints.length && reading.name && (!reading.language || reading.language === 'en')) {
      const exact = await get(`/cardinfo.php?name=${encodeURIComponent(reading.name)}`, deps);
      card = exact?.data?.[0] || (await get(`/cardinfo.php?fname=${encodeURIComponent(reading.name)}`, deps))?.data?.[0] || null;
      if (card) prints = printsOf(card).slice(0, MAX_PRINTS);
    }
    // the database is English: a name printed in another language cannot be compared
    const names = card && language === 'en' ? [card.name] : null;
    return { prints, names, language };
  },

  keysOf: (print) => [print.external_id, print.details?.localId].filter(Boolean),

  /** key: an English set code, e.g. "LOB-EN001". */
  async sample(key, deps = {}) {
    const info = await get(`/cardsetsinfo.php?setcode=${encodeURIComponent(key)}`, deps);
    const card = info?.id ? await cardFor(info, deps) : null;
    if (!card) return null;
    const row = printsOf(card, key)[0];
    return row ? { ...row, img_url: card.card_images?.[0]?.image_url || row.img_url } : null;
  },

  // exported for tests
  normalizeCode, lookupCodes,
};
