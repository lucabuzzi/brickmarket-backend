/**
 * cardSets.js — the expansion ("set") catalog engine shared by every trading-card game that has one.
 *
 * A game plugs in a provider (tcgdex.js for Pokémon, scryfall.js for Magic, onepieceApi.js for One Piece):
 *
 *   {
 *     game: 'pokemon',
 *     tag: 'TCGdex',                       // for log lines
 *     setsTtlDays, cardsTtlDays,           // default 7 / 30
 *     nameFixes: { '<set id>': { name } }, // typos in the source, repaired on every read (optional)
 *     refetchWhenNoDate: false,            // true when the release date only comes with the cards
 *     cardsComplete: false,                // true when set listings carry the whole card (no later lookup needed)
 *     fetchSetRows(): Promise<row[]>       // every expansion as card_sets rows (see upsertSets), [] on failure
 *     fetchSetCards(set): Promise<{ cards: row[], patch }|null>  // master_cards rows + { release_date, card_count_* }
 *   }
 *
 * The engine fills the card_sets table on first use, refreshes it in the background when it is older than the TTL,
 * fetches the cards of an expansion the first time it is opened, and serves whatever is cached when the source is
 * down. Nothing here knows about a particular API.
 */
const { query } = require('../db');

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Pure helpers (exported for tests) ──────────────────────────────────────────────────────────────

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── The engine ────────────────────────────────────────────────────────────────────────────────────

