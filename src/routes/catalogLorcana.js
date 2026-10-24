const { createCardCatalogRouter } = require('./cardCatalogRouter');
const lorcanaApi = require('../integrations/catalogs/lorcanaApi');

module.exports = createCardCatalogRouter('lorcana', lorcanaApi);
