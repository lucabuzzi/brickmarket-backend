/**
 * cardCatalogRouter.js — Generic Express router factory for trading-card
 * catalogs. Given a `game` slug and its API adapter (scryfall.js, ygoprodeck.js),
 * produces the same /recent, /search, /:id shape used by the LEGO catalog
 * (src/routes/catalog.js), including the "hybrid" local-cache + external
 * deep-scan search behavior.
 */

const express = require('express');
const cardCatalog = require('../services/cardCatalog');

function createCardCatalogRouter(game, service) {
  const router = express.Router();

  // GET /recent
  router.get('/recent', async (req, res) => {
    try {
      const rows = await cardCatalog.getRecentCards(game, 12);
      res.json(rows);
    } catch (err) {
      console.error(`CATALOG ${game} RECENT ERROR:`, err.message);
      res.status(500).json({ error: 'Errore nel recupero delle carte recenti.' });
    }
  });

  // GET /search?q=...&limit=...
  router.get('/search', async (req, res) => {
    const { q, limit = 5 } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const resultLimit = Math.min(parseInt(limit, 10) || 5, 50);

    try {
      const localResults = await cardCatalog.searchLocalCards(game, q, resultLimit);

      // Hybrid: if local density is low, fire an external deep scan and merge.
      if (localResults.length < 3 && q.length > 2) {
        console.info(`[Catalog:${game}] Low local density (${localResults.length} results). Firing external deep scan for "${q}"...`);

        const externalResults = await service.searchCardsExternal(q, resultLimit);

        const merged = [...localResults];
        const existingIds = new Set(merged.map((r) => r.external_id));
        externalResults.forEach((ext) => {
          if (!existingIds.has(ext.external_id)) merged.push(ext);
        });

        return res.json(merged.slice(0, resultLimit));
      }

      return res.json(localResults);
    } catch (err) {
      console.error(`CATALOG ${game} SEARCH ERROR:`, err.message);
      res.status(500).json({ error: 'Errore durante la ricerca nel catalogo.' });
    }
  });

  // GET /:id — public card reference page data
  router.get('/:id', async (req, res) => {
    try {
      const card = await service.lookupCard(req.params.id);
      if (!card) return res.status(404).json({ error: 'Carta non trovata nel catalogo.' });
      res.json(card);
    } catch (err) {
      console.error(`CATALOG ${game} DETAIL ERROR:`, err.message);
      res.status(500).json({ error: 'Errore nel caricamento della carta.' });
    }
  });

  return router;
}

module.exports = { createCardCatalogRouter };
