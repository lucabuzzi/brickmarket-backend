const { createCardCatalogRouter } = require('./cardCatalogRouter');
const onepieceApi = require('../services/onepieceApi');

module.exports = createCardCatalogRouter('onepiece', onepieceApi);
