// Per-page checks. Pure: (fetched page + parsed html) in, list of { id, detail } out. No network.
const { jsonLdNodes, typesOf } = require('./htmlParse');

const isProductPath = (pathname) => /^\/product\/[^/]+$/.test(pathname);

/** origin + pathname, lowercase host, no trailing slash (except root), no query/hash. */
function normalizeUrl(u, base) {
  try {
    const x = new URL(u, base);
    const path = x.pathname.length > 1 ? x.pathname.replace(/\/+$/, '') : x.pathname;
    return `${x.protocol}//${x.host.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

function checkPage({ url, finalUrl, status, error, chain = [], headers = {}, bytes = 0, ttfbMs = null }, parsed, { baseUrl }) {
  const out = [];
  const add = (id, detail) => out.push({ id, detail });
  const pathname = new URL(url).pathname;

  if (error || status === 0) {
    add('fetch-failed', error || 'nessuna risposta');
    return out;
  }
  if (status >= 400) {
    add('http-error', `HTTP ${status}`);
    return out;
  }
  if (chain.length > 0) add('redirect-chain', `${chain.map((c) => c.status).join('→')} → ${finalUrl}`);

  const baseHost = new URL(baseUrl).host;

  // ---- head basics
  if (!parsed.title) add('title-missing');
  else if (parsed.title.length < 30 || parsed.title.length > 65) add('title-length', `${parsed.title.length} caratteri: "${parsed.title}"`);

  if (!parsed.description) add('desc-missing');
  else if (parsed.description.length < 70 || parsed.description.length > 165) add('desc-length', `${parsed.description.length} caratteri`);

  if (!parsed.lang) add('lang-missing');
  if (!parsed.viewport) add('viewport-missing');

  // ---- indexability
  if (/noindex/i.test(parsed.robotsMeta || '') || /noindex/i.test(headers['x-robots-tag'] || '')) add('noindex');
  if (parsed.canonical == null || parsed.canonical === '') {
    add('canonical-missing');
  } else {
    const canon = normalizeUrl(parsed.canonical, baseUrl);
    if (canon && new URL(canon).host !== baseHost) add('canonical-offsite', parsed.canonical);
    else if (canon && canon !== normalizeUrl(finalUrl || url, baseUrl)) add('canonical-mismatch', `canonical=${parsed.canonical}`);
  }

  // ---- headings, social, images
  if (parsed.headings.h1.length === 0) add('h1-missing');
  else if (parsed.headings.h1.length > 1) add('h1-multiple', `${parsed.headings.h1.length} H1`);

  const missingOg = ['title', 'description', 'image'].filter((k) => !parsed.og[k]);
  if (missingOg.length) add('og-incomplete', `mancano: ${missingOg.join(', ')}`);
  if (!parsed.twitterCard) add('twitter-card-missing');

  const noAlt = parsed.images.filter((i) => i.alt === null);
  if (noAlt.length) add('img-alt-missing', `${noAlt.length} immagini`);

  // ---- structured data
  const invalid = parsed.jsonLd.filter((j) => j.error);
  if (invalid.length) add('jsonld-invalid', invalid.map((j) => j.error).join('; '));
  const nodes = jsonLdNodes(parsed.jsonLd);
  const types = nodes.flatMap(typesOf);

  if (isProductPath(pathname)) {
    const product = nodes.find((n) => typesOf(n).includes('Product'));
    if (!product) {
      add('product-schema-missing');
    } else {
      const offer = [].concat(product.offers || [])[0] || {};
      const missing = [];
      if (!product.name) missing.push('name');
      if (!product.image) missing.push('image');
      if (offer.price == null || offer.price === '') missing.push('offers.price');
      if (!offer.priceCurrency) missing.push('offers.priceCurrency');
      if (!offer.availability) missing.push('offers.availability');
      if (missing.length) add('product-schema-incomplete', `mancano: ${missing.join(', ')}`);
      const rec = [];
      if (!product.brand) rec.push('brand');
      if (!product.sku) rec.push('sku');
      if (!offer.itemCondition) rec.push('offers.itemCondition');
      if (rec.length) add('product-schema-recommended', `mancano: ${rec.join(', ')}`);
    }
    if (!types.includes('BreadcrumbList')) add('breadcrumb-missing');
  }

  // ---- AEO: what a crawler WITHOUT JavaScript sees
  const internalLinks = parsed.anchors.filter((a) => {
    const n = normalizeUrl(a.href, url);
    return n && new URL(n).host === baseHost && !a.href.startsWith('#');
  });
  if (parsed.wordCount < 150) add('raw-html-thin', `${parsed.wordCount} parole nell'HTML iniziale`);
  if (internalLinks.length < 5) add('no-internal-links-raw', `${internalLinks.length} link interni nell'HTML iniziale`);

  // ---- performance of the document itself
  if (ttfbMs != null && ttfbMs > 800) add('slow-ttfb', `${ttfbMs}ms`);
  if (bytes > 300 * 1024) add('heavy-html', `${Math.round(bytes / 1024)}KB`);
  const enc = (headers['content-encoding'] || '').toLowerCase();
  if (bytes > 2048 && !/gzip|br|deflate|zstd/.test(enc)) add('no-compression');

  return out;
}

/** Does the page as seen by Googlebot differ materially from the browser one? */
function compareBotView(browser, bot, baseUrl) {
  if (browser.status !== bot.status) return `status ${browser.status} (browser) vs ${bot.status} (Googlebot)`;
  if ((browser.parsed.title || '') !== (bot.parsed.title || '')) return 'title diverso';
  if (normalizeUrl(browser.parsed.canonical || '', baseUrl) !== normalizeUrl(bot.parsed.canonical || '', baseUrl)) return 'canonical diverso';
  return null;
}

module.exports = { checkPage, compareBotView, normalizeUrl, isProductPath };
