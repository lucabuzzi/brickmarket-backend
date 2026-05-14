const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { lookupSet } = require('../services/rebrickable');
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
 * GET /api/catalog/:setNum
 * Public LEGO Catalog Reference Page Data
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
