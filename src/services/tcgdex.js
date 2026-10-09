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

const BASE = 'https://api.tcgdex.net/v2';
const GAME = 'pokemon';
const SETS_TTL_DAYS = 7;
const CARDS_TTL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
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
  }));
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

/** Flat rows (newest first) -> [{ id, name, name_en, sets: [...] }] keeping that order. */
function groupBySeries(rows) {
  const groups = [];
  const byId = new Map();
  for (const r of rows) {
    const key = r.series_id || '_';
    if (!byId.has(key)) {
      const g = { id: key, name: r.series_name || r.series_name_en || '', name_en: r.series_name_en || r.series_name || '', sets: [] };
      byId.set(key, g);
      groups.push(g);
    }
    byId.get(key).sets.push(r);
  }
  return groups;
}

/** "001", "12", "TG05", "SWSH062": numbers first in numeric order, then the rest alphabetically. */
function compareLocalId(a, b) {
  const na = /^\d+$/.test(a) ? parseInt(a, 10) : null;
  const nb = /^\d+$/.test(b) ? parseInt(b, 10) : null;
  if (na !== null && nb !== null) return na - nb;
  if (na !== null) return -1;
  if (nb !== null) return 1;
  return String(a).localeCompare(String(b), 'en', { numeric: true });
}

// ── Expansions (card_sets) ─────────────────────────────────────────────────────────────────────────

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

async function upsertSets(rows) {
  if (!rows.length) return;
  await query(
    `INSERT INTO card_sets (game, id, series_id, series_name, series_name_en, name, name_en, logo,
                            card_count_total, card_count_official, sort_order, fetched_at)
     SELECT x.game, x.id, x.series_id, x.series_name, x.series_name_en, x.name, x.name_en, x.logo,
            x.card_count_total, x.card_count_official, x.sort_order, NOW()
     FROM jsonb_to_recordset($1::jsonb) AS x(game text, id text, series_id text, series_name text, series_name_en text,
            name text, name_en text, logo text, card_count_total int, card_count_official int, sort_order int)
     ON CONFLICT (game, id) DO UPDATE SET
       series_id = EXCLUDED.series_id, series_name = EXCLUDED.series_name, series_name_en = EXCLUDED.series_name_en,
       name = EXCLUDED.name, name_en = COALESCE(EXCLUDED.name_en, card_sets.name_en),
       logo = COALESCE(EXCLUDED.logo, card_sets.logo),
       card_count_total = COALESCE(EXCLUDED.card_count_total, card_sets.card_count_total),
       card_count_official = COALESCE(EXCLUDED.card_count_official, card_sets.card_count_official),
       sort_order = EXCLUDED.sort_order, fetched_at = NOW()`,
    [JSON.stringify(rows)]
  );
}

let refreshing = null;

