const { query } = require('../db');
const { buildProductJsonLd, breadcrumbForListing } = require('./seoJsonLd');
const { getRouteMeta } = require('./pageMeta');
const { isKnownRoute } = require('./knownRoutes');
const { buildListingTitle, buildListingDescription } = require('./listingMeta');
const { shownListingPrice } = require('../utils/fees');
const { shellForRoute, shellForListing, shellForNotFound, injectShell } = require('./seoContent');
const { parseSetPath, fetchSetPageMeta } = require('./seoSetPages');
const { URL_LOCALES, DEFAULT_URL_LOCALE, matchLocalizedRoute, resolveLocalizedPath, fillCanonicalPath } = require('./localizedRoutes');

const BASE_URL = 'https://cardbrix.com';

// Structural pages that stay reachable and crawlable but must not be indexed: thin by nature, no search value
// (the user directory is a list loaded in the browser). `noindex, follow` needs the page to be crawlable, so
// they must NOT be Disallowed in robots.txt. Also left out of the sitemap (see sitemapPaths.js).
const NOINDEX_PATHS = new Set(['/ricerca-utente']);
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.jpg`;
const DEFAULT_TITLE = 'CardBrix - Marketplace di LEGO, carte collezionabili e aste';
const DEFAULT_DESCRIPTION =
  "Il marketplace per set LEGO, carte collezionabili e oggetti da collezione: compra, vendi, rilancia nelle aste live o vinci pezzi rari nella Puzzle Arena.";
const DEFAULT_TITLE_EN = 'CardBrix - LEGO, Trading Cards & Auctions Marketplace';
const DEFAULT_DESCRIPTION_EN =
  'The marketplace for LEGO sets, trading cards and collectibles: buy, sell, bid in live auctions or win rare pieces in the Puzzle Arena.';

/** The locale segment of a request path ("/en/listings" -> "en"), or the default when there isn't one. */
function localeFromPath(reqPath) {
  const seg = String(reqPath || '').split('/')[1];
  return URL_LOCALES.includes(seg) ? seg : DEFAULT_URL_LOCALE;
}

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

function applyMeta(html, { title, description, canonical, ogImage, lang = DEFAULT_URL_LOCALE }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = escapeHtml(canonical);
  const safeOgImage = escapeHtml(ogImage);
  const ogLocale = lang === 'en' ? 'en_US' : 'it_IT';

  return html
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${safeCanonical}$2`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${safeDescription}$2`)
    .replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${ogLocale}$2`)
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

/** hreflang alternates for a structural page that exists at both /it and /en; `alternates` is [{hreflang, href}]. */
function injectAlternates(html, alternates) {
  if (!alternates || !alternates.length) return html;
  const tags = alternates.map(({ hreflang, href }) => `<link rel="alternate" hreflang="${hreflang}" href="${escapeHtml(href)}">`).join('');
  return html.replace('</head>', `${tags}</head>`);
}

/** [{hreflang:'it',href},{hreflang:'en',href},{hreflang:'x-default',href}] for a canonical path, or []. */
function alternatesFor(canonicalPath) {
  const itHref = resolveLocalizedPath(canonicalPath, 'it');
  const enHref = resolveLocalizedPath(canonicalPath, 'en');
  if (!itHref || !enHref) return [];
  return [
    { hreflang: 'it', href: `${BASE_URL}${itHref}` },
    { hreflang: 'en', href: `${BASE_URL}${enHref}` },
    { hreflang: 'x-default', href: `${BASE_URL}${itHref}` },
  ];
}

/** The listing's seller (public username + type), or null: JSON-LD then names CardBrix as the seller. */
async function fetchSeller(listingId) {
  try {
    const res = await query(
      'SELECT u.username, u.seller_type, u.company_name FROM listings l JOIN users u ON u.id = l.seller_id WHERE l.id = $1',
      [listingId]
    );
    const row = res && res.rows && res.rows[0];
    return row && row.username ? { username: row.username, sellerType: row.seller_type, companyName: row.company_name } : null;
  } catch (err) {
    console.error('renderPage: venditore non recuperabile per il JSON-LD:', err.message);
    return null;
  }
}

const NOT_FOUND_TITLE = 'Pagina non trovata | CardBrix';
const NOT_FOUND_DESCRIPTION = 'La pagina che cerchi non esiste o è stata spostata. Torna alla home di CardBrix o sfoglia gli annunci.';
const NOT_FOUND_TITLE_EN = 'Page Not Found | CardBrix';
const NOT_FOUND_DESCRIPTION_EN = "The page you're looking for doesn't exist or has moved. Go back to the CardBrix home page or browse the listings.";

