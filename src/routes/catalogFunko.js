const { createCardCatalogRouter } = require('./cardCatalogRouter');
const funko = require('../services/funko');

module.exports = createCardCatalogRouter('funko', funko);