/** Reads every series and expansion from TCGdex into card_sets. One refresh at a time. Resolves to the row count. */
function refreshSets() {
  if (!refreshing) {
    refreshing = doRefreshSets().finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function doRefreshSets() {
  const list = await fetchJson('/it/series');
  if (!Array.isArray(list) || !list.length) return 0;

  const details = await mapLimit(list, SERIES_CONCURRENCY, async (s) => ({
    it: await fetchJson(`/it/series/${encodeURIComponent(s.id)}`),
    en: await fetchJson(`/en/series/${encodeURIComponent(s.id)}`),
  }));

  const rows = [];
  for (const d of details) {
    if (d.it) rows.push(...mapSeriesSets(d.it, d.en, rows.length));
  }
  await upsertSets(rows);
  return rows.length;
}

/** First use fills the table (waits); afterwards a stale table is refreshed in the background. */
async function ensureSets() {
  const r = await query('SELECT COUNT(*)::int AS n, MAX(fetched_at) AS last FROM card_sets WHERE game = $1', [GAME]);
  const { n, last } = r.rows[0];
  const stale = !last || Date.now() - new Date(last).getTime() > SETS_TTL_DAYS * DAY_MS;
  if (n === 0) {
    await refreshSets().catch((err) => console.error('[TCGdex] refresh failed:', err.message));
  } else if (stale) {
    refreshSets().catch((err) => console.error('[TCGdex] background refresh failed:', err.message));
  }
}

/**
 * Every expansion, newest first, grouped by series, with how many active listings / auctions each one has.
 * -> [{ id, name, name_en, sets: [{ id, name, name_en, logo, release_date, card_count_*, listings_count, auctions_count }] }]
 */
async function listSets() {
  await ensureSets();
  const r = await query(
    `SELECT s.id, s.series_id, s.series_name, s.series_name_en, s.name, s.name_en, s.logo, s.release_date,
            s.card_count_total, s.card_count_official,
            COALESCE(c.listings_count, 0)::int AS listings_count, COALESCE(c.auctions_count, 0)::int AS auctions_count
     FROM card_sets s
     LEFT JOIN (
       SELECT card_set_id,
              COUNT(*) FILTER (WHERE NOT (type = 'auction' OR is_auction = true)) AS listings_count,
              COUNT(*) FILTER (WHERE type = 'auction' OR is_auction = true) AS auctions_count
       FROM listings
       WHERE status = 'active' AND game = $1 AND card_set_id IS NOT NULL
       GROUP BY card_set_id
     ) c ON c.card_set_id = s.id
     WHERE s.game = $1
     ORDER BY s.sort_order DESC`,
    [GAME]
  );
  return groupBySeries(r.rows);
}

/** Inserts cards that came from a listing (expansion or search). Never wipes rarity/details a full lookup already stored. */
async function upsertListRows(rows) {
  if (!rows.length) return;
  await query(
    `INSERT INTO master_cards (game, external_id, name, set_code, set_name, rarity, img_url, details, fetched_at)
     SELECT $1, x.external_id, x.name, x.set_code, x.set_name, NULL, x.img_url, x.details, NOW()
     FROM jsonb_to_recordset($2::jsonb) AS x(external_id text, name text, set_code text, set_name text, img_url text, details jsonb)
     ON CONFLICT (game, external_id) DO UPDATE SET
       name = EXCLUDED.name, set_code = EXCLUDED.set_code, set_name = COALESCE(EXCLUDED.set_name, master_cards.set_name),
       img_url = COALESCE(EXCLUDED.img_url, master_cards.img_url),
       details = master_cards.details || jsonb_build_object('localId', EXCLUDED.details->'localId')`,
    [GAME, JSON.stringify(rows)]
  );
}

const upsertSetCards = (set, cards) => upsertListRows(cards.map((c) => mapSetListCard(c, set)));

/**
 * One expansion with its cards (in collector-number order), or null if the id is unknown.
 * The cards are fetched from TCGdex the first time, then every CARDS_TTL_DAYS.
 */
async function getSet(id) {
  await ensureSets();
  const found = await query('SELECT * FROM card_sets WHERE game = $1 AND lower(id) = lower($2)', [GAME, String(id)]);
  let set = found.rows[0];
  if (!set) return null;

  const age = set.cards_fetched_at ? Date.now() - new Date(set.cards_fetched_at).getTime() : Infinity;
  if (age > CARDS_TTL_DAYS * DAY_MS || !set.release_date) {
    const data = await fetchJson(`/it/sets/${encodeURIComponent(set.id)}`);
    if (data && Array.isArray(data.cards)) {
      await upsertSetCards(set, data.cards);
      const updated = await query(
        `UPDATE card_sets SET release_date = COALESCE($3::date, release_date),
                card_count_total = COALESCE($4, card_count_total), card_count_official = COALESCE($5, card_count_official),
                cards_fetched_at = NOW()
         WHERE game = $1 AND id = $2 RETURNING *`,
        [GAME, set.id, data.releaseDate || null, data.cardCount?.total ?? null, data.cardCount?.official ?? null]
      );
      set = updated.rows[0] || set;
    }
  }

  const cards = (await query('SELECT * FROM master_cards WHERE game = $1 AND set_code = $2', [GAME, set.id])).rows;
  cards.sort((a, b) => compareLocalId(String(a.details?.localId ?? ''), String(b.details?.localId ?? '')));
  return { set, cards };
}

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
  // exported for tests
  imageUrl, setIdOfCard, mapSeriesSets, mapSetListCard, mapCardDetail, groupBySeries, compareLocalId,
  SETS_TTL_DAYS, CARDS_TTL_DAYS,
};
