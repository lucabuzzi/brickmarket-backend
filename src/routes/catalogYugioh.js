const { createCardCatalogRouter } = require('./cardCatalogRouter');
const ygoprodeck = require('../services/ygoprodeck');

module.exports = createCardCatalogRouter('yugioh', ygoprodeck);
