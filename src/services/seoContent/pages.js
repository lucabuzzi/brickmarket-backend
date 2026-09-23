// Page definitions for the content shell: for each public route, the headline, intro and body that a
// crawler without JavaScript should read. Text comes from client/src/locales/it.json (see copy.js);
// nothing here invents claims. A definition may ask for live listing blocks (rendered by listings.js):
//   { h1, lead, body, crumbs?, listings?: [{ heading, auction, productType?, game?, limit }], jsonLd? }
//
// Deliberately NOT reused: skill_zone.how_it_works.step1 ("Acquista Crediti") - it contradicts the
// product rule that credits cannot be bought; the landing.arena.* steps say the right thing.
const { t, has } = require('./copy');
const { esc, link, paragraphs, list, section } = require('./html');
const { SHORT } = require('../pageMeta');

const NAMES = { ...SHORT }; // pokemon -> Pokémon, ... funko -> Funko
const TCG_GAMES = ['pokemon', 'magic', 'yugioh', 'lorcana', 'onepiece', 'dragonball'];
const NAME_LEGO = 'LEGO';

const heading = (title, accent) => [title, accent].filter(Boolean).join(' ');

/** "1", "2", … while keys `${prefix}${n}${suffix}` exist. */
function numbered(prefix, suffix, max = 30) {
  const out = [];
  for (let n = 1; n <= max; n += 1) if (has(`${prefix}${n}${suffix}`)) out.push(n);
  return out;
}

const cta = (href, text) => (text ? `<p>${link(href, text)}</p>` : '');

// ------------------------------------------------------------------ home
function home() {
  const pillar = (key, href) => {
    const facts = [1, 2, 3].map((n) => t(`landing.pillars.${key}.fact${n}`)).filter(Boolean);
    return (
      `<h3>${esc(t(`landing.pillars.${key}.name`))}</h3>` +
      `<p>${esc(t(`landing.pillars.${key}.desc`))}</p>` +
      list(facts.map(esc)) +
      cta(href, t(`landing.pillars.${key}.cta`))
    );
  };
  const steps = [1, 2, 3, 4].map((n) => `<h3>${esc(t(`how_it_works_page.step${n}_title`))}</h3><p>${esc(t(`how_it_works_page.step${n}_long_desc`))}</p>`).join('');
  return {
    h1: `CardBrix: ${t('landing.hero.word_collect')} ${t('landing.hero.word_bid')} ${t('landing.hero.word_win')}`,
    lead: t('landing.hero.subtitle'),
    body:
      section(t('landing.pillars.title'), `<p>${esc(t('landing.pillars.subtitle'))}</p>${pillar('listings', '/annunci')}${pillar('auctions', '/aste')}<p>${esc(t('landing.auctions.antisniping_desc'))}</p>${pillar('arena', '/skill-zone')}`) +
      section(t('how_it_works_page.steps_title'), `<p>${esc(t('how_it_works_page.steps_subtitle'))}</p>${steps}${cta('/come-funziona', t('how_it_works_page.page_title'))}`),
    listings: [
      { heading: t('landing.listings.title'), auction: false, limit: 8 },
      { heading: t('landing.auctions.title'), auction: true, limit: 6 },
    ],
  };
}

// ------------------------------------------------------------------ text pages
function comeFunziona() {
  const why = [1, 2, 3].map((n) => `<h3>${esc(t(`how_it_works_page.why${n}_title`))}</h3><p>${esc(t(`how_it_works_page.why${n}_desc`))}</p>`).join('');
  const steps = [1, 2, 3, 4].map((n) => `<h3>${esc(t(`how_it_works_page.step${n}_title`))}</h3><p>${esc(t(`how_it_works_page.step${n}_long_desc`))}</p>`).join('');
  const features = [1, 2, 3, 4].map((n) => `<h3>${esc(t(`how_it_works_page.feature${n}_title`))}</h3><p>${esc(t(`how_it_works_page.feature${n}_desc`))}</p>`).join('');
  return {
    h1: t('how_it_works_page.hero_title'),
    lead: t('how_it_works_page.hero_subtitle'),
    body:
      section(t('how_it_works_page.why_title'), why) +
      section(t('how_it_works_page.steps_title'), `<p>${esc(t('how_it_works_page.steps_subtitle'))}</p>${steps}`) +
      section(t('how_it_works_page.features_title'), features) +
      section(t('how_it_works_page.cta_title'), `<p>${esc(t('how_it_works_page.cta_desc'))}</p><p>${link('/register', t('how_it_works_page.cta_register'))} · ${link('/catalog', t('how_it_works_page.cta_browse'))}</p>`),
  };
}

