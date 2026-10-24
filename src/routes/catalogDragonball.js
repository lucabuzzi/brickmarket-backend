const { createCardCatalogRouter } = require('./cardCatalogRouter');
const dragonballApi = require('../integrations/catalogs/dragonballApi');

module.exports = createCardCatalogRouter('dragonball', dragonballApi);
