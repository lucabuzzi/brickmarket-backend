/**
 * onepieceApi.js — One Piece Card Game lookup via the free optcgapi.com API.
 * No API key required. See https://optcgapi.com/documentation
 */

const cardCatalog = require('./cardCatalog');
const { createCardSetsService } = require('./cardSets');

const OPTCG_BASE = 'https://optcgapi.com/api';

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[OPTCG] Network error:', err.message);
    return null;
  }
}

// ── Expansions ─────────────────────────────────────────────────────────────────────────────────────

const GAME = 'onepiece';

const SERIES = Object.freeze({
  booster: { it: 'Booster', en: 'Booster packs' },
  extra: { it: 'Extra Booster', en: 'Extra Boosters' },
  starter: { it: 'Starter Deck', en: 'Starter Decks' },
});

/** "OP-01" -> booster, "EB-01" -> extra booster, "ST-01" -> starter deck. */
function seriesOf(id) {
  if (/^ST/i.test(id)) return 'starter';
  if (/^EB/i.test(id)) return 'extra';
  return 'booster';
}

const RARITY_LABELS = { C: 'Common', UC: 'Uncommon', R: 'Rare', SR: 'Super Rare', SEC: 'Secret Rare', L: 'Leader', SP: 'Special', P: 'Promo', TR: 'Treasure Rare' };
const rarityLabel = (r) => (r ? RARITY_LABELS[String(r).toUpperCase()] || r : null);

/**
 * optcgapi /allSets/ and /allDecks/ -> card_sets rows. Neither has dates, but both lists are in release order:
 * the starter decks (older) first, then the sets, so sort_order still means "newer = higher".
 */
function mapOnePieceSets(setList, deckList) {
  const decks = (Array.isArray(deckList) ? deckList : []).filter((d) => d && d.structure_deck_id)
    .map((d) => ({ id: d.structure_deck_id, name: d.structure_deck_name || d.structure_deck_id }));
  const boosters = (Array.isArray(setList) ? setList : []).filter((s) => s && s.set_id)
    .map((s) => ({ id: s.set_id, name: s.set_name || s.set_id }));
  return [...decks, ...boosters].map((s, i) => {
    const kind = seriesOf(s.id);
    return {
      game: GAME, id: s.id, series_id: kind, series_name: SERIES[kind].it, series_name_en: SERIES[kind].en,
      name: s.name, name_en: s.name, logo: null, card_count_total: null, card_count_official: null, release_date: null, sort_order: i,
    };
  });
}

async function fetchSetRows() {
  const [setList, deckList] = await Promise.all([fetchJson(`${OPTCG_BASE}/allSets/`), fetchJson(`${OPTCG_BASE}/allDecks/`)]);
  return mapOnePieceSets(setList, deckList);
}

/** Cards of one expansion; the parallel (alternative art) prints are separate rows, flagged by "variant". */
async function fetchSetCards(set) {
  const kind = seriesOf(set.id) === 'starter' ? 'decks' : 'sets';
  const data = await fetchJson(`${OPTCG_BASE}/${kind}/${encodeURIComponent(set.id)}/`);
  if (!Array.isArray(data)) return null;
  const cards = data.map((c) => ({ ...mapOnePieceCard(c), set_code: set.id, set_name: set.name }));
  return { cards, patch: { card_count_total: new Set(cards.map((c) => c.details.localId)).size } };
}

const sets = createCardSetsService({
  game: GAME, tag: 'OPTCG', setsTtlDays: 7, cardsTtlDays: 30, refetchWhenNoDate: false, cardsComplete: true,
  fetchSetRows, fetchSetCards,
});
const { listSets, getSet, ensureSets, refreshSets } = sets;

// ── Cards ──────────────────────────────────────────────────────────────────────────────────────────

/** "OP01-077_p2" -> "2" (second alternative print); the base card -> null. */
const variantOf = (cardImageId) => {
  const m = /_p(\d+)$/i.exec(String(cardImageId || ''));
  return m ? m[1] : null;
};

/**
 * Maps a raw optcgapi.com card object to our generic master_cards row shape.
 */
function mapOnePieceCard(card) {
  return {
    external_id: card.card_image_id || card.card_set_id,
    name: card.card_name,
    set_code: card.set_id || null,
    set_name: card.set_name || null,
    rarity: rarityLabel(card.rarity),
    img_url: card.card_image || null,
    details: {
      localId: card.card_set_id || null,
      variant: variantOf(card.card_image_id),
      type: card.card_type || null,
      color: card.card_color || null,
      cost: card.card_cost ?? null,
      power: card.card_power ?? null,
      life: card.life ?? null,
      attribute: card.attribute || null,
      sub_types: card.sub_types || null,
      card_text: card.card_text || null,
    },
  };
}

/**
 * Looks up a single card by its card_image_id (e.g. "OP01-024" or "OP01-024_p1"),
 * using the DB cache as primary source.
 */
async function lookupCard(externalId) {
  const cached = await cardCatalog.getCachedCard('onepiece', externalId);
  if (cached) return cached;

  // optcgapi's per-card endpoint is keyed on the base card_set_id (no parallel suffix)
  const baseId = externalId.replace(/_p\d+$/, '');
  const data = await fetchJson(`${OPTCG_BASE}/sets/card/${encodeURIComponent(baseId)}/`);
  const variants = Array.isArray(data) ? data : [];
  const card = variants.find((v) => v.card_image_id === externalId) || variants[0];
  if (!card) return null;

  return cardCatalog.upsertCard('onepiece', mapOnePieceCard(card));
}

/**
 * Searches optcgapi.com by (partial) name, upserting all matches into the cache.
 */
async function searchCardsExternal(q, limit = 10) {
  const data = await fetchJson(`${OPTCG_BASE}/sets/filtered/?card_name=${encodeURIComponent(q)}`);
  const cards = Array.isArray(data) ? data : [];

  const mapped = cards.slice(0, limit).map(mapOnePieceCard);
  return cardCatalog.bulkUpsertCards('onepiece', mapped);
}

module.exports = {
  lookupCard, searchCardsExternal, listSets, getSet, ensureSets, refreshSets, sets,
  // exported for tests
  mapOnePieceSets, mapOnePieceCard, variantOf, seriesOf, rarityLabel, SERIES,
};
