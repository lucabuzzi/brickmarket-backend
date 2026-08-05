/**
 * cardCatalog.js — Generic trading-card catalog cache, shared by every TCG
 * adapter (scryfall.js for Magic, ygoprodeck.js for Yu-Gi-Oh!, ...).
 *
 * Mirrors the master_sets cache pattern used for LEGO (rebrickable.js):
 * local DB cache first, upsert on fetch, trigram-assisted fuzzy search with
 * an ILIKE fallback.
 */

const { query } = require('../db');

const CACHE_TTL_DAYS = 30;

/**
 * Returns the most recently indexed cards for a given game.
 */
async function getRecentCards(game, limit = 12) {
  const result = await query(
    'SELECT * FROM master_cards WHERE game = $1 ORDER BY fetched_at DESC LIMIT $2',
    [game, limit]
  );
  return result.rows;
}

/**
 * Returns a cached card row if present and still within the TTL window, else null.
 */
async function getCachedCard(game, externalId) {
  const result = await query(
    `SELECT * FROM master_cards
     WHERE game = $1 AND external_id = $2
       AND fetched_at > NOW() - INTERVAL '${CACHE_TTL_DAYS} days'`,
    [game, externalId]
  );
  return result.rows[0] || null;
}

/**
 * Returns a cached card row regardless of TTL freshness. Used by adapters that
 * have no way to refresh a single card on demand (e.g. funko.js, which is
 * bulk-seeded once) — TTL expiry would otherwise make old rows unreachable.
 */
async function getAnyCard(game, externalId) {
  const result = await query(
    'SELECT * FROM master_cards WHERE game = $1 AND external_id = $2',
    [game, externalId]
  );
  return result.rows[0] || null;
}

/**
 * Upserts a single card into the cache and returns the stored row.
 * `card` shape: { external_id, name, set_code, set_name, rarity, img_url, details }
 */
async function upsertCard(game, card) {
  const result = await query(
    `INSERT INTO master_cards (game, external_id, name, set_code, set_name, rarity, img_url, details, fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (game, external_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       set_code = EXCLUDED.set_code,
       set_name = EXCLUDED.set_name,
       rarity = EXCLUDED.rarity,
       img_url = EXCLUDED.img_url,
       details = EXCLUDED.details,
       fetched_at = NOW()
     RETURNING *`,
    [
      game,
      card.external_id,
      card.name,
      card.set_code || null,
      card.set_name || null,
      card.rarity || null,
      card.img_url || null,
      JSON.stringify(card.details || {}),
    ]
  );
  return result.rows[0];
}

async function bulkUpsertCards(game, cards) {
  return Promise.all(cards.map((c) => upsertCard(game, c)));
}

/**
 * Fuzzy-searches the local cache for a game. Falls back to plain ILIKE if
 * pg_trgm/similarity() isn't available on this database.
 */
async function searchLocalCards(game, q, limit = 5) {
  try {
    const result = await query(
      `SELECT *, similarity(name, $2) as name_sim
       FROM master_cards
       WHERE game = $1 AND (
         name ILIKE $3 OR similarity(name, $2) > 0.3
       )
       ORDER BY
         CASE WHEN name ILIKE $3 THEN 1 ELSE 0 END DESC,
         similarity(name, $2) DESC
       LIMIT $4`,
      [game, q, `${q}%`, limit]
    );
    return result.rows;
  } catch (advancedErr) {
    console.warn(`[cardCatalog:${game}] Advanced search unavailable, using ILIKE fallback:`, advancedErr.message);
    const fallback = await query(
      `SELECT * FROM master_cards WHERE game = $1 AND name ILIKE $2 ORDER BY name LIMIT $3`,
      [game, `%${q}%`, limit]
    );
    return fallback.rows;
  }
}

module.exports = {
  getRecentCards,
  getCachedCard,
  getAnyCard,
  upsertCard,
  bulkUpsertCards,
  searchLocalCards,
  CACHE_TTL_DAYS,
};
