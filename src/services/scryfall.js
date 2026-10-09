/**
 * scryfall.js — Magic: The Gathering card lookup via the free Scryfall API.
 * No API key required. Scryfall asks integrations to send a descriptive
 * User-Agent and Accept header — see https://scryfall.com/docs/api
 */

const cardCatalog = require('./cardCatalog');
const { createCardSetsService, sleep } = require('./cardSets');

const SCRYFALL_BASE = 'https://api.scryfall.com';
const USER_AGENT = 'BrickMarket/1.0 (BrickMarket collectible catalog)';

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[Scryfall] Network error:', err.message);
    return null;
  }
}

// ── Expansions ─────────────────────────────────────────────────────────────────────────────────────

const GAME = 'magic';

/**
 * Scryfall lists 1000+ "sets": tokens, promos, memorabilia, digital-only products, jokes... Only real products a
 * collector sells cards from are kept. The label is the series the expansion is grouped under (Italian / English).
 */
const SET_TYPES = Object.freeze({
  expansion: { it: 'Espansioni', en: 'Expansions' },
  core: { it: 'Set base', en: 'Core sets' },
  masters: { it: 'Masters', en: 'Masters' },
  commander: { it: 'Commander', en: 'Commander' },
  draft_innovation: { it: 'Innovazioni draft', en: 'Draft innovations' },
  starter: { it: 'Mazzi introduttivi', en: 'Starter sets' },
  duel_deck: { it: 'Duel Deck', en: 'Duel Decks' },
  from_the_vault: { it: 'From the Vault', en: 'From the Vault' },
  premium_deck: { it: 'Premium Deck', en: 'Premium Decks' },
});
const UPCOMING_DAYS = 30; // sets announced further away than this are not listed yet
const CARD_PAGES_MAX = 5; // 175 cards a page: up to 875 cards of one expansion
const PAGE_DELAY_MS = 100; // Scryfall asks for 50-100 ms between requests

const RARITY_LABELS = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', mythic: 'Mythic Rare', special: 'Special', bonus: 'Bonus' };
const rarityLabel = (r) => (r ? RARITY_LABELS[r] || r.charAt(0).toUpperCase() + r.slice(1) : null);

/**
 * Scryfall /sets -> card_sets rows: real products only, oldest first (so sort_order follows the calendar).
 * Names are English only (Scryfall has no Italian set names), like on every Magic site.
 */
function mapScryfallSets(list, now = new Date()) {
  const horizon = new Date(now.getTime() + UPCOMING_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return (list || [])
    .filter((s) => s && !s.digital && SET_TYPES[s.set_type] && s.card_count > 0 && (!s.released_at || s.released_at <= horizon))
    .sort((a, b) => String(a.released_at || '').localeCompare(String(b.released_at || '')) || String(a.name).localeCompare(String(b.name)))
    .map((s, i) => ({
      game: GAME,
      id: String(s.code).toLowerCase(),
      series_id: s.set_type,
      series_name: SET_TYPES[s.set_type].it,
      series_name_en: SET_TYPES[s.set_type].en,
      name: s.name,
      name_en: s.name,
      logo: s.icon_svg_uri || null,
      card_count_total: s.card_count,
      card_count_official: s.card_count,
      release_date: s.released_at || null,
      sort_order: i,
    }));
}

/** A card as listed inside an expansion: slim on purpose (the full card is fetched when it is opened). */
function mapScryfallListCard(card, set) {
  const face = card.card_faces?.[0];
  return {
    external_id: card.id,
    name: card.name,
    set_code: set.id,
    set_name: set.name,
    rarity: rarityLabel(card.rarity),
    img_url: card.image_uris?.normal || face?.image_uris?.normal || null,
    details: { localId: card.collector_number ?? null, type_line: card.type_line || face?.type_line || null, detailed: false },
  };
}

async function fetchSetRows() {
  const data = await fetchJson(`${SCRYFALL_BASE}/sets`);
  return data && Array.isArray(data.data) ? mapScryfallSets(data.data) : [];
}

/** Every print of one expansion, page by page. Any failed page means "no data" (nothing half-filled gets cached). */
async function fetchSetCards(set) {
  let url = `${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(`e:${set.id}`)}&unique=prints&order=set`;
  const cards = [];
  let total = null;
  for (let page = 0; page < CARD_PAGES_MAX && url; page += 1) {
    if (page > 0) await sleep(PAGE_DELAY_MS);
    const data = await fetchJson(url);
    if (!data || !Array.isArray(data.data)) return null;
    total = data.total_cards ?? total;
    cards.push(...data.data.map((c) => mapScryfallListCard(c, set)));
    url = data.has_more ? data.next_page : null;
  }
  return { cards, patch: { card_count_total: total } };
}

const sets = createCardSetsService({
  game: GAME, tag: 'Scryfall', setsTtlDays: 7, cardsTtlDays: 30, refetchWhenNoDate: false, cardsComplete: false,
  fetchSetRows, fetchSetCards,
});
const { listSets, getSet, ensureSets, refreshSets } = sets;

// ── Cards ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Maps a raw Scryfall card object to our generic master_cards row shape.
 */
function mapScryfallCard(card) {
  const face = card.card_faces?.[0];
  const imgUrl = card.image_uris?.normal || face?.image_uris?.normal || null;

  return {
    external_id: card.id,
    name: card.name,
    set_code: card.set ? card.set.toUpperCase() : null,
    set_name: card.set_name || null,
    rarity: rarityLabel(card.rarity),
    img_url: imgUrl,
    details: {
      localId: card.collector_number ?? null,
      detailed: true,
      mana_cost: card.mana_cost || face?.mana_cost || null,
      type_line: card.type_line || face?.type_line || null,
      oracle_text: card.oracle_text || face?.oracle_text || null,
      cmc: card.cmc ?? null,
      priceEur: card.prices?.eur || card.prices?.usd || null,
    },
  };
}

/**
 * Looks up a single card by Scryfall ID, using the DB cache as primary source.
 */
async function lookupCard(externalId) {
  const cached = await cardCatalog.getCachedCard('magic', externalId);
  if (cached && cached.details?.detailed !== false) return cached; // a slim row from an expansion listing is completed below

  const data = await fetchJson(`${SCRYFALL_BASE}/cards/${encodeURIComponent(externalId)}`);
  if (!data || data.object === 'error') return null;

  return cardCatalog.upsertCard('magic', mapScryfallCard(data));
}

/**
 * Searches Scryfall directly for a name query, upserting all matches into the cache.
 */
async function searchCardsExternal(q, limit = 10) {
  const data = await fetchJson(`${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(q)}&order=name`);
  if (!data || !Array.isArray(data.data)) return [];

  const mapped = data.data.slice(0, limit).map(mapScryfallCard);
  return cardCatalog.bulkUpsertCards('magic', mapped);
}

module.exports = {
  lookupCard, searchCardsExternal, listSets, getSet, ensureSets, refreshSets, sets,
  // exported for tests
  mapScryfallSets, mapScryfallListCard, mapScryfallCard, fetchSetCards, rarityLabel, SET_TYPES,
};
