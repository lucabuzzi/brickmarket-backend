// The URL paths the React app actually serves (mirror of the <Route path="..."> table in
// client/src/App.jsx, without the leading slash). The server uses it to tell a real page from an
// invented URL: the latter must answer HTTP 404, not 200 (see seoMeta.renderPage).
//
// Keep in sync with App.jsx: tests/not-found.test.js parses App.jsx and fails in both directions
// (a client route missing here, or a route here that the client no longer has).
//
// The structural/marketing pages (home, annunci/aste hubs, catalog hub, info/legal pages) live at
// /it/... and /en/... only - same shared registry the client resolver (localizedPaths.js) reads -
// so they're generated here as `it/<path>` and `en/<translated path>` instead of being listed once
// in Italian. Everything else (auth, account, product/:id, user/:username, catalog item detail,
// admin/*) is dynamic or non-indexable and keeps its single unprefixed path, exactly as before.
const LOCALIZED_ROUTES = require('../../client/src/config/localizedRoutes.json');
const STRUCTURAL_ENTRIES = Object.entries(LOCALIZED_ROUTES).filter(([k]) => k !== '_comment' && k !== '/');
const STRUCTURAL_ROUTES = [
  'it', 'en', // the localized home (index route inside each locale block)
  ...STRUCTURAL_ENTRIES.flatMap(([itPath, enPath]) => [`it${itPath}`, `en${enPath}`]),
];

const KNOWN_ROUTES = [
  '', // the home
  'account', 'archive', 'cart', 'game', 'create-auction', 'crediti/acquista', 'crediti/converti',
  'forgot-password', 'login', 'my-listings', 'my-shipments', 'notifications', 'profile', 'register',
  'reset-password', 'sell', 'sell/cards', 'seller/onboarding-complete', 'seller/onboarding-retry',
  'verifica-email',
  'product/:id', 'user/:username', 'category/:slug',
  'admin', 'admin/analytics', 'admin/analytics/calendar', 'admin/archive', 'admin/credit-config', 'admin/disputes',
  'admin/featured-pricing', 'admin/flagged-grants', 'admin/interactions', 'admin/listings', 'admin/payouts',
  'admin/users', 'admin/users/:id', 'admin/wallet-transactions',
  'catalog/:slug',
  'catalog/lego/:setNum',
  ...['dragonball', 'funko', 'lorcana', 'magic', 'onepiece', 'pokemon', 'yugioh'].map((g) => `catalog/${g}/:cardId`),
  ...STRUCTURAL_ROUTES,
];

// "a/:b/c" -> /^a\/[^/]+\/c$/ ; matching is case-insensitive and ignores a trailing slash, like React Router.
const toRegex = (route) => new RegExp(`^${route.split('/').map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/')}$`, 'i');
const MATCHERS = [...new Set(KNOWN_ROUTES)].map(toRegex);

// Pages that exist in the client but whose texts are not final yet (see client/src/config/legalPages.json).
// Until their flag is on they answer like any invented URL: 404 + noindex. They stay in KNOWN_ROUTES so the
// in-sync test with App.jsx keeps working.
const legalPages = require('../../client/src/config/legalPages.json');
const UNPUBLISHED = new Set([
  ...(legalPages.published ? [] : ['it/privacy', 'en/privacy', 'it/cookie-policy', 'en/cookie-policy']),
  ...(legalPages.accessibilityPublished ? [] : ['it/accessibilita', 'en/accessibility']),
]);

function isKnownRoute(pathname) {
  const path = String(pathname || '/').replace(/^\/+/, '').replace(/\/+$/, '');
  if (UNPUBLISHED.has(path.toLowerCase())) return false;
  return MATCHERS.some((re) => re.test(path));
}

module.exports = { KNOWN_ROUTES, isKnownRoute, UNPUBLISHED };