function faq() {
  const nums = numbered('faq.q', '_question');
  const items = nums.map((n) => ({ q: t(`faq.q${n}_question`), a: t(`faq.q${n}_answer`) })).filter((i) => i.q && i.a);
  return {
    h1: t('faq.title'),
    body: items.map((i) => `<section><h2>${esc(i.q)}</h2><p>${esc(i.a)}</p></section>`).join(''),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
    },
  };
}

function help() {
  const card = (key, href) => `<h2>${esc(t(`help.${key}_card_title`))}</h2><p>${esc(t(`help.${key}_card_desc`))}</p>${href ? cta(href, t(`help.${key}_card_cta`)) : `<p>${esc(t(`help.${key}_card_cta`))}</p>`}`;
  return {
    h1: t('help.title'),
    lead: t('help.subtitle'),
    body: card('faq', '/faq') + card('email', null) + card('legal', '/norme-legali'),
  };
}

function legal() {
  const nums = [];
  for (let n = 1; n <= 30; n += 1) if (has(`legal.art${n}_title`)) nums.push(n);
  return {
    h1: t('legal.title'),
    lead: t('legal.subtitle'),
    body: nums.map((n) => `<section><h2>${esc(t(`legal.art${n}_title`))}</h2>${paragraphs(t(`legal.art${n}_body`))}</section>`).join(''),
  };
}

function skillZone() {
  const steps = [1, 2, 3].map((n) => `<h3>${esc(t(`landing.arena.step${n}_title`))}</h3><p>${esc(t(`landing.arena.step${n}_desc`))}</p>`).join('');
  const facts = [1, 2, 3].map((n) => t(`landing.pillars.arena.fact${n}`)).filter(Boolean);
  return {
    h1: t('skill_zone.banner.title'),
    lead: t('skill_zone.banner.subtitle'),
    body:
      section(t('landing.arena.kicker'), `<p>${esc(t('landing.pillars.arena.desc'))}</p>${list(facts.map(esc))}`) +
      section(t('skill_zone.how_it_works.title'), steps) +
      section(t('wallet.card2_title'), `<p>${esc(t('wallet.card2_desc'))}</p><p>${esc(t('landing.arena.credits_title'))} ${link('/crediti', t('landing.arena.credits_cta'))}</p>`),
    listings: [],
  };
}

function crediti() {
  const cards = [1, 2, 3].map((n) => `<h2>${esc(t(`wallet.card${n}_title`))}</h2><p>${esc(t(`wallet.card${n}_desc`))}</p>`).join('');
  return { h1: t('wallet.hero_title'), lead: t('wallet.hero_subtitle'), body: cards + cta('/skill-zone', t('landing.pillars.arena.cta')) };
}

const STATIC = {
  '/': home,
  '/come-funziona': comeFunziona,
  '/faq': faq,
  '/help': help,
  '/norme-legali': legal,
  '/skill-zone': skillZone,
  '/crediti': crediti,
};

// ------------------------------------------------------------------ marketplace + catalog hubs
const MODE = {
  annunci: { auction: false, hub: 'hubs.annunci', cards: 'hubs.annunci_cards', prefix: 'annunci.title_prefix', sub: 'annunci.subtitle', kind: 'annunci' },
  aste: { auction: true, hub: 'hubs.aste', cards: 'hubs.aste_cards', prefix: 'aste.title_prefix', sub: 'aste.subtitle', kind: 'aste' },
};

/** Short, existing how-to copy so that list pages with few listings still explain what the visitor can do. */
function howTo(mode) {
  const inner = mode === 'aste'
    ? `<h3>${esc(t('faq.q3_question'))}</h3><p>${esc(t('faq.q3_answer'))}</p><p>${esc(t('landing.auctions.antisniping_desc'))}</p>`
    : `<h3>${esc(t('how_it_works_page.step2_title'))}</h3><p>${esc(t('how_it_works_page.step2_long_desc'))}</p>`;
  return section(t('how_it_works_page.page_title'), `${inner}<p>${link('/come-funziona', t('how_it_works_page.page_title'))} · ${link('/faq', t('nav.faq') || 'FAQ')}</p>`);
}

function categoryLinks(mode) {
  return list([
    `${link(`/${mode}/lego`, NAME_LEGO)}: ${esc(t('hubs.categories.lego_tagline'))}`,
    `${link(`/${mode}/funko`, NAMES.funko)}: ${esc(t('hubs.categories.funko_tagline'))}`,
    `${link(`/${mode}/carte-collezionabili`, t('hubs.categories.carte_name'))}: ${esc(t('hubs.categories.carte_tagline'))}`,
  ]);
}

function gameLinks(mode) {
  return list(TCG_GAMES.map((g) => `${link(`/${mode}/carte-collezionabili/${g}`, NAMES[g])}: ${esc(t(`catalog_games.${g}`))}`));
}

