/**
 * rebrickable.js — LEGO Set Lookup Service
 *
 * Strategy:
 *   1. Check local `master_sets` cache table first.
 *   2. If cache hit & fetched within CACHE_TTL days → return immediately.
 *   3. If cache miss or stale → call Rebrickable API → upsert into cache → return.
 *   4. If Rebrickable is down or set not found → return null so the caller
 *      can show a graceful fallback (manual entry).
 */

const { query } = require('../db');
const { translateSetName } = require('./gemini');

const REBRICKABLE_BASE = 'https://rebrickable.com/api/v3/lego';
const CACHE_TTL_DAYS = 30; // Refresh cached sets older than 30 days

/**
 * Normalize a raw set number entered by the user.
 * Examples:
 *   "10281"   → "10281-1"  (append default variant suffix)
 *   "10281-1" → "10281-1"  (already correct)
 *   " 10281 " → "10281-1"  (trim whitespace)
 */
function normalizeSetNum(rawSetNum) {
  const trimmed = String(rawSetNum).trim();
  if (/^\d+$/.test(trimmed)) {
    return `${trimmed}-1`;
  }
  return trimmed; // already has suffix like "10281-1" or "75192-1"
}

/**
 * Call the Rebrickable API for a single set.
 * Returns the raw API response object or null on error/not-found.
 *
 * @param {string} setNum — normalized set number, e.g. "10281-1"
 */
async function fetchFromRebrickable(setNum) {
  const apiKey = process.env.REBRICKABLE_API_KEY;
  if (!apiKey) {
    console.warn('[Rebrickable] REBRICKABLE_API_KEY is not set — skipping external lookup.');
    return null;
  }

  const url = `${REBRICKABLE_BASE}/sets/${encodeURIComponent(setNum)}/`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `key ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000), // 8s timeout to avoid hanging
    });

    if (res.status === 404) {
      console.info(`[Rebrickable] Set "${setNum}" not found (404).`);
      return null;
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Rebrickable] API error ${res.status} for "${setNum}": ${body}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error(`[Rebrickable] Network error for "${setNum}":`, err.message);
    return null;
  }
}

/**
 * Maps a raw Rebrickable API response to our `master_sets` schema.
 *
 * Raw API response shape:
 * {
 *   "set_num": "10281-1",
 *   "name": "Bonsai Tree",
 *   "year": 2021,
 *   "theme_id": 598,
 *   "num_parts": 878,
 *   "set_img_url": "https://cdn.rebrickable.com/media/sets/10281-1/...",
 *   "set_url": "https://rebrickable.com/sets/10281-1/...",
 *   "last_modified_dt": "2021-01-03T22:59:23.787Z"
 * }
 */
function mapApiResponseToDb(data) {
  return {
    set_num: data.set_num,
    name: data.name,
    year: data.year ?? null,
    theme_id: data.theme_id ?? null,
    num_parts: data.num_parts ?? null,
    img_url: data.set_img_url ?? null,
    rebrickable_url: data.set_url ?? null,
  };
}

/**
 * Main exported function.
 * Looks up a set by number, using the DB cache as primary source.
 *
 * @param {string} rawSetNum — user-supplied set number (with or without suffix)
 * @returns {object|null} Normalized set data or null if not found/API unavailable
 */
async function lookupSet(rawSetNum) {
  const setNum = normalizeSetNum(rawSetNum);

  // 1. Check local cache
  try {
    const cacheResult = await query(
      `SELECT * FROM master_sets
       WHERE set_num = $1
         AND fetched_at > NOW() - INTERVAL '${CACHE_TTL_DAYS} days'`,
      [setNum]
    );

    if (cacheResult.rows.length > 0) {
      console.info(`[Rebrickable] Cache HIT for "${setNum}".`);
      return cacheResult.rows[0];
    }
  } catch (dbErr) {
    // If the table doesn't exist yet, log a warning but don't crash
    console.warn('[Rebrickable] Could not query master_sets cache:', dbErr.message);
  }

  // 2. Cache miss — call external API
  console.info(`[Rebrickable] Cache MISS for "${setNum}" — calling external API.`);
  const apiData = await fetchFromRebrickable(setNum);

  if (!apiData) {
    // Try without the variant suffix as a fallback (e.g., some old sets use "10281" directly)
    const baseNum = setNum.replace(/-\d+$/, '');
    if (baseNum !== setNum) {
      console.info(`[Rebrickable] Retrying with base number "${baseNum}".`);
      const retryData = await fetchFromRebrickable(baseNum);
      if (!retryData) return null;
      return await upsertAndReturn(mapApiResponseToDb(retryData));
    }
    return null;
  }

  return await upsertAndReturn(mapApiResponseToDb(apiData));
}

/**
 * Search sets externally on Rebrickable.
 * Useful for keywords like "Ford" or "Porsche" when local DB is empty.
 *
 * @param {string} q — search query
 * @param {number} limit — max results
 */
async function searchSetsExternal(q, limit = 10) {
  const apiKey = process.env.REBRICKABLE_API_KEY;
  if (!apiKey) return [];

  const url = `${REBRICKABLE_BASE}/sets/?search=${encodeURIComponent(q)}&page_size=${limit}&ordering=-num_parts`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `key ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results) return [];

    const mapped = data.results.map(mapApiResponseToDb);
    return await bulkUpsertSets(mapped);
  } catch (err) {
    console.error(`[Rebrickable] External search error for "${q}":`, err.message);
    return [];
  }
}

/**
 * Upserts multiple sets into the master_sets cache.
 */
async function bulkUpsertSets(setsData) {
  // Use Promise.all for concurrent ingestion and translation
  return await Promise.all(setsData.map(set => upsertAndReturn(set)));
}

/**
 * Upserts a set into the master_sets cache and returns the stored row.
 * Now with on-the-fly Gemini translation for multilingual support.
 */
async function upsertAndReturn(setData) {
  try {
    // 1. Check if we already have translations
    const existing = await query('SELECT names FROM master_sets WHERE set_num = $1', [setData.set_num]);
    let names = existing.rows[0]?.names;

    // 2. If new or missing translations, trigger Gemini
    if (!names || Object.keys(names).length <= 1) {
      names = await translateSetName(setData.name);
    }

    const result = await query(
      `INSERT INTO master_sets (set_num, name, year, theme_id, num_parts, img_url, rebrickable_url, names, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (set_num)
       DO UPDATE SET
         name = EXCLUDED.name,
         year = EXCLUDED.year,
         theme_id = EXCLUDED.theme_id,
         num_parts = EXCLUDED.num_parts,
         img_url = EXCLUDED.img_url,
         rebrickable_url = EXCLUDED.rebrickable_url,
         names = EXCLUDED.names,
         fetched_at = NOW()
       RETURNING *`,
      [
        setData.set_num,
        setData.name,
        setData.year,
        setData.theme_id,
        setData.num_parts,
        setData.img_url,
        setData.rebrickable_url,
        JSON.stringify(names)
      ]
    );
    return result.rows[0];
  } catch (dbErr) {
    console.error('[Rebrickable] Failed to upsert into master_sets:', dbErr.message);
    return setData;
  }
}

module.exports = { lookupSet, normalizeSetNum, searchSetsExternal, bulkUpsertSets };
