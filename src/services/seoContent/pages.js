// Page definitions for the content shell: for each public route, the headline, intro and body that a
// crawler without JavaScript should read. Text comes from client/src/locales/{it,en}.json (see copy.js);
// nothing here invents claims. A definition may ask for live listing blocks (rendered by listings.js):
//   { h1, lead, body, crumbs?, listings?: [{ heading, auction, productType?, game?, limit }], jsonLd? }
//
// Every function takes a trailing `locale` ('it' default, or 'en'): it picks the right copy.{it,en}.json
// strings and resolves internal links (via localizedRoutes.js) to their /it or /en URL, so a crawler
// reading the English shell only ever finds links to other English pages.
//
// Deliberately NOT reused: skill_zone.how_it_works.step1 ("Acquista Crediti") - it contradicts the
// product rule that credits cannot be bought; the landing.arena.* steps say the right thing.
const { t, has } = require('./copy');
const { esc, link, paragraphs, list, section } = require('./html');
const { SHORT } = require('../pageMeta');
const { resolveLocalizedPath } = require('../localizedRoutes');

const NAMES = { ...SHORT }; // pokemon -> Pokémon, ... funko -> Funko
const TCG_GAMES = ['pokemon', 'magic', 'yugioh', 'lorcana', 'onepiece', 'dragonball'];
const NAME_LEGO = 'LEGO';

const heading = (title, accent) => [title, accent].filter(Boolean).join(' ');

/** A canonical (Italian) internal path -> its /it or /en URL for `locale` (unchanged if not structural). */
const loc = (path, locale) => resolveLocalizedPath(path, locale) || path;

/** "1", "2", … while keys `${prefix}${n}${suffix}` exist. */
function numbered(prefix, suffix, max = 30, locale = 'it') {
  const out = [];
  for (let n = 1; n <= max; n += 1) if (has(`${prefix}${n}${suffix}`, locale)) out.push(n);
  return out;
}

const cta = (href, text) => (text ? `<p>${link(href, text)}</p>` : '');

// ------------------------------------------------------------------ home
function home(locale = 'it') {
  const pillar = (key, href) => {
    const facts = [1, 2, 3].map((n) => t(`landing.pillars.${key}.fact${n}`, {}, locale)).filter(Boolean);
    return (
      `<h3>${esc(t(`landing.pillars.${key}.name`, {}, locale))}</h3>` +
      `<p>${esc(t(`landing.pillars.${key}.desc`, {}, locale))}</p>` +
      list(facts.map(esc)) +
      cta(href, t(`landing.pillars.${key}.cta`, {}, locale))
    );
  };
  const steps = [1, 2, 3, 4].map((n) => `<h3>${esc(t(`how_it_works_page.step${n}_title`, {}, locale))}</h3><p>${esc(t(`how_it_works_page.step${n}_long_desc`, {}, locale))}</p>`).join('');
  return {
    h1: `CardBrix: ${t('landing.hero.word_collect', {}, locale)} ${t('landing.hero.word_bid', {}, locale)} ${t('landing.hero.word_win', {}, locale)}`,
    lead: t('landing.hero.subtitle', {}, locale),
    body:
      section(t('landing.pillars.title', {}, locale), `<p>${esc(t('landing.pillars.subtitle', {}, locale))}</p>${pillar('listings', loc('/annunci', locale))}${pillar('auctions', loc('/aste', locale))}<p>${esc(t('landing.auctions.antisniping_desc', {}, locale))}</p>${pillar('arena', loc('/skill-zone', locale))}`) +
      section(t('how_it_works_page.steps_title', {}, locale), `<p>${esc(t('how_it_works_page.steps_subtitle', {}, locale))}</p>${steps}${cta(loc('/come-funziona', locale), t('how_it_works_page.page_title', {}, locale))}`),
    listings: [
      { heading: t('landing.listings.title', {}, locale), auction: false, limit: 8 },
      { heading: t('landing.auctions.title', {}, locale), auction: true, limit: 6 },
    ],
  };
}

