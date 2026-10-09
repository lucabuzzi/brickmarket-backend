const { createCardCatalogRouter } = require('./cardCatalogRouter');
const tcgdex = require('../services/tcgdex');

// /sets and /sets/:id come with the router factory (tcgdex.js exposes listSets / getSet)
module.exports = createCardCatalogRouter('pokemon', tcgdex);
