const { createCardCatalogRouter } = require('./cardCatalogRouter');
const lorcanaApi = require('../services/lorcanaApi');

module.exports = createCardCatalogRouter('lorcana', lorcanaApi);