// ------------------------------------------------------------------ text pages
function comeFunziona(locale = 'it') {
  const why = [1, 2, 3].map((n) => `<h3>${esc(t(`how_it_works_page.why${n}_title`, {}, locale))}</h3><p>${esc(t(`how_it_works_page.why${n}_desc`, {}, locale))}</p>`).join('');
  const steps = [1, 2, 3, 4].map((n) => `<h3>${esc(t(`how_it_works_page.step${n}_title`, {}, locale))}</h3><p>${esc(t(`how_it_works_page.step${n}_long_desc`, {}, locale))}</p>`).join('');
  const features = [1, 2, 3, 4].map((n) => `<h3>${esc(t(`how_it_works_page.feature${n}_title`, {}, locale))}</h3><p>${esc(t(`how_it_works_page.feature${n}_desc`, {}, locale))}</p>`).join('');
  return {
    h1: t('how_it_works_page.hero_title', {}, locale),
    lead: t('how_it_works_page.hero_subtitle', {}, locale),
    body:
      section(t('how_it_works_page.why_title', {}, locale), why) +
      section(t('how_it_works_page.steps_title', {}, locale), `<p>${esc(t('how_it_works_page.steps_subtitle', {}, locale))}</p>${steps}`) +
      section(t('how_it_works_page.features_title', {}, locale), features) +
      section(t('how_it_works_page.cta_title', {}, locale), `<p>${esc(t('how_it_works_page.cta_desc', {}, locale))}</p><p>${link(loc('/register', locale), t('how_it_works_page.cta_register', {}, locale))} · ${link(loc('/catalog', locale), t('how_it_works_page.cta_browse', {}, locale))}</p>`),
  };
}

function faq(locale = 'it') {
  const nums = numbered('faq.q', '_question', 30, locale);
  const items = nums.map((n) => ({ q: t(`faq.q${n}_question`, {}, locale), a: t(`faq.q${n}_answer`, {}, locale) })).filter((i) => i.q && i.a);
  return {
    h1: t('faq.title', {}, locale),
    body: items.map((i) => `<section><h2>${esc(i.q)}</h2><p>${esc(i.a)}</p></section>`).join(''),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
    },
  };
}

function help(locale = 'it') {
  const questions = numbered('faq.q', '_question', 30, locale).map((n) => t(`faq.q${n}_question`, {}, locale)).filter(Boolean);
  const card = (key, href) => `<h2>${esc(t(`help.${key}_card_title`, {}, locale))}</h2><p>${esc(t(`help.${key}_card_desc`, {}, locale))}</p>${href ? cta(href, t(`help.${key}_card_cta`, {}, locale)) : `<p>${esc(t(`help.${key}_card_cta`, {}, locale))}</p>`}`;
  return {
    h1: t('help.title', {}, locale),
    lead: t('help.subtitle', {}, locale),
    body: card('faq', loc('/faq', locale)) + section(t('how_it_works_page.page_title', {}, locale), `<p>${esc(t('how_it_works_page.hero_subtitle', {}, locale))}</p>${cta(loc('/come-funziona', locale), t('how_it_works_page.hero_cta_catalog', {}, locale) ? t('how_it_works_page.page_title', {}, locale) : '')}`) + (questions.length ? section(t('faq.title', {}, locale), list(questions.map((q) => link(loc('/faq', locale), q)))) : '') + card('email', null) + card('legal', loc('/norme-legali', locale)),
  };
}

function legal(locale = 'it') {
  const nums = [];
  for (let n = 1; n <= 30; n += 1) if (has(`legal.art${n}_title`, locale)) nums.push(n);
  return {
    h1: t('legal.title', {}, locale),
    lead: t('legal.subtitle', {}, locale),
    body: nums.map((n) => `<section><h2>${esc(t(`legal.art${n}_title`, {}, locale))}</h2>${paragraphs(t(`legal.art${n}_body`, {}, locale))}</section>`).join(''),
  };
}

// Policy texts (privacy, cookie_policy) are numbered `${ns}.sN_title` / `${ns}.sN_body` pairs in it.json.
function policy(ns, locale = 'it') {
  const nums = numbered(`${ns}.s`, '_title', 30, locale);
  return {
    h1: t(`${ns}.title`, {}, locale),
    lead: t(`${ns}.subtitle`, {}, locale),
    body: nums.map((n) => `<section><h2>${esc(t(`${ns}.s${n}_title`, {}, locale))}</h2>${paragraphs(t(`${ns}.s${n}_body`, {}, locale))}</section>`).join(''),
  };
}

function skillZone(locale = 'it') {
  const steps = [1, 2, 3].map((n) => `<h3>${esc(t(`landing.arena.step${n}_title`, {}, locale))}</h3><p>${esc(t(`landing.arena.step${n}_desc`, {}, locale))}</p>`).join('');
  const facts = [1, 2, 3].map((n) => t(`landing.pillars.arena.fact${n}`, {}, locale)).filter(Boolean);
  return {
    h1: t('skill_zone.banner.title', {}, locale),
    lead: t('skill_zone.banner.subtitle', {}, locale),
    body:
      section(t('landing.arena.kicker', {}, locale), `<p>${esc(t('landing.pillars.arena.desc', {}, locale))}</p>${list(facts.map(esc))}`) +
      section(t('skill_zone.how_it_works.title', {}, locale), steps) +
      section(t('wallet.card2_title', {}, locale), `<p>${esc(t('wallet.card2_desc', {}, locale))}</p><p>${esc(t('landing.arena.credits_title', {}, locale))} ${link(loc('/crediti', locale), t('landing.arena.credits_cta', {}, locale))}</p>`),
    listings: [],
  };
}