function createCardSetsService(provider) {
  const game = provider.game;
  const tag = provider.tag || game;
  const setsTtlDays = provider.setsTtlDays ?? 7;
  const cardsTtlDays = provider.cardsTtlDays ?? 30;
  const nameFixes = provider.nameFixes || {};
  const applyNameFix = (row) => (nameFixes[row.id] ? { ...row, ...nameFixes[row.id] } : row);

  async function upsertSets(rows) {
    if (!rows.length) return;
    await query(
      `INSERT INTO card_sets (game, id, series_id, series_name, series_name_en, name, name_en, logo,
                              card_count_total, card_count_official, release_date, sort_order, fetched_at)
       SELECT x.game, x.id, x.series_id, x.series_name, x.series_name_en, x.name, x.name_en, x.logo,
              x.card_count_total, x.card_count_official, x.release_date, x.sort_order, NOW()
       FROM jsonb_to_recordset($1::jsonb) AS x(game text, id text, series_id text, series_name text, series_name_en text,
              name text, name_en text, logo text, card_count_total int, card_count_official int, release_date date, sort_order int)
       ON CONFLICT (game, id) DO UPDATE SET
         series_id = EXCLUDED.series_id, series_name = EXCLUDED.series_name, series_name_en = EXCLUDED.series_name_en,
         name = EXCLUDED.name, name_en = COALESCE(EXCLUDED.name_en, card_sets.name_en),
         logo = COALESCE(EXCLUDED.logo, card_sets.logo),
         card_count_total = COALESCE(EXCLUDED.card_count_total, card_sets.card_count_total),
         card_count_official = COALESCE(EXCLUDED.card_count_official, card_sets.card_count_official),
         release_date = COALESCE(EXCLUDED.release_date, card_sets.release_date),
         sort_order = EXCLUDED.sort_order, fetched_at = NOW()`,
      [JSON.stringify(rows)]
    );
  }

  let refreshing = null;

  /** Reads every expansion from the source into card_sets. One refresh at a time. Resolves to the row count. */
  function refreshSets() {
    if (!refreshing) {
      refreshing = doRefreshSets().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function doRefreshSets() {
    const rows = (await provider.fetchSetRows()).map((r) => applyNameFix({ ...r, game }));
    if (!rows.length) return 0;
    await upsertSets(rows);
    return rows.length;
  }

  /** True when a stored expansion still has a name that nameFixes corrects (so the next refresh will repair it). */
  async function hasWrongNames() {
    const ids = Object.keys(nameFixes);
    if (!ids.length) return false;
    const r = await query('SELECT id, name FROM card_sets WHERE game = $1 AND id = ANY($2)', [game, ids]);
    return r.rows.some((row) => nameFixes[row.id] && row.name !== nameFixes[row.id].name);
  }

  /** First use fills the table (waits); afterwards a stale table is refreshed in the background. */
  async function ensureSets() {
    const r = await query('SELECT COUNT(*)::int AS n, MAX(fetched_at) AS last FROM card_sets WHERE game = $1', [game]);
    const { n, last } = r.rows[0];
    let stale = !last || Date.now() - new Date(last).getTime() > setsTtlDays * DAY_MS;
    if (n > 0 && !stale) stale = await hasWrongNames();
    if (n === 0) {
      await refreshSets().catch((err) => console.error(`[${tag}] refresh failed:`, err.message));
    } else if (stale) {
      refreshSets().catch((err) => console.error(`[${tag}] background refresh failed:`, err.message));
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
      [game]
    );
    return groupBySeries(r.rows);
  }

  /**
   * Stores cards that came from an expansion listing or a search.
   *  - partial (default): never wipes the rarity/details a full lookup already stored (TCGdex lists carry no rarity)
   *  - complete: the rows are whole cards and replace what is stored
   */
  async function upsertListRows(rows, { complete = provider.cardsComplete === true } = {}) {
    if (!rows.length) return;
    const conflict = complete
      ? `name = EXCLUDED.name, set_code = EXCLUDED.set_code, set_name = COALESCE(EXCLUDED.set_name, master_cards.set_name),
         rarity = COALESCE(EXCLUDED.rarity, master_cards.rarity), img_url = COALESCE(EXCLUDED.img_url, master_cards.img_url),
         details = EXCLUDED.details, fetched_at = NOW()`
      : `name = EXCLUDED.name, set_code = EXCLUDED.set_code, set_name = COALESCE(EXCLUDED.set_name, master_cards.set_name),
         rarity = COALESCE(EXCLUDED.rarity, master_cards.rarity), img_url = COALESCE(EXCLUDED.img_url, master_cards.img_url),
         details = master_cards.details || jsonb_build_object('localId', EXCLUDED.details->'localId')`;
    await query(
      `INSERT INTO master_cards (game, external_id, name, set_code, set_name, rarity, img_url, details, fetched_at)
       SELECT $1, x.external_id, x.name, x.set_code, x.set_name, x.rarity, x.img_url, x.details, NOW()
       FROM jsonb_to_recordset($2::jsonb) AS x(external_id text, name text, set_code text, set_name text, rarity text, img_url text, details jsonb)
       ON CONFLICT (game, external_id) DO UPDATE SET ${conflict}`,
      [game, JSON.stringify(rows)]
    );
  }

  /**
   * One expansion with its cards (in collector-number order), or null if the id is unknown.
   * The cards are fetched from the source the first time, then every cardsTtlDays.
   */
  async function getSet(id) {
    await ensureSets();
    const found = await query('SELECT * FROM card_sets WHERE game = $1 AND lower(id) = lower($2)', [game, String(id)]);
    let set = found.rows[0];
    if (!set) return null;

    const age = set.cards_fetched_at ? Date.now() - new Date(set.cards_fetched_at).getTime() : Infinity;
    if (age > cardsTtlDays * DAY_MS || (provider.refetchWhenNoDate && !set.release_date)) {
      const data = await provider.fetchSetCards(set);
      if (data && Array.isArray(data.cards)) {
        await upsertListRows(data.cards);
        const p = data.patch || {};
        const updated = await query(
          `UPDATE card_sets SET release_date = COALESCE($3::date, release_date),
                  card_count_total = COALESCE($4, card_count_total), card_count_official = COALESCE($5, card_count_official),
                  cards_fetched_at = NOW()
           WHERE game = $1 AND id = $2 RETURNING *`,
          [game, set.id, p.release_date || null, p.card_count_total ?? null, p.card_count_official ?? null]
        );
        set = updated.rows[0] || set;
      }
    }

    const cards = (await query('SELECT * FROM master_cards WHERE game = $1 AND lower(set_code) = lower($2)', [game, set.id])).rows;
    cards.sort((a, b) => compareLocalId(String(a.details?.localId ?? ''), String(b.details?.localId ?? ''))
      || String(a.details?.variant ?? '').localeCompare(String(b.details?.variant ?? ''), 'en', { numeric: true }));
    return { set, cards };
  }

  return { game, refreshSets, ensureSets, listSets, getSet, upsertListRows, hasWrongNames };
}

module.exports = { createCardSetsService, groupBySeries, compareLocalId, mapLimit, sleep, DAY_MS };
