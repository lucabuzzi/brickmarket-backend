// The frame every server-rendered page shares: brand, main navigation, content, footer links.
// It is rendered INSIDE <div id="root"> and replaced wholesale when the React app boots, so it only has
// to be readable for crawlers that never run JavaScript (and for the moment before the bundle loads).
// Styling lives in client/src/index.css under `.seo-shell`.
const { esc, link, list } = require('./html');
const { t } = require('./copy');
const { resolveLocalizedPath } = require('../localizedRoutes');
const legalPages = require('../../../client/src/config/legalPages.json');

/** A canonical (Italian) internal path -> its /it or /en URL for `locale` (unchanged if not structural). */
const loc = (path, locale) => resolveLocalizedPath(path, locale) || path;

const label = (key, fallback, locale) => t(key, {}, locale) || fallback;

const ARIA = {
  it: { main: 'Principale', info: 'Informazioni', path: 'Percorso' },
  en: { main: 'Main', info: 'Information', path: 'Path' },
};

function mainNav(locale = 'it') {
  const en = locale === 'en';
  return [
    [loc('/annunci', locale), label('nav.listings', en ? 'Listings' : 'Annunci', locale)],
    [loc('/aste', locale), label('nav.auctions', en ? 'Auctions' : 'Aste', locale)],
    [loc('/catalog', locale), label('nav.catalog', en ? 'Catalog' : 'Catalogo', locale)],
    [loc('/skill-zone', locale), label('nav.skill_zone', 'Puzzle Arena', locale)],
    [loc('/come-funziona', locale), en ? 'How It Works' : 'Come funziona'],
  ];
}

function footerNav(locale = 'it') {
  const en = locale === 'en';
  return [
    // fixed labels: the locale's nav.help / nav.legal_rules are upper-case menu strings ("AIUTO", "NORME LEGALI")
    [loc('/faq', locale), 'FAQ'],
    [loc('/help', locale), en ? 'Support' : 'Assistenza'],
    [loc('/norme-legali', locale), en ? 'Legal Rules' : 'Norme legali'],
    ...(legalPages.published ? [[loc('/privacy', locale), 'Privacy'], [loc('/cookie-policy', locale), 'Cookie Policy']] : []),
    ...(legalPages.accessibilityPublished ? [[loc('/accessibilita', locale), en ? 'Accessibility' : 'Accessibilità']] : []),
    [loc('/crediti', locale), en ? 'Credits' : 'Crediti'],
  ];
}

const links = (items) => list(items.map(([href, text]) => link(href, text)));

/** crumbs: [{ name, href? }], the last one (current page) has no href. */
function breadcrumbs(crumbs, locale = 'it') {
  if (!crumbs || crumbs.length < 2) return '';
  const items = crumbs.map((c) => (c.href ? link(c.href, c.name) : `<span>${esc(c.name)}</span>`));
  const aria = (ARIA[locale] || ARIA.it).path;
  return `<nav aria-label="${aria}" class="seo-crumbs">${list(items)}</nav>`;
}

function renderShell({ h1, lead = '', body = '', crumbs = [] }, locale = 'it') {
  const year = new Date().getFullYear();
  const aria = ARIA[locale] || ARIA.it;
  return (
    '<div class="seo-shell">' +
    `<header><p class="seo-brand">${link(loc('/', locale), 'CardBrix')}</p><nav aria-label="${aria.main}">${links(mainNav(locale))}</nav></header>` +
    `<main>${breadcrumbs(crumbs, locale)}<h1>${esc(h1)}</h1>${lead ? `<p class="seo-lead">${esc(lead)}</p>` : ''}${body}</main>` +
    `<footer><nav aria-label="${aria.info}">${links(footerNav(locale))}</nav><p>${esc(t('ui.footer_copyright', { year }, locale) || `© ${year} CardBrix`)}</p></footer>` +
    '</div>'
  );
}

module.exports = { renderShell, mainNav, footerNav };
