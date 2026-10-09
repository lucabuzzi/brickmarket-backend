const express = require('express');
const { createCardCatalogRouter } = require('./cardCatalogRouter');
const tcgdex = require('../services/tcgdex');

const router = express.Router();

// GET /sets — every expansion, newest first, grouped by series, with active listing / auction counts
router.get('/sets', async (req, res) => {
  try {
    res.json({ series: await tcgdex.listSets() });
  } catch (err) {
    console.error('CATALOG pokemon SETS ERROR:', err.message);
    res.status(500).json({ error: 'Errore nel recupero delle espansioni.' });
  }
});

// GET /sets/:id — one expansion and its cards (declared before the generic /:id of the card router)
router.get('/sets/:id', async (req, res) => {
  try {
    const data = await tcgdex.getSet(req.params.id);
    if (!data) return res.status(404).json({ error: 'Espansione non trovata.' });
    res.json(data);
  } catch (err) {
    console.error('CATALOG pokemon SET ERROR:', err.message);
    res.status(500).json({ error: "Errore nel caricamento dell'espansione." });
  }
});

router.use(createCardCatalogRouter('pokemon', tcgdex));

module.exports = router;
