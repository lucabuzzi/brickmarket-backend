const { createCardCatalogRouter } = require('./cardCatalogRouter');
const onepieceApi = require('../integrations/catalogs/onepieceApi');

module.exports = createCardCatalogRouter('onepiece', onepieceApi);
