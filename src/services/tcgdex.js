/**
 * tcgdex.js — Pokémon expansions and cards from the free TCGdex API (https://api.tcgdex.net, no key needed).
 * Replaces pokemontcg.io as the source for the Pokémon catalog: it exposes the same hierarchy Cardmarket uses
 * (series -> expansion -> card), in Italian and English, with release dates and card images.
 *
 * Fills itself like the LEGO cache (rebrickable.js): the expansion list is read on first use and refreshed in the
 * background when it is older than SETS_TTL_DAYS; the cards of an expansion are fetched the first time it is
 * opened. If TCGdex is down, whatever is cached is served. Prices in TCGdex responses are deliberately ignored.
 *
 * Also exposes lookupCard / searchCardsExternal, the adapter interface of routes/cardCatalogRouter.js.
 */
const { query } = require('../db');
const cardCatalog = require('./cardCatalog');
const { createCardSetsService, groupBySeries, compareLocalId, mapLimit } = require('./cardSets');

const BASE = 'https://api.tcgdex.net/v2';
const GAME = 'pokemon';
const SETS_TTL_DAYS = 7;
const CARDS_TTL_DAYS = 30;
const SERIES_CONCURRENCY = 5;

async function fetchJson(path) {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[TCGdex] Network error:', err.message);
    return null;
  }
}

// ── Pure mappers (exported for tests) ──────────────────────────────────────────────────────────────

/**
 * Names TCGdex gets wrong (its Italian catalog has typos). Applied whenever expansions are read from the API, and
 * a stored row that still has the wrong name makes ensureSets() refresh, so a fix here reaches the database by itself.
 */
const NAME_FIXES = Object.freeze({
  '30th-c': { name: 'Collezione Classica del 30°' }, // TCGdex: "Collzione Classica del 30°"
});
const applyNameFix = (row) => (NAME_FIXES[row.id] ? { ...row, ...NAME_FIXES[row.id] } : row);

/** TCGdex gives an image base URL; the actual file is `<base>/high.webp`. */
const imageUrl = (base) => (base ? `${base}/high.webp` : null);

/** "30th-001" + "001" -> "30th" ; "sv3pt5-12" + "12" -> "sv3pt5". */
function setIdOfCard(cardId, localId) {
  const suffix = `-${localId}`;
  if (localId && cardId.endsWith(suffix)) return cardId.slice(0, -suffix.length);
  return cardId.replace(/-[^-]*$/, '');
}

/**
 * Rows for card_sets from one series (Italian + English detail). `startOrder` keeps the global chronology:
 * the series arrive oldest first and so do the sets inside them.
 */
function mapSeriesSets(seriesIt, seriesEn, startOrder) {
  const english = new Map((seriesEn?.sets || []).map((s) => [s.id, s]));
  return (seriesIt?.sets || []).map((s, i) => ({
    game: GAME,
    id: s.id,
    series_id: seriesIt.id,
    series_name: seriesIt.name || null,
    series_name_en: seriesEn?.name || null,
    name: s.name,
    name_en: english.get(s.id)?.name || null,
    logo: s.logo || null,
    card_count_total: s.cardCount?.total ?? null,
    card_count_official: s.cardCount?.official ?? null,
    sort_order: startOrder + i,
  })).map(applyNameFix);
}

/** A card as listed inside an expansion (no rarity there; it is read when the card itself is opened). */
function mapSetListCard(card, set) {
  return {
    external_id: card.id,
    name: card.name,
    set_code: set.id,
    set_name: set.name,
    rarity: null,
    img_url: imageUrl(card.image),
    details: { localId: card.localId ?? null, detailed: false },
  };
}

/** A full card (GET /cards/:id) -> master_cards row shape. Prices are not copied. */
function mapCardDetail(card) {
  return {
    external_id: card.id,
    name: card.name,
    set_code: card.set?.id || setIdOfCard(card.id, card.localId),
    set_name: card.set?.name || null,
    rarity: card.rarity || null,
    img_url: imageUrl(card.image),
    details: {
      localId: card.localId ?? null,
      category: card.category || null,
      hp: card.hp ?? null,
      types: (card.types || []).join(', ') || null,
      illustrator: card.illustrator || null,
      detailed: true,
    },
  };
}

