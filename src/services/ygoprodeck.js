/**
 * ygoprodeck.js — Yu-Gi-Oh! card lookup via the free YGOPRODeck API.
 * No API key required. See https://ygoprodeck.com/api-guide/
 */

const cardCatalog = require('./cardCatalog');
const { createCardSetsService } = require('./cardSets');

const YGO_BASE = 'https://db.ygoprodeck.com/api/v7';

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[YGOPRODeck] Network error:', err.message);
    return null;
  }
}

// ── Expansions ─────────────────────────────────────────────────────────────────────────────────────

const GAME = 'yugioh';
const UPCOMING_DAYS = 30; // sets announced further away than this are not listed yet
const ID_MAX = 60; // listings.card_set_id and the URL accept up to 60 characters

/** Sets that are not products anyone sells cards from: the single "Sneak Peek Participation Card" handouts. */
const EXCLUDED_SET_NAME = /sneak peek participation card/i;

/**
 * Expansion id: a slug of the name. The set code is NOT unique (142 codes are shared by 531 sets: a main set, its
 * Special Edition, its Sneak Peek...), the name is. If a long name collides after cutting, the code is added.
 */
function slugify(name) {
  return String(name || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function uniqueId(name, code, taken) {
  let id = slugify(name).slice(0, ID_MAX).replace(/-+$/, '') || slugify(code) || 'set';
  if (taken.has(id)) {
    const suffix = `-${slugify(code) || 'x'}`;
    id = `${slugify(name).slice(0, ID_MAX - suffix.length).replace(/-+$/, '')}${suffix}`;
    for (let n = 2; taken.has(id); n += 1) id = `${id.slice(0, ID_MAX - 3)}-${n}`;
  }
  taken.add(id);
  return id;
}

/**
 * YGOPRODeck /cardsets.php -> card_sets rows, oldest first, grouped by release year (there is no "type" in the
 * data). Names are English. No set images: YGOPRODeck asks not to link its images directly.
 */
function mapYugiohSets(list, now = new Date()) {
  const horizon = new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const taken = new Set();
  return (Array.isArray(list) ? list : [])
    .filter((s) => s && s.set_name && !EXCLUDED_SET_NAME.test(s.set_name) && (!s.tcg_date || s.tcg_date <= horizon))
    .sort((a, b) => String(a.tcg_date || '').localeCompare(String(b.tcg_date || '')) || String(a.set_name).localeCompare(String(b.set_name)))
    .map((s, i) => {
      const year = s.tcg_date ? s.tcg_date.slice(0, 4) : null;
      return {
        game: GAME,
        id: uniqueId(s.set_name, s.set_code, taken),
        series_id: year || 'other',
        series_name: year || 'Altro',
        series_name_en: year || 'Other',
        name: s.set_name,
        name_en: s.set_name,
        logo: null,
        // num_of_cards counts PRINTS (Legend of Blue Eyes: 355 for 126 cards), so it is not shown as a number of cards
        card_count_total: null,
        card_count_official: null,
        release_date: s.tcg_date || null,
        sort_order: i,
      };
    });
}

/** "LOB-EN001" -> en, "LOB-I001" -> it, "LOB-001" -> en (the region letters sit between the dash and the digits). */
const REGION_LANGUAGE = { EN: 'en', E: 'en', AE: 'en', F: 'fr', FR: 'fr', G: 'de', DE: 'de', I: 'it', IT: 'it', S: 'es', SP: 'es', P: 'pt', PT: 'pt', J: 'ja', JP: 'ja', K: 'ko', KR: 'ko' };
function languageOfPrintCode(code) {
  const m = /^[A-Z0-9]+-([A-Z]{1,2})\d+/i.exec(String(code || ''));
  return (m && REGION_LANGUAGE[m[1].toUpperCase()]) || 'en';
}

const sanitizeIdPart = (s) => String(s || '').replace(/[^A-Za-z0-9._-]/g, '');

/**
 * One row per PRINT of a card in this expansion (code + rarity), not per card: a seller sells one specific print.
 * The id is "<card id>_<print code>_<rarity code>", e.g. 89631139_LOB-EN001_UR.
 */
function mapYugiohPrints(cards, set) {
  const rows = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    for (const p of card.card_sets || []) {
      if (String(p.set_name).toLowerCase() !== String(set.name).toLowerCase()) continue;
      const rarityCode = sanitizeIdPart(p.set_rarity_code) || sanitizeIdPart(p.set_rarity).slice(0, 8) || 'X';
      rows.push({
        external_id: `${card.id}_${sanitizeIdPart(p.set_code)}_${rarityCode}`,
        name: card.name,
        set_code: set.id,
        set_name: set.name,
        rarity: p.set_rarity || null,
        img_url: card.card_images?.[0]?.image_url || null,
        details: {
          localId: p.set_code || null,
          language: languageOfPrintCode(p.set_code),
          cardId: card.id,
          type: card.type || null,
          race: card.race || null,
          attribute: card.attribute || null,
          level: card.level ?? null,
          atk: card.atk ?? null,
          def: card.def ?? null,
          desc: card.desc || null,
        },
      });
    }
  }
  return rows;
}

async function fetchSetRows() {
  const data = await fetchJson(`${YGO_BASE}/cardsets.php`);
  return mapYugiohSets(data);
}

async function fetchSetCards(set) {
  const data = await fetchJson(`${YGO_BASE}/cardinfo.php?cardset=${encodeURIComponent(set.name)}`);
  if (!data || !Array.isArray(data.data)) return null;
  return { cards: mapYugiohPrints(data.data, set), patch: {} };
}

const sets = createCardSetsService({
  game: GAME, tag: 'YGOPRODeck', setsTtlDays: 7, cardsTtlDays: 30, refetchWhenNoDate: false, cardsComplete: true,
  fetchSetRows, fetchSetCards,
});
const { listSets, getSet, ensureSets, refreshSets } = sets;

// ── Cards ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Maps a raw YGOPRODeck card object to our generic master_cards row shape.
 */
function mapYugiohCard(card) {
  const firstSet = card.card_sets?.[0];

  return {
    external_id: String(card.id),
    name: card.name,
    set_code: firstSet?.set_code || null,
    set_name: firstSet?.set_name || null,
    rarity: firstSet?.set_rarity || null,
    img_url: card.card_images?.[0]?.image_url || null,
    details: {
      type: card.type || null,
      race: card.race || null,
      attribute: card.attribute || null,
      level: card.level ?? null,
      atk: card.atk ?? null,
      def: card.def ?? null,
      desc: card.desc || null,
    },
  };
}

/**
 * Looks up a single card by YGOPRODeck numeric ID, using the DB cache as primary source.
 */
async function lookupCard(externalId) {
  // A print row ("<card id>_<code>_<rarity>") has no source to refresh from on its own: serve it as stored, however old.
  const isPrint = String(externalId).includes('_');
  const cached = isPrint ? await cardCatalog.getAnyCard('yugioh', externalId) : await cardCatalog.getCachedCard('yugioh', externalId);
  if (cached) return cached;

  const data = await fetchJson(`${YGO_BASE}/cardinfo.php?id=${encodeURIComponent(String(externalId).split('_')[0])}`);
  const card = data?.data?.[0];
  if (!card) return null;

  return cardCatalog.upsertCard('yugioh', mapYugiohCard(card));
}

/**
 * Fuzzy name search against YGOPRODeck (the `fname` param does partial matching),
 * upserting all matches into the cache.
 */
async function searchCardsExternal(q, limit = 10) {
  const data = await fetchJson(`${YGO_BASE}/cardinfo.php?fname=${encodeURIComponent(q)}`);
  const cards = Array.isArray(data?.data) ? data.data : [];

  const mapped = cards.slice(0, limit).map(mapYugiohCard);
  return cardCatalog.bulkUpsertCards('yugioh', mapped);
}

module.exports = {
  lookupCard, searchCardsExternal, listSets, getSet, ensureSets, refreshSets, sets,
  // exported for tests
  mapYugiohSets, mapYugiohPrints, slugify, languageOfPrintCode, EXCLUDED_SET_NAME,
};
