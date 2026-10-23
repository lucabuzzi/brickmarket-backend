// The Express application: security headers, webhooks, body parsing, rate limiting, every /api router and the
// built React client. Only wiring, in a deliberate order (tests check parts of it):
//   1. trust proxy (before anything reads req.ip)
//   2. helmet + CSP + CORS + cookies
//   3. webhooks with the RAW body (signatures are verified on the bytes) — before express.json
//   4. health probe — before express.json and the global rate limiter
//   5. express.json, global rate limiter, /uploads
//   6. API routers (order matters where paths overlap: /api/admin, /api/catalog/<game> before /api/catalog)
//   7. SEO files, locale redirects, static client, SPA fallback, error handler
// The HTTP server, the WebSockets and the background jobs are in server.js.
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const payments = require('./routes/payments');
const { createSpaFallback } = require('./routes/spaFallback');
const { localeRedirect } = require('./routes/localeRedirect');
const { parseTrustProxyHops } = require('./utils/trustProxy');

const ROOT = path.join(__dirname, '..');

// Verified via Content-Security-Policy-Report-Only against the production build
// (home, login/Turnstile, cart) with zero violations: neither our own code (no
// eval/Function/inline <script>, JSON-LD blocks aren't script-src-governed) nor
// Cloudflare Turnstile need 'unsafe-eval'/'unsafe-inline', and Stripe.js's own
// documented CSP requirements don't list them either. Kept permissive outside
// production as a safety margin, since this header is only relevant when Express
// serves the built client directly — the Vite dev server on :5173 doesn't go
// through this middleware at all.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const scriptSrc = IS_PRODUCTION
  ? "script-src 'self' https://challenges.cloudflare.com https://js.stripe.com;"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://js.stripe.com;";

/**
 * @param {object} deps
 * @param {Function} deps.broadcast           Live Hub broadcast (routes read it with app.get('broadcast'))
 * @param {object}   deps.wss                 Live Hub WebSocket server (app.get('wss'))
 * @param {object}   deps.gameChatRepo        game chat repository, shared with the plaza
 * @param {object}   deps.gameChatModerator   game chat moderator, shared with the plaza
 * @param {Function} deps.onGameChatSettingsChanged  called when an admin changes the chat settings
 */
