// Builders for /llms.txt and /llms-full.txt (https://llmstxt.org): a markdown map of the site for AI
// assistants and answer engines. Pure functions; the route (routes/seoFiles.js) supplies the data.
//
// Copy stays factual and limited to what the public site already says about itself. In particular it
// makes no statement about credits, prices or legal terms: those live on the pages it links to.

const SECTIONS = [
  ['Annunci', '/annunci', 'Annunci a prezzo fisso di LEGO, carte collezionabili e Funko.'],
  ['Aste', '/aste', 'Aste live: fai un\'offerta sul pezzo che ti interessa.'],
  ['Puzzle Arena', '/skill-zone', 'Concorsi di abilità (puzzle) in cui si possono vincere pezzi rari.'],
  ['Catalogo', '/catalog', 'Catalogo di set LEGO e carte, con schede per ogni prodotto.'],
];

const CATEGORIES = [
  ['LEGO', '/annunci/lego'],
  ['Funko', '/annunci/funko'],
  ['Pokémon', '/annunci/carte-collezionabili/pokemon'],
  ['Magic: The Gathering', '/annunci/carte-collezionabili/magic'],
  ['Yu-Gi-Oh!', '/annunci/carte-collezionabili/yugioh'],
  ['Disney Lorcana', '/annunci/carte-collezionabili/lorcana'],
  ['One Piece Card Game', '/annunci/carte-collezionabili/onepiece'],
  ['Dragon Ball Super Card Game', '/annunci/carte-collezionabili/dragonball'],
];

const HELP = [
  ['Come funziona', '/come-funziona'],
  ['Domande frequenti', '/faq'],
  ['Assistenza', '/help'],
  ['Norme legali', '/norme-legali'],
];

const SUMMARY =
  '> CardBrix è il marketplace italiano per set LEGO, carte collezionabili (Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece, Dragon Ball) e Funko: compra a prezzo fisso, fai offerte nelle aste live o partecipa ai concorsi di abilità della Puzzle Arena.';

const link = (base, [name, path, desc]) => `- [${name}](${base}${path})${desc ? `: ${desc}` : ''}`;

function buildLlmsTxt({ baseUrl }) {
  return [
    '# CardBrix',
    '',
    SUMMARY,
    '',
    'Sito in italiano, con interfaccia disponibile anche in inglese, spagnolo, francese e tedesco.',
    '',
    '## Sezioni principali',
    ...SECTIONS.map((s) => link(baseUrl, s)),
    '',
    '## Categorie',
    ...CATEGORIES.map(([name, path]) => link(baseUrl, [name, path, `annunci ${name}`])),
    '',
    '## Aiuto e regole',
    ...HELP.map(([name, path]) => link(baseUrl, [name, path])),
    '',
    '## Optional',
    `- [Sitemap XML](${baseUrl}/sitemap.xml)`,
    `- [Versione estesa di questo file](${baseUrl}/llms-full.txt)`,
    '',
  ].join('\n');
}

function priceLabel(l) {
  const raw = l.type === 'auction' ? l.current_bid ?? l.auction_start : l.price;
  const n = raw == null || raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? `${n.toFixed(2).replace('.', ',')} €` : null;
}

/** listings: [{ id, title, type, price, current_bid, auction_start }] — most recent active ones. */
function buildLlmsFullTxt({ baseUrl, listings = [] }) {
  const lines = [
    buildLlmsTxt({ baseUrl }).replace(`- [Versione estesa di questo file](${baseUrl}/llms-full.txt)\n`, ''),
    '## Come è organizzato il sito',
    '- Ogni annuncio ha una pagina dedicata con titolo, foto, prezzo (o offerta corrente per le aste), condizione e venditore.',
    '- Le aste hanno una scadenza; l\'offerta corrente è indicata sulla pagina dell\'annuncio.',
    '- Il catalogo raccoglie le schede dei prodotti (set LEGO e carte dei vari giochi) indipendentemente dagli annunci attivi.',
    '',
  ];
  if (listings.length) {
    lines.push('## Annunci recenti');
    for (const l of listings) {
      const price = priceLabel(l);
      const kind = l.type === 'auction' ? 'asta' : 'annuncio';
      lines.push(`- [${l.title}](${baseUrl}/product/${l.id}): ${kind}${price ? `, ${price}` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = { buildLlmsTxt, buildLlmsFullTxt };