function crediti(locale = 'it') {
  const cards = [1, 2, 3].map((n) => `<h2>${esc(t(`wallet.card${n}_title`, {}, locale))}</h2><p>${esc(t(`wallet.card${n}_desc`, {}, locale))}</p>`).join('');
  const maturation = has('wallet.mat_title', locale)
    ? section(t('wallet.mat_title', {}, locale), `<p>${esc(t('wallet.mat_intro', {}, locale))}</p>${list([t('wallet.mat_rule_condition', {}, locale), t('wallet.mat_rule_clawback', {}, locale)].map(esc))}`)
    : '';
  return { h1: t('wallet.hero_title', {}, locale), lead: t('wallet.hero_subtitle', {}, locale), body: cards + maturation + cta(loc('/skill-zone', locale), t('landing.pillars.arena.cta', {}, locale)) };
}

function userSearch(locale = 'it') {
  const listingsLabel = t('nav.listings', {}, locale) || (locale === 'en' ? 'Listings' : 'Annunci');
  const auctionsLabel = t('nav.auctions', {}, locale) || (locale === 'en' ? 'Auctions' : 'Aste');
  return {
    h1: t('user_search.title', {}, locale),
    lead: t('user_search.subtitle', {}, locale),
    body: section(t('how_it_works_page.why2_title', {}, locale), `<p>${esc(t('how_it_works_page.why2_desc', {}, locale))}</p>`) + `<p>${link(loc('/annunci', locale), listingsLabel)} · ${link(loc('/aste', locale), auctionsLabel)}</p>`,
  };
}

const STATIC = {
  '/': home,
  '/come-funziona': comeFunziona,
  '/faq': faq,
  '/help': help,
  '/norme-legali': legal,
  '/privacy': (locale) => policy('privacy', locale),
  '/cookie-policy': (locale) => policy('cookie_policy', locale),
  '/accessibilita': (locale) => policy('accessibility', locale),
  '/skill-zone': skillZone,
  '/crediti': crediti,
  '/ricerca-utente': userSearch,
};

// ------------------------------------------------------------------ marketplace + catalog hubs
const MODE = {
  annunci: { auction: false, hub: 'hubs.annunci', cards: 'hubs.annunci_cards', prefix: 'annunci.title_prefix', sub: 'annunci.subtitle', kind: 'annunci' },
  aste: { auction: true, hub: 'hubs.aste', cards: 'hubs.aste_cards', prefix: 'aste.title_prefix', sub: 'aste.subtitle', kind: 'aste' },
};

const KIND_LABEL = { it: { annunci: 'Annunci', aste: 'Aste' }, en: { annunci: 'Listings', aste: 'Auctions' } };
const CATEGORIES_LABEL = { it: 'Categorie', en: 'Categories' };
const CATALOG_LABEL = { it: 'Catalogo', en: 'Catalog' };
const SHIPPING_FALLBACK = { it: 'Spedizione', en: 'Shipping' };

/** Short, existing how-to copy so that list pages with few listings still explain what the visitor can do. */
function howTo(mode, locale = 'it') {
  const faqLabel = t('nav.faq', {}, locale) || (locale === 'en' ? 'FAQ' : 'FAQ');
  const inner = mode === 'aste'
    ? `<h3>${esc(t('faq.q3_question', {}, locale))}</h3><p>${esc(t('faq.q3_answer', {}, locale))}</p><p>${esc(t('landing.auctions.antisniping_desc', {}, locale))}</p>`
    : `<h3>${esc(t('how_it_works_page.step2_title', {}, locale))}</h3><p>${esc(t('how_it_works_page.step2_long_desc', {}, locale))}</p>`;
  return section(t('how_it_works_page.page_title', {}, locale), `${inner}<p>${link(loc('/come-funziona', locale), t('how_it_works_page.page_title', {}, locale))} · ${link(loc('/faq', locale), faqLabel)}</p>`);
}