function createApp({ broadcast, wss, gameChatRepo, gameChatModerator, onGameChatSettingsChanged }) {
  const app = express();
  // Behind Render's proxy: make req.ip the real visitor (rate limiting, anti-abuse, geo). See src/utils/trustProxy.js.
  app.set('trust proxy', parseTrustProxyHops(process.env.TRUST_PROXY_HOPS));
  app.set('wss', wss);
  app.set('broadcast', broadcast);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', `${scriptSrc} frame-src https://challenges.cloudflare.com https://js.stripe.com;`);
    next();
  });

  const corsOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);
  app.use(cors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  }));

  app.use(cookieParser());

  // IMPORTANTE: il webhook Stripe deve ricevere il body grezzo (raw)
  app.use('/api/payments/stripe-webhook',
    express.raw({ type: 'application/json' }),
    payments.webhook
  );

  // Webhook Stripe per ClutchVault (solo "featured listing" a pagamento: i crediti
  // non hanno valore monetario, quindi non esiste più nessun ramo che ricarica il wallet)
  app.use('/api/webhooks/stripe',
    express.raw({ type: 'application/json' }),
    require('./routes/stripe')
  );

  // Webhook Sendcloud (aggiornamenti stato spedizione) — stesso motivo degli
  // altri: la firma HMAC va verificata sui byte grezzi, prima che express.json
  // li consumi e li riserializzi.
  app.use('/api/webhooks/sendcloud',
    express.raw({ type: 'application/json' }),
    require('./routes/webhooksSendcloud')
  );

  // Liveness probe (no DB, outside the rate limiter). /api/health kept for existing callers.
  app.get(['/health', '/api/health'], require('./routes/health'));

  app.use(express.json({ limit: '10mb' }));

  // Rate limiting globale (escluso webhook Stripe)
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    skip: (req) => req.originalUrl.includes('/stripe-webhook'),
    message: { error: 'Troppe richieste, riprova tra poco.' },
  }));

  // Serve uploaded local images
  app.use('/uploads', express.static(path.join(ROOT, 'uploads')));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/listings', require('./routes/listings'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/payments', payments.router);
  app.use('/api/shipping', require('./routes/shipping'));
  app.use('/api/shipments', require('./routes/shipments'));
  app.use('/api/addresses', require('./routes/addresses'));
  app.use('/api/cart', require('./routes/cart'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/sets', require('./routes/sets'));
  app.use('/api/reviews', require('./routes/reviews'));
  app.use('/api/support', require('./routes/support'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/admin', require('./routes/adminBadges'));
  app.use('/api/admin/game-chat', require('./routes/adminGameChat').createAdminGameChatRouter({
    repo: gameChatRepo, moderator: gameChatModerator, onSettingsChanged: onGameChatSettingsChanged,
  }));
  app.use('/api/analytics', require('./routes/analyticsTrack'));
  app.use('/api/consent', require('./routes/consent'));
  app.use('/api/geo', require('./routes/geo'));
  app.use('/api/catalog/magic', require('./routes/catalogMagic'));
  app.use('/api/catalog/yugioh', require('./routes/catalogYugioh'));
  app.use('/api/catalog/lorcana', require('./routes/catalogLorcana'));
  app.use('/api/catalog/pokemon', require('./routes/catalogPokemon'));
  app.use('/api/catalog/onepiece', require('./routes/catalogOnepiece'));
  app.use('/api/catalog/dragonball', require('./routes/catalogDragonball'));
  app.use('/api/catalog/funko', require('./routes/catalogFunko'));
  app.use('/api/catalog', require('./routes/catalog'));
  app.use('/api/cards', require('./routes/cardRecognize')); // photo -> card prints

  // ClutchVault (credits wallet + puzzle contests)
  app.use('/api/wallet', require('./routes/wallet'));
  app.use('/api/contest', require('./routes/contest').router);

  app.use(require('./routes/sitemap'));
  app.use(require('./routes/seoFiles')); // /llms.txt, /llms-full.txt, /<INDEXNOW_KEY>.txt

  // ClutchVault: admin puzzle upload, /api/products, /api/auctions (full paths inside)
  app.use(require('./routes/clutchvault'));

  // Serve the built React app (client/dist, produced by `npm run build`) and fall back to
  // index.html for any non-API, non-uploads GET path so React Router's client-side routes
  // (e.g. /product/:id) work on a hard refresh or a direct link, not just via in-app navigation.
  // The fallback rewrites canonical/OG meta tags per-request (and injects Product JSON-LD for
  // listings) since the static template always declares them as "/" — see src/services/seoMeta.js.
  const clientDistPath = path.join(ROOT, 'client', 'dist');
  // index: false -> GET "/" must reach the SPA fallback below (which puts the page text in the HTML and
  // rewrites the meta tags) instead of being answered by express.static with the raw dist/index.html.
  // /index.html is a raw copy of the shell reachable at a second address: send it to "/" with a permanent redirect.
  app.get('/index.html', (req, res) => res.redirect(301, '/'));
  // Old unprefixed structural URLs (and bare "/") -> their real /it or /en URL, before anything else can answer them.
  app.get(/^\/(?!api\/|uploads\/).*/, localeRedirect);
  app.use(express.static(clientDistPath, { index: false }));
  // Unknown URLs and missing listings answer HTTP 404 (with the same shell) — see src/routes/spaFallback.js.
  app.get(/^\/(?!api\/|uploads\/).*/, createSpaFallback(clientDistPath));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
      error: err.message || 'Errore interno del server',
    });
  });

  return app;
}

module.exports = { createApp, IS_PRODUCTION };
