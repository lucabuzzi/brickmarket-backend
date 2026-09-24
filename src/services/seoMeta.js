const { query } = require('../db');
const { buildProductJsonLd, breadcrumbForListing } = require('./seoJsonLd');
const { getRouteMeta } = require('./pageMeta');
const { isKnownRoute } = require('./knownRoutes');
const { buildListingTitle, buildListingDescription } = require('./listingMeta');
const { shellForRoute, shellForListing, shellForNotFound, injectShell } = require('./seoContent');

const BASE_URL = 'https://cardbrix.com';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.jpg`;
const DEFAULT_TITLE = 'CardBrix - LEGO, Trading Cards & Auctions Marketplace';
const DEFAULT_DESCRIPTION =
  "CardBrix is the marketplace for LEGO sets, trading cards and collectibles: buy, sell, bid in live auctions, or win rare items in Puzzle Arena skill contests.";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Keeps a JSON-LD payload from breaking out of its <script> tag if a listing title contains "</script>" */
function escapeForInlineScript(json) {
  return json.replace(/</g, '\\u003c');
}

/** Mirrors client/src/api.js normalizeImageUrl: Cloudinary URLs are absolute already, local uploads are not. */
function resolveImageUrl(url) {
  if (!url || typeof url !== 'string') return DEFAULT_OG_IMAGE;
  if (url.startsWith('http')) return url;
  let path = url.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (path.startsWith('/')) path = path.slice(1);
  if (!path.startsWith('uploads/')) path = `uploads/${path}`;
  return `${BASE_URL}/${path}`;
}

function applyMeta(html, { title, description, canonical, ogImage }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeHtml(canonical);
  const safeOgImage = escapeHtml(ogImage);

  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${safeCanonical}$2`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${safeDescription}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${safeCanonical}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${safeTitle}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${safeDescription}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${safeOgImage}$2`)
    .replace(/(<meta property="og:image:alt" content=")[^"]*(")/, `$1${safeTitle}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${safeTitle}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${safeDescription}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${safeOgImage}$2`)
    .replace(/(<meta name="twitter:image:alt" content=")[^"]*(")/, `$1${safeTitle}$2`);
}

function injectJsonLd(html, obj) {
  const json = escapeForInlineScript(JSON.stringify(obj));
  return html.replace('</head>', `<script type="application/ld+json">${json}</script></head>`);
}

const NOT_FOUND_TITLE = 'Pagina non trovata | CardBrix';
const NOT_FOUND_DESCRIPTION = 'La pagina che cerchi non esiste o è stata spostata. Torna alla home di CardBrix o sfoglia gli annunci.';

/** HTTP 404 + the app shell (so the client renders its not-found page), marked noindex as a second signal. */
function notFoundPage(baseHtml, canonical) {
  const meta = applyMeta(baseHtml, {
    title: NOT_FOUND_TITLE,
    description: NOT_FOUND_DESCRIPTION,
    canonical,
    ogImage: DEFAULT_OG_IMAGE,
  }).replace('</head>', '<meta name="robots" content="noindex"></head>');
  return { status: 404, html: injectShell(meta, shellForNotFound()) };
}

/**
 * Returns a per-request version of the SPA's index.html: the static template always declares
 * canonical/OG as "/", which would tell crawlers every URL on the site is the homepage. This
 * rewrites canonical/og:url to the real path, and for /product/:id fetches the listing so bots
 * and social-share unfurlers (which don't run the client JS that updates these tags) see the
 * actual title, price and photo instead of generic branding.
 */
async function renderPage(reqPath, baseHtml) {
  const canonical = `${BASE_URL}${reqPath === '/' ? '' : reqPath}`;

  // A URL that matches no client route would otherwise get the app shell with HTTP 200 (a "soft 404":
  // Google treats every invented URL as a real page). Answer 404 with the same shell so the client
  // can show its own "not found" page.
  if (!isKnownRoute(reqPath)) return notFoundPage(baseHtml, canonical);

  const productMatch = reqPath.match(/^\/product\/([^/]+)$/);
  if (!productMatch) {
    // Every other route: its own title/description when we have them (see pageMeta.js), else the site default.
    const routeMeta = getRouteMeta(reqPath);
    let html = applyMeta(baseHtml, {
      title: routeMeta ? routeMeta.title : DEFAULT_TITLE,
      description: routeMeta ? routeMeta.description : DEFAULT_DESCRIPTION,
      canonical,
      ogImage: DEFAULT_OG_IMAGE,
    });
    // Page-specific text inside #root for crawlers that do not run JavaScript (see services/seoContent).
    const shell = await shellForRoute(reqPath);
    html = injectShell(html, shell.html);
    if (shell.jsonLd) html = injectJsonLd(html, shell.jsonLd);
    return { status: 200, html };
  }

  const listingId = productMatch[1];
  try {
    const { rows } = await query(
      `SELECT id, title, description, price, current_bid, auction_start, auction_end, type, status, images,
              condition, product_type, game, set_number, theme, year, pieces, box_condition
       FROM listings WHERE id = $1`,
      [listingId]
    );

    if (rows.length === 0) return notFoundPage(baseHtml, canonical);

    const listing = rows[0];
    const isAuction = listing.type === 'auction';
    const effectivePrice = isAuction ? (listing.current_bid ?? listing.auction_start) : listing.price;

    // Sellers' own words when they are enough; short titles/descriptions are completed with facts from
    // the listing (see listingMeta.js), so search results and link previews are never a bare "Froakie".
    const title = buildListingTitle(listing);
    const description = buildListingDescription(listing);
    const ogImage = resolveImageUrl(Array.isArray(listing.images) ? listing.images[0] : null);

    let html = applyMeta(baseHtml, { title, description, canonical, ogImage });

    const images = (Array.isArray(listing.images) ? listing.images : []).slice(0, 5).map(resolveImageUrl);
    html = injectJsonLd(html, buildProductJsonLd({
      listing,
      canonical,
      images: images.length ? images : [ogImage],
      description,
      effectivePrice,
    }));
    html = injectJsonLd(html, breadcrumbForListing(listing, BASE_URL));

    // The listing's own text (title, price, description, details, similar listings) inside #root.
    const shell = await shellForListing(listing, images.length ? images : [ogImage]);
    html = injectShell(html, shell.html);

    return { status: 200, html };
  } catch (err) {
    // Postgres 22P02 = the id is not a valid uuid, so no listing can have it: that is a plain 404.
    if (err.code === '22P02') return notFoundPage(baseHtml, canonical);
    // Any other error (DB down, timeout) says nothing about whether the listing exists: keep serving the
    // app shell as before (the client loads the listing from the API itself) instead of claiming 404.
    console.error('renderPage: errore nel recupero annuncio per meta tag:', err.message);
    const fallback = applyMeta(baseHtml, {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      canonical,
      ogImage: DEFAULT_OG_IMAGE,
    });
    return { status: 200, html: injectShell(fallback, (await shellForRoute(reqPath)).html) };
  }
}

/** Same as renderPage but only the HTML (kept for callers that don't care about the status). */
async function renderIndexHtmlForRequest(reqPath, baseHtml) {
  return (await renderPage(reqPath, baseHtml)).html;
}

module.exports = { renderPage, renderIndexHtmlForRequest, resolveImageUrl };
