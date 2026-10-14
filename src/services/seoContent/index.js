// Entry point of the server-rendered content shell (see seoMeta.renderPage).
//
// Why it exists: the React app renders in the browser, so a crawler that does not run JavaScript
// (most AI crawlers) used to receive the same ~90-word English placeholder for every URL. Now the HTML
// carries real, page-specific text inside <div id="root">; React replaces it when it boots. Every visitor
// gets the same HTML (no user-agent sniffing), and it is built from the same sources as the app
// (it.json copy, active listings).
//
// Contract: these functions never throw. Anything that goes wrong degrades to a smaller page.
const { renderShell } = require('./layout');
const { pageFor, setPageDef } = require('./pages');
const { fetchSetData, setsListBlock } = require('./setData');
const { parseSetPath } = require('../seoSetPages');
const { listingsBlock, catalogBlock, productPage } = require('./listings');
const { t } = require('./copy');

async function build(def, locale = 'it') {
  const blocks = await Promise.all([...(def.catalog || []).map((b) => catalogBlock(b)), ...(def.setsLists || []).map((b) => setsListBlock(b, locale)), ...(def.listings || []).map((b) => listingsBlock(b))]);
  return { html: renderShell({ ...def, body: (def.body || '') + blocks.join('') + (def.tail || '') }, locale), jsonLd: def.jsonLd || null };
}

/** Site-wide fallback for routes without their own content (private pages, catalog detail pages, …). */
function genericPage(locale = 'it') {
  return renderShell({ h1: 'CardBrix', lead: t('landing.hero.subtitle', {}, locale) }, locale);
}

/** -> { html, jsonLd } for a non-listing route. `path` is always the canonical (Italian) path. */
async function shellForRoute(path, locale = 'it') {
  try {
    const parsedSet = parseSetPath(path);
    let def;
    if (parsedSet) {
      const data = await fetchSetData(parsedSet);
      def = data ? setPageDef(data, parsedSet, locale) : null;
    } else {
      def = pageFor(path, locale);
    }
    return def ? await build(def, locale) : { html: genericPage(locale), jsonLd: null };
  } catch (err) {
    console.error('seoContent shellForRoute:', err.message);
    return { html: genericPage(locale), jsonLd: null };
  }
}

/** -> { html, jsonLd } for /product/:id, from the row and absolute image URLs seoMeta already has. Product
 * pages are not localized (see localizedRoutes.json): always the Italian shell. */
async function shellForListing(listing, images) {
  try {
    return await build(await productPage(listing, images));
  } catch (err) {
    console.error('seoContent shellForListing:', err.message);
    return { html: genericPage(), jsonLd: null };
  }
}

/** Shell for the HTTP 404 page. */
function shellForNotFound(locale = 'it') {
  return renderShell({ h1: t('not_found.title', {}, locale) || (locale === 'en' ? 'Page not found' : 'Pagina non trovata'), lead: t('not_found.text', {}, locale) }, locale);
}

/** Swaps the placeholder inside <div id="root"> for `shellHtml`. Function replacer: `$` in text stays literal. */
function injectShell(html, shellHtml) {
  return html.replace(/<div id="root">[\s\S]*?<\/div>(?=\s*(?:<script|<\/body>))/, () => `<div id="root">${shellHtml}</div>`);
}

module.exports = { shellForRoute, shellForListing, shellForNotFound, injectShell };