function market(mode, rest) {
  const m = MODE[mode];
  const kindLabel = mode === 'annunci' ? 'Annunci' : 'Aste';
  const root = { name: kindLabel, href: `/${mode}` };
  const home = { name: 'CardBrix', href: '/' };

  if (rest.length === 0) {
    return {
      h1: heading(t(`${m.hub}.title_pre`), t(`${m.hub}.title_accent`)) || kindLabel,
      lead: t(`${m.hub}.subtitle`),
      body: section(t(`${m.hub}.cta`) || 'Categorie', categoryLinks(mode)) + howTo(mode),
      crumbs: [home, { name: kindLabel }],
      listings: [{ heading: kindLabel, auction: m.auction, limit: 12 }],
    };
  }
  const [cat, game] = rest;
  if (rest.length === 1 && (cat === 'lego' || cat === 'funko')) {
    const name = cat === 'lego' ? NAME_LEGO : NAMES.funko;
    return {
      h1: `${t(m.prefix)} ${name}`,
      lead: t(m.sub, { title: name }),
      body: section(t('hubs.annunci.cta') || 'Categorie', categoryLinks(mode)) + howTo(mode),
      crumbs: [home, root, { name }],
      listings: [{ heading: `${kindLabel} ${name}`, auction: m.auction, productType: cat, limit: 20 }],
    };
  }
  if (cat === 'carte-collezionabili' && rest.length === 1) {
    return {
      h1: `${t(m.prefix)} ${t('hubs.categories.carte_name')}`, // "Annunci Carte Collezionabili" / "Aste …": unique per section
      lead: t(`${m.cards}.subtitle`),
      body: section(t('hubs.categories.carte_name'), gameLinks(mode)) + howTo(mode),
      crumbs: [home, root, { name: t('hubs.categories.carte_name') }],
      listings: [{ heading: `${kindLabel} ${t('hubs.categories.carte_name')}`, auction: m.auction, productType: 'tcg', limit: 20 }],
    };
  }
  if (cat === 'carte-collezionabili' && rest.length === 2 && TCG_GAMES.includes(game)) {
    const name = NAMES[game];
    return {
      h1: `${t(m.prefix)} ${name}`,
      lead: t(m.sub, { title: name }),
      body: section(t('hubs.categories.carte_name'), gameLinks(mode)) + howTo(mode),
      crumbs: [home, root, { name: t('hubs.categories.carte_name'), href: `/${mode}/carte-collezionabili` }, { name }],
      listings: [{ heading: `${kindLabel} ${name}`, auction: m.auction, productType: 'tcg', game, limit: 20 }],
    };
  }
  return null;
}

function catalog(rest) {
  const home = { name: 'CardBrix', href: '/' };
  const all = [['lego', NAME_LEGO], ...TCG_GAMES.map((g) => [g, NAMES[g]]), ['funko', NAMES.funko]];
  if (rest.length === 0) {
    return {
      h1: heading(t('hubs.catalog.title_pre'), t('hubs.catalog.title_accent')) || 'Catalogo',
      lead: t('hubs.catalog.subtitle'),
      body: section(t('hubs.catalog.cta') || 'Catalogo', list(all.map(([slug, name]) => `${link(`/catalog/${slug}`, name)}: ${esc(t(`catalog_games.${slug}`))}`))),
      crumbs: [home, { name: 'Catalogo' }],
    };
  }
  const [slug] = rest;
  const found = all.find(([s]) => s === slug);
  if (rest.length === 1 && found) {
    const [, name] = found;
    const market = slug === 'lego' ? '/annunci/lego' : slug === 'funko' ? '/annunci/funko' : `/annunci/carte-collezionabili/${slug}`;
    return {
      h1: `Catalogo ${name}`,
      lead: t(`catalog_games.${slug}`),
      body: `<p>${esc(t('hubs.catalog.subtitle'))}</p>${cta(market, `${t('annunci.title_prefix')} ${name}`)}${cta('/catalog', 'Catalogo')}`,
      crumbs: [home, { name: 'Catalogo', href: '/catalog' }, { name }],
    };
  }
  return null;
}

/** Definition for a request path, or null when the route has no specific content (generic shell). */
function pageFor(rawPath) {
  const path = String(rawPath || '/').replace(/\/+$/, '').toLowerCase() || '/';
  if (STATIC[path]) return STATIC[path]();
  const [head, ...rest] = path.split('/').filter(Boolean);
  if (head === 'annunci' || head === 'aste') return market(head, rest);
  if (head === 'catalog') return catalog(rest);
  return null;
}

module.exports = { pageFor, STATIC_PATHS: Object.keys(STATIC) };
