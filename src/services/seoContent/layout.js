// The frame every server-rendered page shares: brand, main navigation, content, footer links.
// It is rendered INSIDE <div id="root"> and replaced wholesale when the React app boots, so it only has
// to be readable for crawlers that never run JavaScript (and for the moment before the bundle loads).
// Styling lives in client/src/index.css under `.seo-shell`.
const { esc, link, list } = require('./html');
const { t } = require('./copy');

const label = (key, fallback) => t(key) || fallback;

function mainNav() {
  return [
    ['/annunci', label('nav.listings', 'Annunci')],
    ['/aste', label('nav.auctions', 'Aste')],
    ['/catalog', label('nav.catalog', 'Catalogo')],
    ['/skill-zone', label('nav.skill_zone', 'Puzzle Arena')],
    ['/come-funziona', 'Come funziona'],
  ];
}

function footerNav() {
  return [
    // fixed labels: the locale's nav.help / nav.legal_rules are upper-case menu strings ("AIUTO", "NORME LEGALI")
    ['/faq', 'FAQ'],
    ['/help', 'Assistenza'],
    ['/norme-legali', 'Norme legali'],
    ['/crediti', 'Crediti'],
  ];
}

const links = (items) => list(items.map(([href, text]) => link(href, text)));

/** crumbs: [{ name, href? }], the last one (current page) has no href. */
function breadcrumbs(crumbs) {
  if (!crumbs || crumbs.length < 2) return '';
  const items = crumbs.map((c) => (c.href ? link(c.href, c.name) : `<span>${esc(c.name)}</span>`));
  return `<nav aria-label="Percorso" class="seo-crumbs">${list(items)}</nav>`;
}

function renderShell({ h1, lead = '', body = '', crumbs = [] }) {
  const year = new Date().getFullYear();
  return (
    '<div class="seo-shell">' +
    `<header><p class="seo-brand">${link('/', 'CardBrix')}</p><nav aria-label="Principale">${links(mainNav())}</nav></header>` +
    `<main>${breadcrumbs(crumbs)}<h1>${esc(h1)}</h1>${lead ? `<p class="seo-lead">${esc(lead)}</p>` : ''}${body}</main>` +
    `<footer><nav aria-label="Informazioni">${links(footerNav())}</nav><p>${esc(t('ui.footer_copyright', { year }) || `© ${year} CardBrix`)}</p></footer>` +
    '</div>'
  );
}

module.exports = { renderShell, mainNav, footerNav };
