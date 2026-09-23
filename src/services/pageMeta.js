// Per-route <title> and meta description for the SPA shell (used by seoMeta.renderIndexHtmlForRequest).
// Crawlers and link-unfurlers read these from the HTML the server returns, before any client JS runs,
// so every indexable route needs its own text instead of the generic home one.
//
// Pure module: no DB, no network. Titles stay within 30-65 chars and descriptions within 70-160, and
// are unique per route (tests/seo-page-meta.test.js enforces both, and that every sitemap path is
// covered). Copy rules: nothing about credits beyond what the site already says (they are earned and
// spent inside CardBrix; never a price, a purchase or an exchange rate to money).
const { TCG_BRANDS } = require('./seoJsonLd');

const BRAND = 'CardBrix';
const GAMES = { ...TCG_BRANDS }; // pokemon, magic, ... -> full display names (used in descriptions)
const CATALOG_GAMES = { ...GAMES, funko: 'Funko' };
// Short names for titles: the full official names ("Dragon Ball Super Card Game") blow the length budget.
const SHORT = { pokemon: 'Pokémon', magic: 'Magic', yugioh: 'Yu-Gi-Oh!', lorcana: 'Lorcana', onepiece: 'One Piece', dragonball: 'Dragon Ball', funko: 'Funko' };

const MODES = {
  annunci: { noun: 'Annunci', verb: 'Compra', what: 'a prezzo fisso' },
  aste: { noun: 'Aste', verb: 'Fai offerte', what: 'nelle aste live' },
};

const meta = (title, description) => ({ title: `${title} | ${BRAND}`, description });

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return null; // malformed percent-encoding: treat the route as unknown instead of throwing
  }
}

/** Marketplace hubs and categories: /annunci/..., /aste/... */
function marketMeta(modeKey, rest) {
  const m = MODES[modeKey];
  const lower = m.noun.toLowerCase();
  if (rest.length === 0) {
    return meta(`${m.noun} LEGO, carte collezionabili e Funko`, `${m.verb} set LEGO, carte collezionabili e Funko ${m.what}: sfoglia le ${lower} di venditori verificati e trova il tuo prossimo pezzo.`);
  }
  if (rest[0] === 'lego' && rest.length === 1) {
    return meta(`${m.noun} LEGO: set nuovi e usati`, `${m.verb} set LEGO nuovi e usati ${m.what}: Icons, Star Wars, Technic e non solo, con foto, condizione e prezzo di ogni pezzo.`);
  }
  if (rest[0] === 'funko' && rest.length === 1) {
    return meta(`${m.noun} Funko Pop e collezionabili`, `${m.verb} Funko Pop e altri collezionabili ${m.what}: sfoglia figure nuove e usate con foto, condizione e prezzo.`);
  }
  if (rest[0] === 'carte-collezionabili') {
    if (rest.length === 1) {
      return meta(`${m.noun} carte collezionabili`, `${m.verb} carte Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece e Dragon Ball ${m.what}: scegli il gioco e trova la carta che cerchi.`);
    }
    const game = rest[1];
    if (rest.length === 2 && GAMES[game]) {
      return meta(`${m.noun} di carte ${SHORT[game]}`, `${m.verb} carte ${GAMES[game]} ${m.what}: singole, rarità e condizioni diverse, con foto e prezzo di ogni carta su ${BRAND}.`);
    }
  }
  return null;
}

/**
 * Catalog: /catalog, /catalog/<game>, /catalog/lego/<setNum>, /catalog/<game>/<cardId>, .../search
 * `rest` is matched (lower-cased); `rawRest` keeps the original casing for values we print (set numbers).
 */
