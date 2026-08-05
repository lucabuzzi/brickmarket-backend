const { createCardCatalogRouter } = require('./cardCatalogRouter');
const scryfall = require('../services/scryfall');

module.exports = createCardCatalogRouter('magic', scryfall);
