const { createCardCatalogRouter } = require('./cardCatalogRouter');
const pokemontcg = require('../services/pokemontcg');

module.exports = createCardCatalogRouter('pokemon', pokemontcg);