function catalogMeta(rest, rawRest) {
  if (rest.length === 0) {
    return meta('Catalogo LEGO e carte collezionabili', 'Consulta il catalogo di set LEGO e carte collezionabili: schede, dettagli e valore di mercato per ogni prodotto, anche senza annunci attivi.');
  }
  if (rest.length > 2) return null;
  const [slug, second] = rest;

  if (slug === 'lego') {
    if (rest.length === 1) return meta('Catalogo set LEGO: schede e valore di mercato', 'Cerca tra i set LEGO del catalogo: numero, anno, pezzi e valore di mercato stimato, con gli annunci disponibili su CardBrix.');
    if (second === 'search') return meta('Ricerca nel catalogo LEGO', 'Risultati della ricerca nel catalogo dei set LEGO: numero, anno, pezzi e valore di mercato di ogni set.');
    const decoded = safeDecode(rawRest[1]);
    if (!decoded) return null;
    const setNum = decoded.slice(0, 30);
    return meta(`LEGO set ${setNum}: valore di mercato e dettagli`, `Scheda del set LEGO ${setNum}: pezzi, anno di uscita, valore di mercato stimato e annunci disponibili su ${BRAND}.`);
  }

  const name = CATALOG_GAMES[slug];
  if (!name) return null;
  if (rest.length === 1) return meta(`Catalogo ${SHORT[slug]}: schede e dettagli`, `Sfoglia il catalogo ${name}: cerca per nome e trova la scheda di ogni carta con dettagli, illustrazioni e gli annunci disponibili.`);
  if (second === 'search') return meta(`Ricerca nel catalogo ${SHORT[slug]}`, `Risultati della ricerca nel catalogo ${name}: apri la scheda per vedere dettagli e annunci disponibili su ${BRAND}.`);
  return meta(`Scheda ${SHORT[slug]}: dettagli e annunci`, `Scheda di una carta ${name}: dettagli, illustrazione e annunci disponibili su ${BRAND}.`);
}

const STATIC = {
  '/come-funziona': meta('Come funziona: compra, vendi e vinci', 'Scopri come funziona CardBrix: pubblica un annuncio, fai offerte nelle aste live e partecipa ai puzzle della Puzzle Arena, passo dopo passo.'),
  '/skill-zone': meta('Puzzle Arena: concorsi di abilità', 'Metti alla prova la tua abilità con i puzzle della Puzzle Arena e vinci pezzi rari da collezione: scegli il concorso e partecipa.'),
  '/crediti': meta('Crediti: come si guadagnano e si usano', 'Scopri come si guadagnano i crediti CardBrix e come usarli per partecipare ai puzzle della Puzzle Arena.'),
  '/faq': meta('Domande frequenti su acquisti e vendite', 'Le risposte alle domande più frequenti su acquisti, vendite, aste, spedizioni e Puzzle Arena su CardBrix.'),
  '/help': meta('Assistenza per ordini, annunci e account', "Hai bisogno di aiuto con un ordine, un annuncio o il tuo account? Trova le guide e i modi per contattare l'assistenza CardBrix."),
  '/norme-legali': meta("Norme legali e condizioni d'uso", "Consulta le norme legali e le condizioni d'uso di CardBrix: regole per venditori e acquirenti, aste e concorsi di abilità."),
  '/ricerca-utente': meta('Cerca un utente o un venditore', 'Cerca un utente o un venditore su CardBrix per vederne il profilo, le valutazioni e gli annunci pubblicati.'),
  '/search-results': meta('Risultati di ricerca', 'Risultati della ricerca su CardBrix tra annunci, aste e catalogo di LEGO, carte collezionabili e Funko.'),
};

/**
 * @param {string} pathname  request path, e.g. "/annunci/carte-collezionabili/pokemon"
 * @returns {{title: string, description: string} | null}  null = no specific text (caller uses the default)
 */
function getRouteMeta(pathname) {
  const raw = String(pathname || '/').replace(/\/+$/, '') || '/';
  const path = raw.toLowerCase(); // only for matching routes; dynamic values below keep their casing
  if (path === '/') return null; // the home keeps the site-wide title/description from index.html
  if (STATIC[path]) return STATIC[path];

  const parts = path.split('/').filter(Boolean);
  const rawParts = raw.split('/').filter(Boolean);
  const [head, ...rest] = parts;
  if (head === 'annunci' || head === 'aste') return marketMeta(head, rest);
  if (head === 'catalog') return catalogMeta(rest, rawParts.slice(1));
  if (head === 'user' && rest.length === 1) {
    const username = safeDecode(rawParts[1]);
    if (!username) return null;
    const shown = username.slice(0, 40);
    return meta(`Profilo di ${shown}`, `Profilo di ${shown} su ${BRAND}: valutazioni, annunci pubblicati e attività di vendita.`);
  }
  return null;
}

module.exports = { getRouteMeta };
