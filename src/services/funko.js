/**
 * funko.js — Funko Pop! catalog adapter.
 *
 * Unlike the other TCG adapters, there is no live query API for Funko
 * products: the open-source dataset (kennymkchan/funko-pop-data on GitHub)
 * is a single ~7MB JSON dump with no name-search endpoint. So the whole
 * dataset is bulk-imported once via `src/db/seed_funko_pop.js` (see that
 * script), and this adapter simply serves everything out of the local
 * master_cards cache — there is no "external deep scan" to fall back to.
 */

const cardCatalog = require('./cardCatalog');

async function lookupCard(externalId) {
  // No per-item API to refresh from — serve whatever was bulk-seeded,
  // ignoring the usual TTL (there is nothing to re-fetch it from).
  return cardCatalog.getAnyCard('funko', externalId);
}

async function searchCardsExternal() {
  // No live query API exists for Funko — nothing to fetch beyond the local cache.
  return [];
}

module.exports = { lookupCard, searchCardsExternal };