function categoryLinks(mode, locale = 'it') {
  return list([
    `${link(loc(`/${mode}/lego`, locale), NAME_LEGO)}: ${esc(t('hubs.categories.lego_tagline', {}, locale))}`,
    `${link(loc(`/${mode}/funko`, locale), NAMES.funko)}: ${esc(t('hubs.categories.funko_tagline', {}, locale))}`,
    `${link(loc(`/${mode}/carte-collezionabili`, locale), t('hubs.categories.carte_name', {}, locale))}: ${esc(t('hubs.categories.carte_tagline', {}, locale))}`,
  ]);
}

function gameLinks(mode, locale = 'it') {
  return list(TCG_GAMES.map((g) => `${link(loc(`/${mode}/carte-collezionabili/${g}`, locale), NAMES[g])}: ${esc(t(`catalog_games.${g}`, {}, locale))}`));
}

/** Sentence for a category with no live listings, and where the visitor can go instead. */
function emptyText(mode, name, locale = 'it') {
  if (locale === 'en') {
    const where = name ? `for ${name}` : 'in this category';
    return mode === 'aste'
      ? `There are no auctions running ${where} right now. Check back soon, or start the first one yourself.`
      : `There are no active listings ${where} right now. Check back soon, or publish the first one yourself.`;
  }
  const where = name ? `per ${name}` : 'in questa categoria';
  return mode === 'aste'
    ? `Non ci sono aste in corso ${where} in questo momento. Torna presto, oppure avvia tu la prima.`
    : `Non ci sono annunci attivi ${where} in questo momento. Torna presto, oppure pubblica tu il primo.`;
}

const sellCta = (mode, locale = 'it') => {
  if (locale === 'en') return mode === 'aste' ? cta(loc('/create-auction', locale), 'Start an auction') : cta(loc('/sell', locale), 'List an item');
  return mode === 'aste' ? cta(loc('/create-auction', locale), "Crea un'asta") : cta(loc('/sell', locale), 'Pubblica un annuncio');
};

/** Link from a marketplace category to the reference catalog of the same thing. */
function catalogLink(slug, name, locale = 'it') {
  const title = locale === 'en' ? `${name} Catalog` : `Catalogo ${name}`;
  const ctaText = locale === 'en' ? `Open the ${name} catalog` : `Apri il catalogo ${name}`;
  return section(title, `<p>${esc(t(`catalog_games.${slug}`, {}, locale))}</p>${cta(loc(`/catalog/${slug}`, locale), ctaText)}`);
}

function market(mode, rest, locale = 'it') {
  const m = MODE[mode];
  const kindLabel = KIND_LABEL[locale === 'en' ? 'en' : 'it'][mode];
  const categoriesLabel = CATEGORIES_LABEL[locale === 'en' ? 'en' : 'it'];
  const root = { name: kindLabel, href: loc(`/${mode}`, locale) };
  const home = { name: 'CardBrix', href: loc('/', locale) };

  if (rest.length === 0) {
    return {
      h1: heading(t(`${m.hub}.title_pre`, {}, locale), t(`${m.hub}.title_accent`, {}, locale)) || kindLabel,
      lead: t(`${m.hub}.subtitle`, {}, locale),
      body: section(t(`${m.hub}.cta`, {}, locale) || categoriesLabel, categoryLinks(mode, locale)) + howTo(mode, locale) + sellCta(mode, locale),
      crumbs: [home, { name: kindLabel }],
      listings: [{ heading: kindLabel, auction: m.auction, limit: 12, empty: emptyText(mode, undefined, locale) }],
    };
  }
  const [cat, game] = rest;
  if (rest.length === 1 && (cat === 'lego' || cat === 'funko')) {
    const name = cat === 'lego' ? NAME_LEGO : NAMES.funko;
    return {
      h1: `${t(m.prefix, {}, locale)} ${name}`,
      lead: t(m.sub, { title: name }, locale),
      body: section(t('hubs.annunci.cta', {}, locale) || categoriesLabel, categoryLinks(mode, locale)) + catalogLink(cat, name, locale) + howTo(mode, locale) + sellCta(mode, locale),
      crumbs: [home, root, { name }],
      listings: [{ heading: `${kindLabel} ${name}`, auction: m.auction, productType: cat, limit: 20, empty: emptyText(mode, name, locale) }],
    };
  }
  if (cat === 'carte-collezionabili' && rest.length === 1) {
    const carteName = t('hubs.categories.carte_name', {}, locale);
    return {
      h1: `${t(m.prefix, {}, locale)} ${carteName}`, // "Annunci Carte Collezionabili" / "Aste …": unique per section
      lead: t(`${m.cards}.subtitle`, {}, locale),
      body: section(carteName, gameLinks(mode, locale)) + howTo(mode, locale) + sellCta(mode, locale),
      crumbs: [home, root, { name: carteName }],
      listings: [{ heading: `${kindLabel} ${carteName}`, auction: m.auction, productType: 'tcg', limit: 20, empty: emptyText(mode, carteName, locale) }],
    };
  }
  if (cat === 'carte-collezionabili' && rest.length === 2 && TCG_GAMES.includes(game)) {
    const name = NAMES[game];
    const carteName = t('hubs.categories.carte_name', {}, locale);
    return {
      h1: `${t(m.prefix, {}, locale)} ${name}`,
      lead: t(m.sub, { title: name }, locale),
      body: section(carteName, gameLinks(mode, locale)) + catalogLink(game, name, locale) + howTo(mode, locale) + sellCta(mode, locale),
      crumbs: [home, root, { name: carteName, href: loc(`/${mode}/carte-collezionabili`, locale) }, { name }],
      listings: [{ heading: `${kindLabel} ${name}`, auction: m.auction, productType: 'tcg', game, limit: 20, empty: emptyText(mode, name, locale) }],
    };
  }
  return null;
}

