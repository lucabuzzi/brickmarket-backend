// The static, publicly indexable pages of the site, kept in sync with the route table in client/src/App.jsx.
// A module of its own (no database import) so scripts can read the list without opening a connection.
// /privacy and /cookie-policy join the sitemap only once their texts are final (see legalPages.json's _comment).
const legalPages = require('../../client/src/config/legalPages.json');

/** Static, publicly indexable pages — kept in sync with the route table in client/src/App.jsx */
const STATIC_PATHS = [
  '/',
  '/catalog',
  '/catalog/lego',
  '/catalog/magic',
  '/catalog/yugioh',
  '/catalog/lorcana',
  '/catalog/pokemon',
  '/catalog/onepiece',
  '/catalog/dragonball',
  '/catalog/funko',
  '/annunci',
  '/annunci/lego',
  '/annunci/funko',
  '/annunci/carte-collezionabili',
  '/annunci/carte-collezionabili/pokemon',
  '/annunci/carte-collezionabili/magic',
  '/annunci/carte-collezionabili/lorcana',
  '/annunci/carte-collezionabili/yugioh',
  '/annunci/carte-collezionabili/onepiece',
  '/annunci/carte-collezionabili/dragonball',
  '/aste',
  '/aste/lego',
  '/aste/funko',
  '/aste/carte-collezionabili',
  '/aste/carte-collezionabili/pokemon',
  '/aste/carte-collezionabili/magic',
  '/aste/carte-collezionabili/lorcana',
  '/aste/carte-collezionabili/yugioh',
  '/aste/carte-collezionabili/onepiece',
  '/aste/carte-collezionabili/dragonball',
  '/come-funziona',
  '/skill-zone',
  '/faq',
  '/help',
  '/norme-legali',
  '/ricerca-utente',
  ...(legalPages.published ? ['/privacy', '/cookie-policy'] : []),
  ...(legalPages.accessibilityPublished ? ['/accessibilita'] : []),
];

module.exports = { STATIC_PATHS };
