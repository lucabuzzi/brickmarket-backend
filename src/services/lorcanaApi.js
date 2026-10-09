/**
 * lorcanaApi.js — Disney Lorcana card lookup via the free lorcana-api.com API.
 * No API key required. See https://lorcana-api.com/How-To.html
 */

const cardCatalog = require('./cardCatalog');
const { createCardSetsService } = require('./cardSets');

const LORCANA_BASE = 'https://api.lorcana-api.com';

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[Lorcana] Network error:', err.message);
    return null;
  }
}

// ── Expansions ─────────────────────────────────────────────────────────────────────────────────────

const GAME = 'lorcana';
const UPCOMING_DAYS = 30; // sets announced further away than this are not listed yet

const SERIES = Object.freeze({
  main: { it: 'Set principali', en: 'Main sets' },
  quest: { it: "Illumineer's Quest", en: "Illumineer's Quest" },
});

/**
 * lorcana-api.com /sets/all -> card_sets rows, oldest first. The data carries the release date and the card count.
 * "QU1" is the Illumineer's Quest (a co-op product), everything else is a main set.
 */
function mapLorcanaSets(list, now = new Date()) {
  const horizon = new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return (Array.isArray(list) ? list : [])
    .filter((s) => s && s.Set_ID && s.Name && (!s.Release_Date || s.Release_Date <= horizon))
    .sort((a, b) => String(a.Release_Date || '').localeCompare(String(b.Release_Date || '')) || (a.Set_Num ?? 0) - (b.Set_Num ?? 0))
    .map((s, i) => {
      const kind = /^QU/i.test(s.Set_ID) ? 'quest' : 'main';
      return {
        game: GAME, id: s.Set_ID, series_id: kind, series_name: SERIES[kind].it, series_name_en: SERIES[kind].en,
        name: s.Name, name_en: s.Name, logo: null, card_count_total: s.Cards ?? null, card_count_official: s.Cards ?? null,
        release_date: s.Release_Date || null, sort_order: i,
      };
    });
}

async function fetchSetRows() {
  return mapLorcanaSets(await fetchJson(`${LORCANA_BASE}/sets/all`));
}

async function fetchSetCards(set) {
  const data = await fetchJson(`${LORCANA_BASE}/cards/fetch?search=${encodeURIComponent(`set_id=${set.id}`)}`);
  if (!Array.isArray(data)) return null;
  const cards = data.filter((c) => c && c.Unique_ID).map((c) => ({ ...mapLorcanaCard(c), set_code: set.id, set_name: set.name }));
  return { cards, patch: { card_count_total: cards.length } };
}

const sets = createCardSetsService({
  game: GAME, tag: 'Lorcana', setsTtlDays: 7, cardsTtlDays: 30, refetchWhenNoDate: false, cardsComplete: true,
  fetchSetRows, fetchSetCards,
});
const { listSets, getSet, ensureSets, refreshSets } = sets;

// ── Cards ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Maps a raw lorcana-api.com card object to our generic master_cards row shape.
 */
function mapLorcanaCard(card) {
  return {
    external_id: card.Unique_ID,
    name: card.Name,
    set_code: card.Set_ID || null,
    set_name: card.Set_Name || null,
    rarity: card.Rarity || null,
    img_url: card.Image || null,
    details: {
      localId: card.Unique_ID || null,
      type: card.Type || null,
      color: card.Color || null,
      cost: card.Cost ?? null,
      strength: card.Strength ?? null,
      willpower: card.Willpower ?? null,
      lore: card.Lore ?? null,
      body_text: card.Body_Text || null,
      flavor_text: card.Flavor_Text || null,
    },
  };
}

/**
 * Looks up a single card by its Unique_ID (e.g. "TFC-041"), using the DB cache as primary source.
 */
async function lookupCard(externalId) {
  const cached = await cardCatalog.getCachedCard('lorcana', externalId);
  if (cached) return cached;

  const data = await fetchJson(`${LORCANA_BASE}/cards/fetch?search=unique_id~${encodeURIComponent(externalId)}`);
  const card = Array.isArray(data) ? data[0] : null;
  if (!card) return null;

  return cardCatalog.upsertCard('lorcana', mapLorcanaCard(card));
}

/**
 * Searches lorcana-api.com by (partial) name, upserting all matches into the cache.
 */
async function searchCardsExternal(q, limit = 10) {
  const data = await fetchJson(`${LORCANA_BASE}/cards/fetch?search=name~${encodeURIComponent(q)}`);
  const cards = Array.isArray(data) ? data : [];

  const mapped = cards.slice(0, limit).map(mapLorcanaCard);
  return cardCatalog.bulkUpsertCards('lorcana', mapped);
}

module.exports = {
  lookupCard, searchCardsExternal, listSets, getSet, ensureSets, refreshSets, sets,
  // exported for tests
  mapLorcanaSets, mapLorcanaCard, SERIES,
};