function catalog(rest, locale = 'it') {
  const catalogLabel = CATALOG_LABEL[locale === 'en' ? 'en' : 'it'];
  const home = { name: 'CardBrix', href: loc('/', locale) };
  const all = [['lego', NAME_LEGO], ...TCG_GAMES.map((g) => [g, NAMES[g]]), ['funko', NAMES.funko]];
  if (rest.length === 0) {
    return {
      h1: heading(t('hubs.catalog.title_pre', {}, locale), t('hubs.catalog.title_accent', {}, locale)) || catalogLabel,
      lead: t('hubs.catalog.subtitle', {}, locale),
      body:
        section(t('hubs.catalog.cta', {}, locale) || catalogLabel, list(all.map(([slug, name]) => `${link(loc(`/catalog/${slug}`, locale), name)}: ${esc(t(`catalog_games.${slug}`, {}, locale))}`))) +
        section(t('landing.trust.pricing_title', {}, locale), `<p>${esc(t('landing.trust.pricing_desc', {}, locale))}</p><p>${esc(t('how_it_works_page.why1_desc', {}, locale))}</p>`),
      crumbs: [home, { name: catalogLabel }],
    };
  }
  const [slug] = rest;
  const found = all.find(([s]) => s === slug);
  if (rest.length === 1 && found) {
    const [, name] = found;
    const marketPath = slug === 'lego' ? '/annunci/lego' : slug === 'funko' ? '/annunci/funko' : `/annunci/carte-collezionabili/${slug}`;
    const productType = slug === 'lego' || slug === 'funko' ? slug : 'tcg';
    const title = locale === 'en' ? `${name} Catalog` : `Catalogo ${name}`;
    const recentHeading = locale === 'en' ? `Recently added to the ${name} catalog` : `Aggiunti di recente al catalogo ${name}`;
    const listingsHeading = locale === 'en' ? `${name} Listings` : `Annunci ${name}`;
    return {
      h1: title,
      lead: t(`catalog_games.${slug}`, {}, locale),
      body:
        `<p>${esc(t('hubs.catalog.subtitle', {}, locale))}</p>` +
        section(t('landing.trust.pricing_title', {}, locale), `<p>${esc(t('landing.trust.pricing_desc', {}, locale))}</p><p>${esc(t('how_it_works_page.why1_desc', {}, locale))}</p>`),
      tail: `${cta(loc(marketPath, locale), `${t('annunci.title_prefix', {}, locale)} ${name}`)}${cta(loc('/catalog', locale), catalogLabel)}`,
      crumbs: [home, { name: catalogLabel, href: loc('/catalog', locale) }, { name }],
      catalog: [{ slug, heading: recentHeading, limit: 12 }],
      listings: [{ heading: listingsHeading, auction: false, productType, ...(productType === 'tcg' ? { game: slug } : {}), limit: 8, empty: emptyText('annunci', name, locale) }],
    };
  }
  return null;
}

/** Definition for a request path (always canonical/Italian), or null when the route has no specific content. */
function pageFor(rawPath, locale = 'it') {
  const path = String(rawPath || '/').replace(/\/+$/, '').toLowerCase() || '/';
  if (STATIC[path]) return STATIC[path](locale);
  const [head, ...rest] = path.split('/').filter(Boolean);
  if (head === 'annunci' || head === 'aste') return market(head, rest, locale);
  if (head === 'catalog') return catalog(rest, locale);
  return null;
}

module.exports = { pageFor, STATIC_PATHS: Object.keys(STATIC) };
