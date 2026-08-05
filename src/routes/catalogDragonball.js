const { createCardCatalogRouter } = require('./cardCatalogRouter');
const dragonballApi = require('../services/dragonballApi');

module.exports = createCardCatalogRouter('dragonball', dragonballApi);
