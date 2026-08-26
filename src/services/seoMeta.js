const { query } = require('../db');

const BASE_URL = 'https://cardbrix.com';
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;
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

function truncate(str, max) {
  if (!str) return '';
  const clean = String(str).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
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

function formatPriceEUR(v) {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return null;
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
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

/**
 * Returns a per-request version of the SPA's index.html: the static template always declares
 * canonical/OG as "/", which would tell crawlers every URL on the site is the homepage. This
 * rewrites canonical/og:url to the real path, and for /product/:id fetches the listing so bots
 * and social-share unfurlers (which don't run the client JS that updates these tags) see the
 * actual title, price and photo instead of generic branding.
 */
async function renderIndexHtmlForRequest(reqPath, baseHtml) {
  const canonical = `${BASE_URL}${reqPath === '/' ? '' : reqPath}`;

  const productMatch = reqPath.match(/^\/product\/([^/]+)$/);
  if (!productMatch) {
    return applyMeta(baseHtml, {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      canonical,
      ogImage: DEFAULT_OG_IMAGE,
    });
  }

  const listingId = productMatch[1];
  try {
    const { rows } = await query(
      `SELECT id, title, description, price, current_bid, auction_start, type, status, images
       FROM listings WHERE id = $1`,
      [listingId]
    );

    if (rows.length === 0) {
      return applyMeta(baseHtml, {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
        canonical,
        ogImage: DEFAULT_OG_IMAGE,
      });
    }

    const listing = rows[0];
    const isAuction = listing.type === 'auction';
    const effectivePrice = isAuction ? (listing.current_bid ?? listing.auction_start) : listing.price;
    const priceLabel = formatPriceEUR(effectivePrice);

    const title = `${listing.title} | CardBrix`;
    const description = truncate(
      listing.description ||
        `${listing.title}${priceLabel ? ` a ${priceLabel}` : ''} su CardBrix. Compra o fai un'offerta in sicurezza.`,
      160
    );
    const ogImage = resolveImageUrl(Array.isArray(listing.images) ? listing.images[0] : null);

    let html = applyMeta(baseHtml, { title, description, canonical, ogImage });

    html = injectJsonLd(html, {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: listing.title,
      description,
      image: ogImage,
      url: canonical,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'EUR',
        price: effectivePrice != null ? Number(effectivePrice).toFixed(2) : undefined,
        availability: listing.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
        url: canonical,
      },
    });

    return html;
  } catch (err) {
    console.error('renderIndexHtmlForRequest: errore nel recupero annuncio per meta tag:', err.message);
    return applyMeta(baseHtml, {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      canonical,
      ogImage: DEFAULT_OG_IMAGE,
    });
  }
}

module.exports = { renderIndexHtmlForRequest };
