const { createCardCatalogRouter } = require('./cardCatalogRouter');
const scryfall = require('../integrations/catalogs/scryfall');

module.exports = createCardCatalogRouter('magic', scryfall);