// ── Expansions (card_sets): the provider the shared engine (cardSets.js) runs on ─────────────────────

/** Every series and expansion, Italian + English, oldest first (the order of the source is chronological). */
async function fetchSetRows() {
  const list = await fetchJson('/it/series');
  if (!Array.isArray(list) || !list.length) return [];

  const details = await mapLimit(list, SERIES_CONCURRENCY, async (s) => ({
    it: await fetchJson(`/it/series/${encodeURIComponent(s.id)}`),
    en: await fetchJson(`/en/series/${encodeURIComponent(s.id)}`),
  }));

  const rows = [];
  for (const d of details) {
    if (d.it) rows.push(...mapSeriesSets(d.it, d.en, rows.length));
  }
  return rows;
}

/** The cards of one expansion (and its release date, which the series listing does not carry). */
async function fetchSetCards(set) {
  const data = await fetchJson(`/it/sets/${encodeURIComponent(set.id)}`);
  if (!data || !Array.isArray(data.cards)) return null;
  return {
    cards: data.cards.map((c) => mapSetListCard(c, set)),
    patch: { release_date: data.releaseDate || null, card_count_total: data.cardCount?.total ?? null, card_count_official: data.cardCount?.official ?? null },
  };
}

const sets = createCardSetsService({
  game: GAME, tag: 'TCGdex', setsTtlDays: SETS_TTL_DAYS, cardsTtlDays: CARDS_TTL_DAYS,
  nameFixes: NAME_FIXES, refetchWhenNoDate: true, cardsComplete: false,
  fetchSetRows, fetchSetCards,
});
const { listSets, getSet, refreshSets, ensureSets, upsertListRows } = sets;

// ── Card adapter (interface of routes/cardCatalogRouter.js) ──────────────────────────────────────────

/**
 * A single card by TCGdex id. A cached row is enough unless it only came from an expansion listing (no rarity yet):
 * then the full card is fetched. Rows cached earlier from pokemontcg.io keep working as they are.
 */
async function lookupCard(externalId) {
  const cached = await cardCatalog.getAnyCard(GAME, externalId);
  if (cached && cached.details?.detailed !== false) return cached;

  const data = await fetchJson(`/it/cards/${encodeURIComponent(externalId)}`);
  if (!data || !data.id) return cached || null;
  return cardCatalog.upsertCard(GAME, mapCardDetail(data));
}

async function searchCardsExternal(q, limit = 10) {
  const data = await fetchJson(`/it/cards?name=${encodeURIComponent(q)}`);
  const cards = Array.isArray(data) ? data.slice(0, limit) : [];
  if (!cards.length) return [];

  const setIds = [...new Set(cards.map((c) => setIdOfCard(c.id, c.localId)))];
  const names = new Map(
    (await query('SELECT id, name FROM card_sets WHERE game = $1 AND id = ANY($2)', [GAME, setIds])).rows.map((r) => [r.id, r.name])
  );
  const rows = cards.map((c) => {
    const setId = setIdOfCard(c.id, c.localId);
    return mapSetListCard(c, { id: setId, name: names.get(setId) || null });
  });
  await upsertListRows(rows);
  const stored = await query('SELECT * FROM master_cards WHERE game = $1 AND external_id = ANY($2)', [GAME, rows.map((r) => r.external_id)]);
  return stored.rows;
}

module.exports = {
  lookupCard, searchCardsExternal, listSets, getSet, refreshSets, ensureSets,
  // for the routes/sitemap/tests
  sets,
  // exported for tests
  imageUrl, setIdOfCard, NAME_FIXES, applyNameFix, mapSeriesSets, mapSetListCard, mapCardDetail, groupBySeries, compareLocalId,
  SETS_TTL_DAYS, CARDS_TTL_DAYS,
};
