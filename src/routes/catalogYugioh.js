const { createCardCatalogRouter } = require('./cardCatalogRouter');
const ygoprodeck = require('../integrations/catalogs/ygoprodeck');

module.exports = createCardCatalogRouter('yugioh', ygoprodeck);
