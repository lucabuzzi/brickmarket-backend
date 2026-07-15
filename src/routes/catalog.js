const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { lookupSet, searchSetsExternal } = require('../services/rebrickable');
const { computeMarketValue, CONDITION_MULTIPLIERS } = require('../services/marketValue');

/**
 * GET /api/catalog/recent
 * Returns the last 12 sets added to the master_sets table.
 */
router.get('/recent', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM master_sets ORDER BY fetched_at DESC LIMIT 12'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('CATALOG RECENT ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero dei set recenti.' });
  }
});

/**
 * GET /api/catalog/search?q=...
 * Returns fuzzy matched sets for live suggestions and full search results.
 * Optimized for speed and multilingual ranking across EN, IT, FR, DE.
 */
router.get('/search', async (req, res) => {
  const { q, limit = 5 } = req.query;
  if (!q || q.length < 2) return res.json([]);

  const resultLimit = Math.min(parseInt(limit, 10) || 5, 50);

  try {
    // 1. ADVANCED SEARCH (pg_trgm + multilingual JSONB)
    const result = await query(`
      SELECT 
        set_num, name, year, img_url, num_parts,
        similarity(set_num, $1) as num_sim,
        similarity(COALESCE(immutable_jsonb_values_text(names), name), $1) as name_sim
      FROM master_sets
      WHERE 
        set_num ILIKE $2 OR
        name ILIKE $2 OR
        immutable_jsonb_values_text(names) ILIKE $2 OR
        similarity(set_num, $1) > 0.3 OR
        similarity(COALESCE(immutable_jsonb_values_text(names), name), $1) > 0.3
      ORDER BY 
        CASE WHEN set_num ILIKE $2 THEN 1 ELSE 0 END DESC,
        GREATEST(similarity(set_num, $1), similarity(COALESCE(immutable_jsonb_values_text(names), name), $1)) DESC
      LIMIT $3
    `, [q, `${q}%`, resultLimit]);

    // HYBRID INTELLIGENCE: Trigger external deep scan if local results are low (< 3)
    // Only for queries > 3 chars to optimize API usage
    if (result.rows.length < 3 && q.length > 3) {
      console.info(`[Catalog] Low local density (${result.rows.length} results). Firing Gemini-Rebrickable Deep Scan for "${q}"...`);
      
      const externalResults = await searchSetsExternal(q, resultLimit);
      
      // Merge and remove duplicates (by set_num)
      const merged = [...result.rows];
      const existingNums = new Set(merged.map(r => r.set_num));
      
      externalResults.forEach(ext => {
        if (!existingNums.has(ext.set_num)) {
          merged.push(ext);
        }
      });

      return res.json(merged.slice(0, resultLimit));
    }

    return res.json(result.rows);
  } catch (advancedErr) {
    // FALLBACK SEARCH (standard ILIKE)
    console.warn('[catalog/search] Advanced search unavailable, using ILIKE fallback:', advancedErr.message);
    try {
      const fallbackResult = await query(`
        SELECT set_num, name, year, img_url, num_parts
        FROM master_sets
        WHERE set_num ILIKE $1 OR name ILIKE $1
        ORDER BY CASE WHEN set_num ILIKE $2 THEN 0 ELSE 1 END, set_num
        LIMIT $3
      `, [`%${q}%`, `${q}%`, resultLimit]);

      if (fallbackResult.rows.length === 0) {
        const externalResults = await searchSetsExternal(q, resultLimit);
        return res.json(externalResults);
      }

      return res.json(fallbackResult.rows);
    } catch (fallbackErr) {
      console.error('CATALOG SEARCH ERROR:', fallbackErr.message);
      return res.status(500).json({ error: 'Errore durante la ricerca nel catalogo.' });
    }
  }
});

/**
 * GET /api/catalog/:setNum
 * Public LEGO Catalog Reference Page Data.
 */
router.get('/:setNum', async (req, res) => {
  const { setNum } = req.params;

  try {
    const setData = await lookupSet(setNum);

    if (!setData) {
      return res.status(404).json({ error: 'Set non trovato nel catalogo.' });
    }

    const pricing = computeMarketValue(setData);

    res.json({
      ...setData,
      pricing: {
        ...pricing,
        conditionMultipliers: CONDITION_MULTIPLIERS
      }
    });
  } catch (err) {
    console.error('CATALOG API ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel caricamento del catalogo.' });
  }
});

module.exports = router;