/** HTTP 404 + the app shell (so the client renders its not-found page), marked noindex as a second signal. */
function notFoundPage(baseHtml, canonical, locale = DEFAULT_URL_LOCALE) {
  const meta = applyMeta(baseHtml, {
    title: locale === 'en' ? NOT_FOUND_TITLE_EN : NOT_FOUND_TITLE,
    description: locale === 'en' ? NOT_FOUND_DESCRIPTION_EN : NOT_FOUND_DESCRIPTION,
    canonical,
    ogImage: DEFAULT_OG_IMAGE,
    lang: locale,
  }).replace('</head>', '<meta name="robots" content="noindex"></head>');
  return { status: 404, html: injectShell(meta, shellForNotFound(locale)) };
}

/**
 * Returns a per-request version of the SPA's index.html: the static template always declares
 * canonical/OG as "/", which would tell crawlers every URL on the site is the homepage. This
 * rewrites canonical/og:url to the real path, and for /product/:id fetches the listing so bots
 * and social-share unfurlers (which don't run the client JS that updates these tags) see the
 * actual title, price and photo instead of generic branding.
 */
async function renderPage(reqPath, baseHtml) {
  const canonical = `${BASE_URL}${reqPath}`;

  // A URL that matches no client route would otherwise get the app shell with HTTP 200 (a "soft 404":
  // Google treats every invented URL as a real page). Answer 404 with the same shell so the client
  // can show its own "not found" page.
  if (!isKnownRoute(reqPath)) return notFoundPage(baseHtml, canonical, localeFromPath(reqPath));

  const productMatch = reqPath.match(/^\/product\/([^/]+)$/);
  if (!productMatch) {
    // A structural page lives at /it/... or /en/...: resolve it back to its canonical (Italian) path so
    // pageMeta/seoContent (which only know Italian route shapes) can look it up, with `locale` just picking
    // which text comes back. Anything else (home, or a non-localized route) keeps its own bare path.
    const localeMatch = matchLocalizedRoute(reqPath);
    const locale = localeMatch ? localeMatch.locale : DEFAULT_URL_LOCALE;
    const canonicalPath = localeMatch ? fillCanonicalPath(localeMatch.canonicalPath, localeMatch.params) : reqPath;

    // Every other route: its own title/description when we have them (see pageMeta.js), else the site default.
    let routeMeta = getRouteMeta(canonicalPath, locale);
    if (parseSetPath(canonicalPath)) {
      // Pokémon expansion page: its own meta, and a real 404 for an id that is not an expansion. A database error
      // says nothing about the id, so then the page is served with the default meta instead of claiming 404.
      try {
        const setMeta = await fetchSetPageMeta(canonicalPath, locale);
        if (!setMeta) return notFoundPage(baseHtml, canonical, locale);
        routeMeta = setMeta;
      } catch (err) {
        console.error('renderPage: errore nel recupero espansione per meta tag:', err.message);
      }
    }
    let html = applyMeta(baseHtml, {
      title: routeMeta ? routeMeta.title : (locale === 'en' ? DEFAULT_TITLE_EN : DEFAULT_TITLE),
      description: routeMeta ? routeMeta.description : (locale === 'en' ? DEFAULT_DESCRIPTION_EN : DEFAULT_DESCRIPTION),
      canonical,
      ogImage: DEFAULT_OG_IMAGE,
      lang: locale,
    });
    html = injectAlternates(html, alternatesFor(canonicalPath));
    if (NOINDEX_PATHS.has(canonicalPath)) html = html.replace('</head>', '<meta name="robots" content="noindex, follow"></head>');
    // Page-specific text inside #root for crawlers that do not run JavaScript (see services/seoContent).
    const shell = await shellForRoute(canonicalPath, locale);
    html = injectShell(html, shell.html);
    if (shell.jsonLd) html = injectJsonLd(html, shell.jsonLd);
    return { status: 200, html };
  }

  const listingId = productMatch[1];
  try {
    const { rows } = await query(
      `SELECT id, title, description, price, current_bid, auction_start, auction_end, type, status, images,
              condition, product_type, game, set_number, theme, year, pieces, box_condition, shipping_options,
              card_set_id, card_number
       FROM listings WHERE id = $1`,
      [listingId]
    );

    if (rows.length === 0) return notFoundPage(baseHtml, canonical);

    const listing = rows[0];
    const effectivePrice = shownListingPrice(listing);

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
      seller: await fetchSeller(listingId),
      baseUrl: BASE_URL,
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

module.exports = { renderPage, renderIndexHtmlForRequest, resolveImageUrl, NOINDEX_PATHS, DEFAULT_TITLE, DEFAULT_DESCRIPTION };
