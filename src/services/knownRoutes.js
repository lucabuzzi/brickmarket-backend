// The URL paths the React app actually serves (mirror of the <Route path="..."> table in
// client/src/App.jsx, without the leading slash). The server uses it to tell a real page from an
// invented URL: the latter must answer HTTP 404, not 200 (see seoMeta.renderPage).
//
// Keep in sync with App.jsx: tests/not-found.test.js parses App.jsx and fails in both directions
// (a client route missing here, or a route here that the client no longer has).
const KNOWN_ROUTES = [
  '', // the home
  'account', 'accessibilita', 'archive', 'cart', 'come-funziona', 'create-auction', 'crediti', 'crediti/acquista', 'crediti/converti',
  'cookie-policy', 'faq', 'forgot-password', 'help', 'login', 'my-listings', 'my-shipments', 'norme-legali', 'notifications', 'privacy', 'profile', 'register',
  'reset-password', 'ricerca-utente', 'search-results', 'sell', 'sell/cards', 'seller/onboarding-complete', 'seller/onboarding-retry',
  'skill-zone', 'verifica-email',
  'product/:id', 'user/:username', 'category/:slug',
  'admin', 'admin/analytics', 'admin/analytics/calendar', 'admin/archive', 'admin/credit-config', 'admin/disputes',
  'admin/featured-pricing', 'admin/flagged-grants', 'admin/interactions', 'admin/listings', 'admin/payouts',
  'admin/users', 'admin/users/:id', 'admin/wallet-transactions',
  'annunci', 'annunci/lego', 'annunci/funko', 'annunci/carte-collezionabili', 'annunci/carte-collezionabili/:slug',
  'annunci/carte-collezionabili/dragonball', 'annunci/carte-collezionabili/lorcana', 'annunci/carte-collezionabili/magic',
  'annunci/carte-collezionabili/onepiece', 'annunci/carte-collezionabili/pokemon', 'annunci/carte-collezionabili/yugioh',
  'annunci/carte-collezionabili/pokemon/:espansione',
  'aste', 'aste/lego', 'aste/funko', 'aste/carte-collezionabili', 'aste/carte-collezionabili/:slug',
  'aste/carte-collezionabili/dragonball', 'aste/carte-collezionabili/lorcana', 'aste/carte-collezionabili/magic',
  'aste/carte-collezionabili/onepiece', 'aste/carte-collezionabili/pokemon', 'aste/carte-collezionabili/yugioh',
  'aste/carte-collezionabili/pokemon/:espansione',
  'catalog', 'catalog/:slug',
  'catalog/lego', 'catalog/lego/search', 'catalog/lego/:setNum',
  ...['dragonball', 'funko', 'lorcana', 'magic', 'onepiece', 'pokemon', 'yugioh'].flatMap((g) => [`catalog/${g}`, `catalog/${g}/search`, `catalog/${g}/:cardId`]),
];

// "a/:b/c" -> /^a\/[^/]+\/c$/ ; matching is case-insensitive and ignores a trailing slash, like React Router.
const toRegex = (route) => new RegExp(`^${route.split('/').map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/')}$`, 'i');
const MATCHERS = [...new Set(KNOWN_ROUTES)].map(toRegex);

// Pages that exist in the client but whose texts are not final yet (see client/src/config/legalPages.json).
// Until their flag is on they answer like any invented URL: 404 + noindex. They stay in KNOWN_ROUTES so the
// in-sync test with App.jsx keeps working.
const legalPages = require('../../client/src/config/legalPages.json');
const UNPUBLISHED = new Set([
  ...(legalPages.published ? [] : ['privacy', 'cookie-policy']),
  ...(legalPages.accessibilityPublished ? [] : ['accessibilita']),
]);

function isKnownRoute(pathname) {
  const path = String(pathname || '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (UNPUBLISHED.has(path.toLowerCase())) return false;
  return MATCHERS.some((re) => re.test(path));
}

module.exports = { KNOWN_ROUTES, isKnownRoute, UNPUBLISHED };
